/**
 * GyroHandler Class - HYBRID MODE (Optimized)
 * ------------------------------------------
 * 1. Tries Modern Generic Sensor API (RelativeOrientationSensor) for best performance.
 * 2. Falls back to Legacy DeviceOrientationEvent for maximum compatibility (Firefox, HA App).
 * 3. Sends updates as fast as possible (no throttling).
 */
export class GyroHandler {
  constructor(serviceManager, config) {
    this.serviceManager = serviceManager;
    this.config = config;
    
    // --- STATE ---
    this.gyroRelativeActive = false;
    this.gyroAbsoluteActive = false;
    this.isCalibrated = false;
    this.calibrating = false;

    // --- DATA HOLDERS ---
    this.orientation = { x: 0, y: 0, z: 0 }; // Yaw, Pitch, Roll (Degrees)
    this.lastOrientation = { x: null, y: null, z: null };
    
    this.smoothX = 0;
    this.smoothY = 0;
    this.smoothZ = 0;

    // --- FREQUENCY MEASUREMENT ---
    this.lastReadingTime = performance.now();
    this.readingCount = 0;
    this.measuredFrequency = 0.0;

    // --- CONFIGURATION ---
    this.GAIN = config.gyroSensitivity ?? 1.0; 
    this.SMOOTHING = config.smoothing ?? 0.2; 
    
    // Suppression: Extra wait time in ms after click release (Default: 20ms)
    this.SUPPRESSION_OFFSET = config.suppression_offset ?? 20;

    this.suppressionEndTime = 0;

    // --- SENSOR OBJECTS ---
    this.sensor = null;
    this.usingModernAPI = false;
    this.isListening = false;

    // Calculation Loop: Runs at 100Hz (every 10ms) to ensure smooth calculation and fast sending
    this.updateInterval = setInterval(() => this.processLoop(), 10);

    // Debug: Always attempt to listen if debug mode is on
    if (this.config.debug) {
        this.startListening();
    }
  }

  processLoop() {
    if (!this.gyroRelativeActive) return;

    // 1. Suppression Check
    if (performance.now() < this.suppressionEndTime) {
      this.lastOrientation.x = this.orientation.x;
      this.lastOrientation.y = this.orientation.y;
      return;
    }

    // 2. Init History
    if (this.lastOrientation.x === null) {
      this.lastOrientation.x = this.orientation.x;
      this.lastOrientation.y = this.orientation.y;
      return;
    }

    // 3. Calculate Deltas
    let dX = this.orientation.x - this.lastOrientation.x;
    let dY = this.orientation.y - this.lastOrientation.y;

    // Zero-Crossing Logic
    if (dX > 180) dX -= 360;
    if (dX < -180) dX += 360;

    // 4. Apply Smoothing
    this.smoothX = (this.smoothX * this.SMOOTHING) + (dX * (1 - this.SMOOTHING));
    this.smoothY = (this.smoothY * this.SMOOTHING) + (dY * (1 - this.SMOOTHING));

    // Update History
    this.lastOrientation.x = this.orientation.x;
    this.lastOrientation.y = this.orientation.y;

    // 5. Gain & Send (IMMEDIATE)
    const moveX = this.smoothX * this.GAIN * -1;
    const moveY = this.smoothY * this.GAIN * -1;

    // Small threshold to prevent network spam when device is perfectly still
    if (Math.abs(moveX) > 0.01 || Math.abs(moveY) > 0.01) {
      this.serviceManager.sendMove(Math.round(moveX * 10), Math.round(moveY * 10)); 
    }
  }

  setGyroSuppression(ms) {
    this.suppressionEndTime = performance.now() + ms + this.SUPPRESSION_OFFSET;
  }

  // --- SENSOR LOGIC ---

  startListening() {
    if (this.isListening) return;
    this.isListening = true;
    this.readingCount = 0;
    this.lastReadingTime = performance.now();

    // 1. Try Modern Generic Sensor API (Requested 120Hz)
    if (window.RelativeOrientationSensor) {
      try {
        this.sensor = new RelativeOrientationSensor({ frequency: 120, referenceFrame: 'device' });
        this.sensor.addEventListener('reading', () => this.handleSensorReading());
        
        this.sensor.addEventListener('error', (event) => {
          console.warn("Modern Sensor API failed. Falling back to Legacy.", event.error);
          this.sensor = null;
          this.startLegacyListener();
        });
        
        this.sensor.start();
        this.usingModernAPI = true;
        this.updateDebug("Modern API (Warte auf Daten)");
        return;
      } catch (err) {
        console.warn("Modern Sensor API not available.", err);
      }
    }

    // 2. Fallback: Legacy DeviceOrientationEvent
    this.startLegacyListener();
  }
  
  startLegacyListener() {
    if (!this.isListening) return; // Should already be true from startListening
    this.usingModernAPI = false;
    this.readingCount = 0;
    this.lastReadingTime = performance.now();
    
    if (!this._boundHandler) {
        this._boundHandler = this.handleLegacyOrientation.bind(this);
        // Note: Legacy API runs at the browser's/OS's default rate (~50-60Hz)
        window.addEventListener("deviceorientation", this._boundHandler, true);
        this.updateDebug("Legacy API (Warte auf Daten)");
    }
  }

  stopListening() {
    if (this.config.debug) return;
    
    this.isListening = false;
    if (this.sensor) {
        this.sensor.stop();
        this.sensor = null;
    }
    if (this._boundHandler) {
      window.removeEventListener("deviceorientation", this._boundHandler, true);
      this._boundHandler = null;
    }
  }

  // --- HANDLERS ---
  
  measureFrequency() {
    const now = performance.now();
    this.readingCount++;
    
    if (this.readingCount >= 100) {
        const timeElapsed = now - this.lastReadingTime;
        this.measuredFrequency = (this.readingCount / timeElapsed) * 1000;
        this.readingCount = 0;
        this.lastReadingTime = now;
    }
  }

  handleSensorReading() {
    this.measureFrequency();

    const q = this.sensor.quaternion;
    const w = q[3], x = q[0], y = q[1], z = q[2];
    
    // Euler conversion
    const siny_cosp = 2 * (w * z + x * y);
    const cosy_cosp = 1 - 2 * (y * y + z * z);
    const alpha = Math.atan2(siny_cosp, cosy_cosp) * (180 / Math.PI); 

    const sinr_cosp = 2 * (w * x + y * z);
    const cosr_cosp = 1 - 2 * (x * x + y * y);
    const beta = Math.atan2(sinr_cosp, cosr_cosp) * (180 / Math.PI); 

    const sinp = 2 * (w * y - z * x);
    let gamma;
    if (Math.abs(sinp) >= 1) gamma = (Math.sign(sinp) * Math.PI / 2) * (180 / Math.PI);
    else gamma = Math.asin(sinp) * (180 / Math.PI);

    this.orientation = { x: alpha, y: beta, z: gamma };
    this.updateDebug("Modern API");
  }

  handleLegacyOrientation(event) {
    this.measureFrequency();

    this.orientation = {
        x: event.alpha || 0,
        y: event.beta || 0,
        z: event.gamma || 0
    };
    this.updateDebug("Legacy API", event);
  }

  updateDebug(source, event = null) {
    if (!this.debugElem) return;

    let frequencyText = "Wird gemessen...";
    if (this.measuredFrequency > 0) {
        frequencyText = `${this.measuredFrequency.toFixed(1)} Hz`;
    }
    
    // COMPASS: Strict Mode (Nur webkitCompassHeading)
    let compassVal = "N/A";
    if (event && event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
        compassVal = event.webkitCompassHeading.toFixed(1) + "°";
    }

    this.debugElem.textContent = 
        `Source: ${source}\n` +
        `Update Freq: ${frequencyText}\n` +
        `------------------------------------\n` +
        `X (Yaw):   ${this.orientation.x.toFixed(4)}\n` +
        `Y (Pitch): ${this.orientation.y.toFixed(4)}\n` +
        `Z (Roll):  ${this.orientation.z.toFixed(4)}\n` +
        `Compass:   ${compassVal}`;
  }
  
  // --- PLATZHALTER & PERMISSIONS ---

  async toggleGyroRelative() {
    if (this.gyroRelativeActive) {
      this.gyroRelativeActive = false;
      this.stopListening();
      return;
    }
    const granted = await this.requestPermission();
    if (granted) {
      this.gyroRelativeActive = true;
      this.lastOrientation.x = null;
      // Start Listening muss hier erneut aufgerufen werden, falls der Debug-Modus vorher aus war
      this.startListening(); 
    }
  }
  
  async requestPermission() {
    // Permission nur für Legacy API unter iOS 13+ nötig
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      try { return (await DeviceOrientationEvent.requestPermission()) === "granted"; } 
      catch (error) { return false; }
    }
    // Andere Browser/OS
    return true;
  }
  
  async toggleGyroAbsolute() { console.warn("Not implemented"); }
  startCalibration() {}
  finishCalibration() {}
}