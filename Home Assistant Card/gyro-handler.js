export class GyroHandler {
  constructor(serviceManager, config) {
    this.serviceManager = serviceManager;
    this.config = config;
    
    this.gyroRelativeActive = false;
    this.gyroAbsoluteActive = false;
    this.lastMotion = null;
    this.gyroSuppressedUntil = 0;
    
    this.positionHistory = [];
    this.historySize = 5;
    
    // Calibration
    this.calibrating = false;
    this.calibrationStartTime = 0;
    this.calibrationDuration = 3000;
    
    // Wir speichern Winkel nicht mehr als simple min/max, sondern als Referenzpunkte
    // um das 360-Grad-Problem (Nord-Übergang) zu lösen.
    this.calibrationTopLeft = { heading: 0, tilt: 0 };
    this.calibrationBottomRight = { heading: 0, tilt: 0 };
    this.calibrationCenter = { heading: 0, tilt: 0 }; // Berechnet
    this.calibrationRange = { heading: 0, tilt: 0 };  // Berechnet
    
    this.isCalibrated = false;

    // Load saved calibration
    this.loadCalibration();
    
    this.absoluteHeading = 0;
    this.absoluteTilt = 0;
    
    this.GAIN_X = config.gyro_gain_x ?? 32;
    this.GAIN_Y = config.gyro_gain_y ?? 38;
    this.SPEED_FILTER = config.gyro_speed_filter ?? 0.5;
    
    this.setupListeners();
  }

  saveCalibration() {
    const data = {
      topLeft: this.calibrationTopLeft,
      bottomRight: this.calibrationBottomRight,
      center: this.calibrationCenter,
      range: this.calibrationRange,
      isCalibrated: this.isCalibrated
    };
    try {
      localStorage.setItem("keymouse-gyro-calibration", JSON.stringify(data));
    } catch (e) {
      console.warn("Failed to save calibration", e);
    }
  }

  loadCalibration() {
    try {
      const stored = localStorage.getItem("keymouse-gyro-calibration");
      if (stored) {
        const data = JSON.parse(stored);
        if (data.isCalibrated) {
          this.calibrationTopLeft = data.topLeft;
          this.calibrationBottomRight = data.bottomRight;
          this.calibrationCenter = data.center || { heading: 0, tilt: 0 };
          this.calibrationRange = data.range || { heading: 0, tilt: 0 };
          this.isCalibrated = true;
        }
      }
    } catch (e) {
      console.warn("Failed to load calibration", e);
    }
  }

  setupListeners() {
    window.addEventListener("devicemotion", (ev) => this.handleMotion(ev));
    
    // WICHTIG: Versuche 'deviceorientationabsolute' für Android/Chrome mit Kompass.
    // Das liefert Werte relativ zur Erde (Nordpol), nicht zum App-Start.
    if ('ondeviceorientationabsolute' in window) {
        window.addEventListener("deviceorientationabsolute", (ev) => this.handleOrientation(ev, true));
    } else {
        window.addEventListener("deviceorientation", (ev) => this.handleOrientation(ev, false));
    }
  }

  isLandscape() {
    const angle = screen.orientation?.angle ?? window.orientation ?? 0;
    return angle === 90 || angle === -90 || angle === 270;
  }

  getLandscapeOrientation() {
    return screen.orientation?.angle ?? window.orientation ?? 0;
  }

  setGyroSuppression(duration) {
    this.gyroSuppressedUntil = Date.now() + duration;
  }

  handleMotion(ev) {
    if (!this.gyroRelativeActive || !ev.rotationRate) return;
    if (Date.now() < this.gyroSuppressedUntil) return;

    const { gamma, alpha, beta } = ev.rotationRate;
    const now = performance.now();
    let dt = 0.016;
    if (this.lastMotion !== null) dt = (now - this.lastMotion) / 1000;
    this.lastMotion = now;

    const speedX = Math.abs(gamma);
    const rotX = speedX < this.SPEED_FILTER ? 0 : gamma;

    let rawVertical = this.isLandscape() ? -beta : alpha;
    const speedY = Math.abs(rawVertical);
    const rotY = speedY < this.SPEED_FILTER ? 0 : rawVertical;

    if (this.touchpadHandler) {
      this.touchpadHandler.addMovement(-rotX * dt * this.GAIN_X, -rotY * dt * this.GAIN_Y);
    }
  }

  handleOrientation(ev, isAbsoluteEvent) {
    // Wenn wir absolute Werte haben wollen, aber das Event nicht absolut ist (und kein iOS WebkitCompass),
    // ist die gespeicherte Kalibrierung nach Reload eventuell falsch. 
    // Aber wir versuchen es bestmöglich.

    let heading = ev.alpha ?? 0;
    
    // iOS Support (WebKit Compass Heading ist "echter" Norden)
    if (!isAbsoluteEvent && ev.webkitCompassHeading) {
        heading = ev.webkitCompassHeading; 
    }
    // Android Absolute Fallback: Wenn das Event "absolute" flag true hat
    else if (ev.absolute && ev.alpha !== null) {
        heading = ev.alpha;
    }

    let tilt;
    
    if (this.isLandscape()) {
      const orientation = this.getLandscapeOrientation();
      // Korrektur für Landscape Modus
      if (orientation === 90 || orientation === -270) {
        heading = (heading + 90) % 360;
      } else if (orientation === -90 || orientation === 270) {
        heading = (heading - 90 + 360) % 360;
      }
      tilt = -(ev.gamma ?? 0);
    } else {
      tilt = ev.beta ?? 0;
    }

    this.absoluteHeading = heading;
    this.absoluteTilt = tilt;

    if (this.calibrating) {
      this.collectCalibrationData(heading, tilt);
      return;
    }

    if (this.isCalibrated && this.gyroAbsoluteActive) {
      if (Date.now() < this.gyroSuppressedUntil) return;

      // Berechne Differenz zum Zentrum der Kalibrierung
      // getShortestAngle handhabt den 359 -> 1 Grad Übergang korrekt
      const deltaH = this.getShortestAngle(heading, this.calibrationCenter.heading);
      const deltaT = tilt - this.calibrationCenter.tilt; // Tilt (Gamma/Beta) springt nicht bei +/- 90 so kritisch

      // Mappe Delta auf Screen Koordinaten (-0.5 bis +0.5 Bereich quasi)
      // Range ist die volle Breite in Grad
      
      const xRatio = deltaH / this.calibrationRange.heading; // z.B. -10 / 40 = -0.25
      const yRatio = deltaT / this.calibrationRange.tilt;

      // In Screen Koordinaten umrechnen (0..32767)
      // 0.5 ist die Mitte (16384)
      const centerX = 16384;
      const centerY = 16384;
      
      let rawX = centerX + (xRatio * 32767);
      let rawY = centerY + (yRatio * 32767);

      // Clamping
      rawX = Math.max(0, Math.min(32767, rawX));
      rawY = Math.max(0, Math.min(32767, rawY));

      this.positionHistory.push({ x: rawX, y: rawY });
      if (this.positionHistory.length > this.historySize) this.positionHistory.shift();

      let sumX = 0, sumY = 0;
      for (const pos of this.positionHistory) { sumX += pos.x; sumY += pos.y; }
      
      const smoothX = sumX / this.positionHistory.length;
      const smoothY = sumY / this.positionHistory.length;

      this.serviceManager.sendMoveAbsolute(Math.round(smoothX), Math.round(smoothY));
    }
  }

  // Hilfsfunktion für den kürzesten Weg im Kreis (für Kompass 0-360)
  getShortestAngle(target, reference) {
    let diff = (target - reference + 180 + 360) % 360 - 180;
    return diff;
  }

  // Temporary arrays for calibration
  calibHeadings = [];
  calibTilts = [];

  startCalibration(button) {
    this.calibrating = true;
    this.calibrationStartTime = Date.now();
    this.calibHeadings = [];
    this.calibTilts = [];
    
    this.calibrateBtn = button;
    button.textContent = "0%";
    button.style.background = "#666";
    navigator.vibrate?.(100);
  }

  collectCalibrationData(heading, tilt) {
    const elapsed = Date.now() - this.calibrationStartTime;
    
    if (elapsed < this.calibrationDuration) {
      this.calibHeadings.push(heading);
      this.calibTilts.push(tilt);
      
      const progress = Math.floor((elapsed / this.calibrationDuration) * 100);
      if (this.calibrateBtn) {
        this.calibrateBtn.textContent = `${progress}%`;
      }
    } else {
      this.finishCalibration();
    }
  }

  finishCalibration() {
    this.calibrating = false;
    
    if (this.calibHeadings.length < 10) return; // Fehlgeschlagen oder zu kurz

    // Sortieren um Min/Max robust zu finden (einfaches Ausreißer ignorieren wäre noch besser)
    // Bei Headings müssen wir aufpassen wegen 0/360 Sprung. 
    // Wir nehmen den Median als "Zentrum" und schauen wie weit es ausschlägt.
    
    // 1. Tilt ist einfach (linear -90 bis 90 meistens)
    const minTilt = Math.min(...this.calibTilts);
    const maxTilt = Math.max(...this.calibTilts);
    
    // 2. Heading ist komplex. Wir suchen den größten Abstand zwischen Punkten im Kreis.
    // Aber vereinfacht für User-Interface (Swipe TopLeft to BottomRight):
    // Wir nehmen an, der User hat ungefähr den Bereich abgedeckt.
    
    // Wir wandeln alle Headings relative zum ersten gemessenen Punkt um, um den Sprung zu eliminieren
    const ref = this.calibHeadings[0];
    const relativeHeadings = this.calibHeadings.map(h => this.getShortestAngle(h, ref));
    
    const minRelH = Math.min(...relativeHeadings);
    const maxRelH = Math.max(...relativeHeadings);
    
    // Zurückrechnen in absolute Koordinaten für Speicherung
    // (Achtung: Das Zentrum ist robuster als Ränder)
    const rangeH = maxRelH - minRelH;
    const centerRelH = minRelH + (rangeH / 2);
    const centerH = (ref + centerRelH + 360) % 360;

    const rangeT = maxTilt - minTilt;
    const centerT = minTilt + (rangeT / 2);

    this.calibrationCenter = { heading: centerH, tilt: centerT };
    // Wir geben etwas Padding hinzu (z.B. 10%), damit man den Rand leicht erreichen kann
    this.calibrationRange = { heading: rangeH * 1.0, tilt: rangeT * 1.0 }; 
    
    // Legacy support (für MapToScreen Logik falls nötig, aber wir nutzen jetzt Center/Range)
    this.calibrationTopLeft = { heading: 0, tilt: 0 }; 
    this.calibrationBottomRight = { heading: 0, tilt: 0 };

    this.isCalibrated = true;
    this.saveCalibration();

    if (this.calibrateBtn) {
      this.calibrateBtn.textContent = "☑";
      this.calibrateBtn.style.background = "#4a4";
      setTimeout(() => {
        if (this.calibrateBtn) this.calibrateBtn.style.background = "#2b2c2f";
      }, 2000);
    }
    navigator.vibrate?.(200);
  }

  async toggleGyroRelative() {
    if (this.gyroAbsoluteActive) this.toggleGyroAbsolute();

    if (this.gyroRelativeActive) {
      this.gyroRelativeActive = false;
      if (this.gyroRelBtn) this.gyroRelBtn.style.background = "#2b2c2f";
      return;
    }

    if (typeof DeviceMotionEvent?.requestPermission === "function") {
      const r = await DeviceMotionEvent.requestPermission();
      if (r !== "granted") return;
    }

    this.lastMotion = null;
    this.gyroRelativeActive = true;
    if (this.gyroRelBtn) this.gyroRelBtn.style.background = "#666";
  }

  async toggleGyroAbsolute() {
    if (this.gyroRelativeActive) this.toggleGyroRelative();

    if (this.gyroAbsoluteActive) {
      this.gyroAbsoluteActive = false;
      if (this.gyroAbsBtn) this.gyroAbsBtn.style.background = "#2b2c2f";
      return;
    }

    if (typeof DeviceOrientationEvent?.requestPermission === "function") {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r !== "granted") return;
    }

    this.positionHistory = [];
    this.gyroAbsoluteActive = true;
    if (this.gyroAbsBtn) this.gyroAbsBtn.style.background = "#666";
  }
}