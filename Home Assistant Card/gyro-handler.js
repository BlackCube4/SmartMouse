export class GyroHandler {
  constructor(serviceManager, config) {
    this.serviceManager = serviceManager;
    this.config = config;
    
    this.gyroRelativeActive = false;
    this.gyroAbsoluteActive = false;
    this.lastMotion = null;
    this.gyroSuppressedUntil = 0;
    
    // Smoothing
    this.positionHistory = [];
    this.historySize = 5;
    
    // Calibration
    this.calibrating = false;
    this.calibrationStartTime = 0;
    this.calibrationDuration = 3000;
    this.calibrationMinHeading = Infinity;
    this.calibrationMaxHeading = -Infinity;
    this.calibrationMinTilt = Infinity;
    this.calibrationMaxTilt = -Infinity;
    this.calibrationTopLeft = { heading: 0, tilt: 0 };
    this.calibrationBottomRight = { heading: 0, tilt: 0 };
    this.isCalibrated = false;
    
    this.absoluteHeading = 0;
    this.absoluteTilt = 0;
    
    this.GAIN_X = config.gyro_gain_x ?? 32;
    this.GAIN_Y = config.gyro_gain_y ?? 38;
    this.SPEED_FILTER = config.gyro_speed_filter ?? 0.5;
    
    this.setupListeners();
  }

  setupListeners() {
    window.addEventListener("devicemotion", (ev) => this.handleMotion(ev));
    window.addEventListener("deviceorientation", (ev) => this.handleOrientation(ev));
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

    // Call parent's addMovement if available
    if (this.touchpadHandler) {
      this.touchpadHandler.addMovement(-rotX * dt * this.GAIN_X, -rotY * dt * this.GAIN_Y);
    }
  }

  handleOrientation(ev) {
    let heading = ev.alpha ?? 0;
    let tilt;
    
    if (this.isLandscape()) {
      const orientation = this.getLandscapeOrientation();
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
      this.updateCalibration(heading, tilt);
      return;
    }

    if (this.isCalibrated && this.gyroAbsoluteActive) {
      if (Date.now() < this.gyroSuppressedUntil) return;
      
      const rawX = this.mapToScreen(
        heading,
        this.calibrationBottomRight.heading,
        this.calibrationTopLeft.heading,
        0,
        32767
      );

      const rawY = this.mapToScreen(
        tilt,
        this.calibrationBottomRight.tilt,
        this.calibrationTopLeft.tilt,
        0,
        32767
      );

      this.positionHistory.push({ x: rawX, y: rawY });
      
      if (this.positionHistory.length > this.historySize) {
        this.positionHistory.shift();
      }

      let sumX = 0;
      let sumY = 0;
      for (const pos of this.positionHistory) {
        sumX += pos.x;
        sumY += pos.y;
      }
      
      const smoothX = sumX / this.positionHistory.length;
      const smoothY = sumY / this.positionHistory.length;

      this.serviceManager.sendMoveAbsolute(Math.round(smoothX), Math.round(smoothY));
    }
  }

  updateCalibration(heading, tilt) {
    const elapsed = Date.now() - this.calibrationStartTime;
    
    if (elapsed < this.calibrationDuration) {
      this.calibrationMinHeading = Math.min(this.calibrationMinHeading, heading);
      this.calibrationMaxHeading = Math.max(this.calibrationMaxHeading, heading);
      this.calibrationMinTilt = Math.min(this.calibrationMinTilt, tilt);
      this.calibrationMaxTilt = Math.max(this.calibrationMaxTilt, tilt);
      
      const progress = Math.floor((elapsed / this.calibrationDuration) * 100);
      if (this.calibrateBtn) {
        this.calibrateBtn.textContent = `${progress}%`;
      }
    } else {
      this.finishCalibration();
    }
  }

  startCalibration(button) {
    this.calibrating = true;
    this.calibrationStartTime = Date.now();
    this.calibrationMinHeading = Infinity;
    this.calibrationMaxHeading = -Infinity;
    this.calibrationMinTilt = Infinity;
    this.calibrationMaxTilt = -Infinity;
    
    this.calibrateBtn = button;
    button.textContent = "0%";
    button.style.background = "#666";
    navigator.vibrate?.(100);
  }

  finishCalibration() {
    this.calibrating = false;
    this.isCalibrated = true;
    
    this.calibrationTopLeft.heading = this.calibrationMinHeading;
    this.calibrationTopLeft.tilt = this.calibrationMinTilt;
    this.calibrationBottomRight.heading = this.calibrationMaxHeading;
    this.calibrationBottomRight.tilt = this.calibrationMaxTilt;
    
    this.positionHistory = [];
    
    if (this.calibrateBtn) {
      this.calibrateBtn.textContent = "☑";
      this.calibrateBtn.style.background = "#4a4";
      
      setTimeout(() => {
        if (this.calibrateBtn && this.isCalibrated) {
          this.calibrateBtn.style.background = "#666";
        }
      }, 2000);
    }
    
    navigator.vibrate?.(200);
  }

  mapToScreen(value, min, max, screenMin, screenMax) {
    if (max === min) return (screenMin + screenMax) / 2;
    
    const ratio = (value - min) / (max - min);
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    return screenMin + clampedRatio * (screenMax - screenMin);
  }

  async toggleGyroRelative() {
    if (this.gyroAbsoluteActive) {
      this.toggleGyroAbsolute();
    }

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
    if (this.gyroRelativeActive) {
      this.toggleGyroRelative();
    }

    if (this.gyroAbsoluteActive) {
      this.gyroAbsoluteActive = false;
      if (this.gyroAbsBtn) this.gyroAbsBtn.style.background = "#2b2c2f";
      return;
    }

    if (typeof DeviceOrientationEvent?.requestPermission === "function") {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r !== "granted") return;
    }

    this.absoluteHeading = 0;
    this.absoluteTilt = 0;
    this.positionHistory = [];
    this.gyroAbsoluteActive = true;
    if (this.gyroAbsBtn) this.gyroAbsBtn.style.background = "#666";
  }
}