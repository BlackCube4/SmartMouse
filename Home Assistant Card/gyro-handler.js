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
    this.calibrationStartTime = 0;
    this.calibrationDuration = 3000; // 3 seconds
    this.calibrating = false;

    // --- DATA HOLDERS ---
    this.orientation = { x: 0, y: 0, z: 0 }; // Yaw, Pitch, Roll (Degrees)
    this.lastOrientation = { x: null, y: null, z: null };
    
    // Calibration Bounds (Yaw/X and Pitch/Y)
    this.originalCalibrateBtnIcon = ""; // To store the icon during calibration
    this.bounds = {
      minX: 0, maxX: 0,
      minY: 0, maxY: 0
    };

    this.smoothX = 0;
    this.smoothY = 0;
    this.smoothZ = 0;

    // --- FREQUENCY MEASUREMENT ---
    this.lastReadingTime = performance.now();
    this.readingCount = 0;
    this.measuredFrequency = 0.0;

    // --- CONFIGURATION ---
    this.GAIN = config.gyroSensitivity ?? 8.0; 
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
    this.loadCalibration();

    // Debug: Always attempt to listen if debug mode is on
    if (this.config.debug) {
        this.startListening();
    }
  }

  processLoop() {
    if (!this.gyroRelativeActive && !this.gyroAbsoluteActive) return;

    // 1. Suppression Check
    if (performance.now() < this.suppressionEndTime) {
      this.lastOrientation.x = this.orientation.x;
      this.lastOrientation.y = this.orientation.y;
      return;
    }

    if (this.gyroAbsoluteActive) {
      this.processAbsolute();
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

  processAbsolute() {
    if (!this.isCalibrated || this.calibrating) return;

    const targetMax = 32767;

    // Map Yaw (X) - Circular
    const absX = this.mapCircular(this.orientation.x, this.bounds.minX, this.bounds.maxX, targetMax);
    // Map Pitch (Y) - Linear
    const absY = this.mapLinear(this.orientation.y, this.bounds.minY, this.bounds.maxY, targetMax);

    // Invert for user's desired direction (up/down -> down/up, left/right -> right/left)
    const invertedAbsX = targetMax - absX;
    const invertedAbsY = targetMax - absY;

    // Smoothing for absolute
    this.smoothX = (this.smoothX * 0.7) + (invertedAbsX * 0.3);
    this.smoothY = (this.smoothY * 0.7) + (invertedAbsY * 0.3);

    this.serviceManager.sendMoveAbsolute(Math.round(this.smoothX), Math.round(this.smoothY));
  }

  // Helper for linear mapping (e.g., Pitch/Y)
  mapLinear(val, min, max, targetMax) {
    if (max === min) return targetMax / 2; // Avoid division by zero

    // Clamp the input value directly to the calibrated range
    const clampedVal = Math.max(min, Math.min(max, val));

    // Calculate the ratio within the clamped range
    const ratio = (clampedVal - min) / (max - min);

    // Scale to target range
    return Math.round(ratio * targetMax);
  }

  /**
   * Unified circular mapping logic.
   * Handles the 0/360 wrap-around by calculating distances relative to the left bound (min).
   */
  mapCircular(val, minBound, maxBound, targetMax) {
    const v = (val % 360 + 360) % 360;
    const min = (minBound % 360 + 360) % 360;
    const max = (maxBound % 360 + 360) % 360;

    // Total angular width of the calibrated window
    const arcLength = (max - min + 360) % 360;
    if (arcLength <= 0.1) return targetMax / 2;

    // Current position relative to the start of the window
    const relativeVal = (v - min + 360) % 360;

    if (relativeVal <= arcLength) {
      // We are inside the pointed area
      return Math.round((relativeVal / arcLength) * targetMax);
    } else {
      // We are in the "dead zone" behind the user - clamp to nearest edge
      const distToMin = 360 - relativeVal;
      const distToMax = relativeVal - arcLength;
      return distToMin < distToMax ? 0 : targetMax;
    }
  }

  recenter() {
    if (!this.isCalibrated) return;
    
    // Calculate current width/height of the calibration window
    const dx = (this.bounds.maxX - this.bounds.minX + 360) % 360;
    const dy = this.bounds.maxY - this.bounds.minY;

    // Shift bounds so current orientation is at center
    this.bounds.minX = (this.orientation.x - dx / 2 + 360) % 360;
    this.bounds.maxX = (this.orientation.x + dx / 2 + 360) % 360;
    
    this.bounds.minY = this.orientation.y - dy / 2;
    this.bounds.maxY = this.orientation.y + dy / 2;

    this.saveCalibration();
    navigator.vibrate?.([30, 30]);
    if (this.debugElem) this.updateDebug("Recentered");
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
    let alpha = Math.atan2(siny_cosp, cosy_cosp) * (180 / Math.PI);
    // Normalize to 0-360 for consistent calibration logic
    alpha = (alpha + 360) % 360;

    const sinr_cosp = 2 * (w * x + y * z);
    const cosr_cosp = 1 - 2 * (x * x + y * y);
    const beta = Math.atan2(sinr_cosp, cosr_cosp) * (180 / Math.PI); 

    const sinp = 2 * (w * y - z * x);
    let gamma;
    if (Math.abs(sinp) >= 1) gamma = (Math.sign(sinp) * Math.PI / 2) * (180 / Math.PI);
    else gamma = Math.asin(sinp) * (180 / Math.PI);

    this.orientation = { x: alpha, y: beta, z: gamma };
    
    if (this.calibrating) {
      this.updateCalibrationBounds();
    }

    this.updateDebug("Modern API");
  }

  handleLegacyOrientation(event) {
    this.measureFrequency();

    this.orientation = {
        x: event.alpha || 0,
        y: event.beta || 0,
        z: event.gamma || 0
    };

    if (this.calibrating) {
      this.updateCalibrationBounds();
    }

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
        `Compass:   ${compassVal}\n` +
        `Calibrated: ${this.isCalibrated ? 'YES' : 'NO'}`;
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
      // Reset smoothing and history to prevent coordinate pollution
      this.smoothX = 0;
      this.smoothY = 0;
      this.lastOrientation.x = null;
      // Start Listening muss hier erneut aufgerufen werden, falls der Debug-Modus vorher aus war
      this.startListening(); 
    }
  }

  async toggleGyroAbsolute() {
    if (this.gyroAbsoluteActive) {
      this.gyroAbsoluteActive = false;
      this.stopListening();
      return;
    }
    const granted = await this.requestPermission();
    if (granted) {
      this.gyroAbsoluteActive = true;
      // Reset smoothing to start from a clean state
      this.smoothX = 0;
      this.smoothY = 0;
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

  _getStorageKey() {
    return `keymouse_gyro_bounds_${this.config.device_id || 'default'}`;
  }

  saveCalibration() {
    localStorage.setItem(this._getStorageKey(), JSON.stringify(this.bounds));
    this.isCalibrated = true;
  }

  loadCalibration() {
    const stored = localStorage.getItem(this._getStorageKey());
    if (stored) {
      this.bounds = JSON.parse(stored);
      this.isCalibrated = true;
    }
  }

  startCalibration(btn) {
    this.calibrating = true;
    this.isCalibrated = false;
    this.calibrateBtnElem = btn;

    // Store original icon and update button text for progress
    this.originalCalibrateBtnIcon = btn.querySelector('ha-icon')?.getAttribute('icon') || "";
    btn.innerHTML = "0%";
    
    // Initialize bounds with current orientation
    this.bounds.minX = this.orientation.x;
    this.bounds.maxX = this.orientation.x;
    this.bounds.minY = this.orientation.y;
    this.bounds.maxY = this.orientation.y;

    btn.style.background = "var(--error-color, #e74c3c)";
    this.calibrationStartTime = performance.now();
    // Auto-stop after 3 seconds
    this.calTimer = setTimeout(() => this.finishCalibration(), 3000);
    
    if (this.debugElem) this.updateDebug("Calibrating...");
  }

  updateCalibrationBounds() {
    // Update progress bar
    const elapsed = performance.now() - this.calibrationStartTime;
    const progress = Math.min(100, Math.floor((elapsed / this.calibrationDuration) * 100));
    if (this.calibrateBtnElem) {
      this.calibrateBtnElem.textContent = `${progress}%`;
    }

    // Yaw (X) handling with circular logic
    const distToMin = Math.abs(this.orientation.x - this.bounds.minX);
    const distToMax = Math.abs(this.orientation.x - this.bounds.maxX);
    
    // Simple min/max for pitch (usually doesn't flip 360)
    this.bounds.minY = Math.min(this.bounds.minY, this.orientation.y);
    this.bounds.maxY = Math.max(this.bounds.maxY, this.orientation.y);

    // For Yaw, we just expand the range
    let dMin = this.orientation.x - this.bounds.minX;
    if (dMin > 180) dMin -= 360;
    if (dMin < -180) dMin += 360;
    if (dMin < 0) this.bounds.minX = this.orientation.x;

    let dMax = this.orientation.x - this.bounds.maxX;
    if (dMax > 180) dMax -= 360;
    if (dMax < -180) dMax += 360;
    if (dMax > 0) this.bounds.maxX = this.orientation.x;
  }

  finishCalibration() {
    if (!this.calibrating) return;
    clearTimeout(this.calTimer);
    this.calibrating = false;
    this.saveCalibration();
    
    if (this.calibrateBtnElem) {
      this.calibrateBtnElem.style.background = "var(--dark, #2b2c2f)";
      // Restore original icon
      if (this.originalCalibrateBtnIcon) {
        this.calibrateBtnElem.innerHTML = "";
        const icon = document.createElement("ha-icon");
        icon.setAttribute("icon", this.originalCalibrateBtnIcon);
        icon.style.pointerEvents = "none";
        this.calibrateBtnElem.appendChild(icon);
      }
    }
    navigator.vibrate?.(100);
  }
}