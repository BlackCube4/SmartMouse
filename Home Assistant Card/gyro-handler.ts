import { ServiceManager } from './service-manager';
import { SmartMouseConfig } from './types';

declare global {
  interface Window {
    RelativeOrientationSensor: any;
  }
}

export class GyroHandler {
  public gyroRelativeActive = false;
  public gyroAbsoluteActive = false;
  public isCalibrated = false;
  public calibrating = false;
  public debugElem?: HTMLElement;
  private firstAbsoluteFrame = false;

  private calibrationStartTime = 0;
  private calibrationDuration = 3000;
  private orientation = { x: 0, y: 0, z: 0 };
  // --- Relative (air mouse) pipeline (Steam-style), see processLoop ---
  private accumX = 0;
  private accumY = 0;
  private lastRawX: number | null = null;
  private lastRawY: number | null = null;
  private lastLoopTime = performance.now();
  private carryX = 0;
  private carryY = 0;
  private smoothRing: { x: number, y: number }[] = [];
  private smoothIndex = 0;
  private readonly SMOOTH_UPPER = 75; // deg/s; above this, motion passes through unsmoothed
  private _loopInterval!: number;
  private _suppressHandler!: (e: any) => void;
  
  private bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  private smoothX = 0;
  private smoothY = 0;
  
  private lastReadingTime = performance.now();
  private readingCount = 0;
  private measuredFrequency = 0.0;
  
  private GAIN!: number;
  private SMOOTH_WINDOW!: number;
  private TIGHTEN_THRESHOLD!: number;
  private SUPPRESSION_OFFSET!: number;
  private suppressionEndTime = 0;
  
  private sensor: any = null;
  private isListening = false;
  private _boundHandler: any = null;
  private calTimer: number | null = null;
  private calibrateBtnElem?: HTMLElement;
  private originalCalibrateBtnIcon = "";

  constructor(private serviceManager: ServiceManager, private config: SmartMouseConfig) {
    this.updateConfig(config);

    this._loopInterval = window.setInterval(() => this.processLoop(), 10);
    this.loadCalibration();

    if (this.config.debug) {
        this.startListening();
    }

    // Listen for suppression event from TouchpadCard
    this._suppressHandler = ((e: CustomEvent) => {
      if (e.detail && typeof e.detail.ms === 'number') {
        this.setGyroSuppression(e.detail.ms);
      }
    }) as EventListener;
    window.addEventListener('smartmouse-gyro-suppress', this._suppressHandler);
  }

  // Live-updatable so editor tweaks apply without recreating the handler
  // (which would leak the interval/listener).
  updateConfig(config: SmartMouseConfig) {
    this.config = config;
    this.GAIN = config.gyroSensitivity ?? 8.0;
    const s = Math.max(0, Math.min(1, config.smoothing ?? 0.15));
    // Ring-buffer length for the slow-motion moving average (higher = smoother).
    this.SMOOTH_WINDOW = Math.max(1, 1 + Math.round(s * 11));
    this.TIGHTEN_THRESHOLD = config.gyroTightenThreshold ?? 3.0;
    this.SUPPRESSION_OFFSET = config.suppressionOffset ?? 20;
  }

  destroy() {
    clearInterval(this._loopInterval);
    window.removeEventListener('smartmouse-gyro-suppress', this._suppressHandler);
    if (this.sensor) { this.sensor.stop?.(); this.sensor = null; }
    if (this._boundHandler) {
      window.removeEventListener("deviceorientation", this._boundHandler, true);
      this._boundHandler = null;
    }
    this.isListening = false;
    this.gyroRelativeActive = false;
    this.gyroAbsoluteActive = false;
  }

  private processLoop() {
    if (!this.gyroRelativeActive && !this.gyroAbsoluteActive) return;

    const now = performance.now();

    // During suppression (e.g. just after a touchpad gesture) discard motion
    // and keep the baseline fresh so the cursor doesn't jump when it resumes.
    if (now < this.suppressionEndTime) {
      this.lastRawX = this.orientation.x;
      this.lastRawY = this.orientation.y;
      this.accumX = 0; this.accumY = 0;
      this.lastLoopTime = now;
      return;
    }

    if (this.gyroAbsoluteActive) {
      this.processAbsolute();
      return;
    }

    // --- Relative (air mouse) ---
    const dt = (now - this.lastLoopTime) / 1000;
    this.lastLoopTime = now;
    // Skip absurd gaps (e.g. tab was backgrounded) so we don't fling the cursor.
    if (dt <= 0 || dt > 0.5) {
      this.accumX = 0; this.accumY = 0;
      return;
    }

    // Degrees rotated since the last frame, drained from the accumulator that
    // the sensor callback fills at whatever rate the browser fires.
    let mx = this.accumX;
    let my = this.accumY;
    this.accumX = 0; this.accumY = 0;

    const speed = Math.hypot(mx, my) / dt; // deg/s

    // 1. Tightening: scale down near-still motion to kill sensor jitter, with
    //    no hard cutoff so slow precise aiming still works.
    if (this.TIGHTEN_THRESHOLD > 0 && speed < this.TIGHTEN_THRESHOLD) {
      const scale = speed / this.TIGHTEN_THRESHOLD;
      mx *= scale; my *= scale;
    }

    // 2. Tiered smoothing: smooth slow motion, let fast flicks pass through.
    const smoothed = this.tieredSmooth(mx, my, speed);

    // 3. Gain, invert to screen direction, keep sub-pixel remainder for smooth
    //    slow motion (round() alone would swallow tiny movements).
    const outX = smoothed.x * this.GAIN * -10 + this.carryX;
    const outY = smoothed.y * this.GAIN * -10 + this.carryY;
    const sendX = Math.trunc(outX);
    const sendY = Math.trunc(outY);
    this.carryX = outX - sendX;
    this.carryY = outY - sendY;

    if (sendX !== 0 || sendY !== 0) {
      this.serviceManager.sendMove(sendX, sendY);
    }
  }

  // Accumulate raw angular movement as sensor readings arrive, regardless of
  // their rate. Called from both the modern and legacy sensor callbacks, so a
  // 60Hz and a 120Hz sensor deliver the same total motion to the fixed-rate loop.
  private accumulateRelative() {
    if (!this.gyroRelativeActive) return;
    if (this.lastRawX === null || this.lastRawY === null) {
      this.lastRawX = this.orientation.x;
      this.lastRawY = this.orientation.y;
      return;
    }
    let dX = this.orientation.x - this.lastRawX;
    let dY = this.orientation.y - this.lastRawY;
    if (dX > 180) dX -= 360;
    if (dX < -180) dX += 360;
    this.accumX += dX;
    this.accumY += dY;
    this.lastRawX = this.orientation.x;
    this.lastRawY = this.orientation.y;
  }

  // Jibb Smart's tiered smoothing (the technique Steam Input uses): split each
  // frame's motion into a "direct" part that passes through immediately and a
  // "soft" part that goes through a fixed-length moving average. The faster the
  // motion, the larger the direct part - so quick flicks stay responsive while
  // slow motion is smoothed. The fixed-N ring initialised to zero preserves the
  // total movement (sum/N spreads a spike across N frames without losing it).
  private tieredSmooth(mx: number, my: number, speed: number) {
    const lower = this.TIGHTEN_THRESHOLD;
    const upper = this.SMOOTH_UPPER;
    let directWeight = upper > lower ? (speed - lower) / (upper - lower) : 1;
    directWeight = Math.max(0, Math.min(1, directWeight));

    const softX = mx * (1 - directWeight);
    const softY = my * (1 - directWeight);

    const N = this.SMOOTH_WINDOW;
    if (this.smoothRing.length !== N) {
      this.smoothRing = Array.from({ length: N }, () => ({ x: 0, y: 0 }));
      this.smoothIndex = 0;
    }
    this.smoothRing[this.smoothIndex] = { x: softX, y: softY };
    this.smoothIndex = (this.smoothIndex + 1) % N;

    let sumX = 0, sumY = 0;
    for (const s of this.smoothRing) { sumX += s.x; sumY += s.y; }

    return { x: mx * directWeight + sumX / N, y: my * directWeight + sumY / N };
  }

  private resetRelativeState() {
    this.accumX = 0; this.accumY = 0;
    this.carryX = 0; this.carryY = 0;
    this.lastRawX = null; this.lastRawY = null;
    this.smoothRing = [];
    this.smoothIndex = 0;
    this.lastLoopTime = performance.now();
  }

  private processAbsolute() {
    if (!this.isCalibrated || this.calibrating) return;
    const targetMax = 32767;

    const absX = this.mapCircular(this.orientation.x, this.bounds.minX, this.bounds.maxX, targetMax);
    const absY = this.mapLinear(this.orientation.y, this.bounds.minY, this.bounds.maxY, targetMax);

    const invertedAbsX = targetMax - absX;
    const invertedAbsY = targetMax - absY;

    if (this.firstAbsoluteFrame) {
      this.smoothX = invertedAbsX;
      this.smoothY = invertedAbsY;
      this.firstAbsoluteFrame = false;
    } else {
      this.smoothX = (this.smoothX * 0.7) + (invertedAbsX * 0.3);
      this.smoothY = (this.smoothY * 0.7) + (invertedAbsY * 0.3);
    }

    this.serviceManager.sendMoveAbsolute(Math.round(this.smoothX), Math.round(this.smoothY));
  }

  private mapLinear(val: number, min: number, max: number, targetMax: number) {
    if (max === min) return targetMax / 2; 
    const clampedVal = Math.max(min, Math.min(max, val));
    const ratio = (clampedVal - min) / (max - min);
    return Math.round(ratio * targetMax);
  }

  private mapCircular(val: number, minBound: number, maxBound: number, targetMax: number) {
    const v = (val % 360 + 360) % 360;
    const min = (minBound % 360 + 360) % 360;
    const max = (maxBound % 360 + 360) % 360;

    const arcLength = (max - min + 360) % 360;
    if (arcLength <= 0.1) return targetMax / 2;

    const relativeVal = (v - min + 360) % 360;
    if (relativeVal <= arcLength) {
      return Math.round((relativeVal / arcLength) * targetMax);
    } else {
      const distToMin = 360 - relativeVal;
      const distToMax = relativeVal - arcLength;
      return distToMin < distToMax ? 0 : targetMax;
    }
  }

  public recenter() {
    const dx = (this.bounds.maxX - this.bounds.minX + 360) % 360;
    const dy = this.bounds.maxY - this.bounds.minY;

    this.bounds.minX = (this.orientation.x - dx / 2 + 360) % 360;
    this.bounds.maxX = (this.orientation.x + dx / 2 + 360) % 360;
    this.bounds.minY = this.orientation.y - dy / 2;
    this.bounds.maxY = this.orientation.y + dy / 2;

    this.saveCalibration();
    navigator.vibrate?.([30, 30]);
    if (this.debugElem) this.updateDebug("Recentered");
  }

  public setGyroSuppression(ms: number) {
    this.suppressionEndTime = performance.now() + ms + this.SUPPRESSION_OFFSET;
  }

  private startListening() {
    if (this.isListening) return;
    this.isListening = true;
    this.readingCount = 0;
    this.lastReadingTime = performance.now();

    if (window.RelativeOrientationSensor) {
      try {
        this.sensor = new window.RelativeOrientationSensor({ frequency: 120, referenceFrame: 'device' });
        this.sensor.addEventListener('reading', () => this.handleSensorReading());
        this.sensor.addEventListener('error', () => {
          this.sensor = null;
          this.startLegacyListener();
        });
        this.sensor.start();
        this.updateDebug("Modern API (Warte auf Daten)");
        return;
      } catch (err) {}
    }
    this.startLegacyListener();
  }
  
  private startLegacyListener() {
    if (!this.isListening) return; 
    this.readingCount = 0;
    this.lastReadingTime = performance.now();
    
    if (!this._boundHandler) {
        this._boundHandler = this.handleLegacyOrientation.bind(this);
        window.addEventListener("deviceorientation", this._boundHandler, true);
        this.updateDebug("Legacy API (Warte auf Daten)");
    }
  }

  private stopListening() {
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

  private measureFrequency() {
    const now = performance.now();
    this.readingCount++;
    if (this.readingCount >= 100) {
        const timeElapsed = now - this.lastReadingTime;
        this.measuredFrequency = (this.readingCount / timeElapsed) * 1000;
        this.readingCount = 0;
        this.lastReadingTime = now;
    }
  }

  private handleSensorReading() {
    this.measureFrequency();
    const q = this.sensor.quaternion;
    const w = q[3], x = q[0], y = q[1], z = q[2];
    
    const siny_cosp = 2 * (w * z + x * y);
    const cosy_cosp = 1 - 2 * (y * y + z * z);
    let alpha = (Math.atan2(siny_cosp, cosy_cosp) * (180 / Math.PI) + 360) % 360;

    const sinr_cosp = 2 * (w * x + y * z);
    const cosr_cosp = 1 - 2 * (x * x + y * y);
    const beta = Math.atan2(sinr_cosp, cosr_cosp) * (180 / Math.PI); 

    const sinp = 2 * (w * y - z * x);
    let gamma = Math.abs(sinp) >= 1 ? (Math.sign(sinp) * Math.PI / 2) * (180 / Math.PI) : Math.asin(sinp) * (180 / Math.PI);

    this.orientation = { x: alpha, y: beta, z: gamma };
    this.accumulateRelative();
    if (this.calibrating) this.updateCalibrationBounds();
    this.updateDebug("Modern API");
  }

  private handleLegacyOrientation(event: any) {
    this.measureFrequency();
    this.orientation = { x: event.alpha || 0, y: event.beta || 0, z: event.gamma || 0 };
    this.accumulateRelative();
    if (this.calibrating) this.updateCalibrationBounds();
    this.updateDebug("Legacy API", event);
  }

  private updateDebug(source: string, event: any = null) {
    if (!this.debugElem) return;
    this.debugElem.textContent = `Source: ${source}\nFreq: ${this.measuredFrequency.toFixed(1)}Hz\nX/Yaw: ${this.orientation.x.toFixed(2)}`;
  }

  public async toggleGyroRelative() {
    if (this.gyroRelativeActive) {
      this.gyroRelativeActive = false;
      return;
    }
    this.gyroRelativeActive = true;
    this.resetRelativeState();
    this.startListening();
  }

  public async toggleGyroAbsolute() {
    if (this.gyroAbsoluteActive) {
      this.gyroAbsoluteActive = false;
      return;
    }
    this.gyroAbsoluteActive = true;
    this.firstAbsoluteFrame = true;
    this.startListening();
  }

  // Remaining calibration methods mapped 1:1 from JS...
  private _getStorageKey() { return `smartmouse_gyro_bounds_${this.config.device_id || 'default'}`; }
  private saveCalibration() { localStorage.setItem(this._getStorageKey(), JSON.stringify(this.bounds)); this.isCalibrated = true; }
  private loadCalibration() { const stored = localStorage.getItem(this._getStorageKey()); if (stored) { this.bounds = JSON.parse(stored); this.isCalibrated = true; } }

  public startCalibration(btn?: HTMLElement) {
    this.calibrating = true;
    this.isCalibrated = false;
    this.calibrateBtnElem = btn;
    
    if (btn) {
        this.originalCalibrateBtnIcon = btn.innerHTML;
        btn.innerHTML = "0%";
        btn.style.background = "var(--error-color, #e74c3c)";
    }

    this.bounds.minX = this.orientation.x;
    this.bounds.maxX = this.orientation.x;
    this.bounds.minY = this.orientation.y;
    this.bounds.maxY = this.orientation.y;

    this.startListening(); // Ensure we are collecting sensor data

    this.calibrationStartTime = performance.now();
    this.calTimer = window.setTimeout(() => this.finishCalibration(), this.calibrationDuration);
    
    if (this.debugElem) this.updateDebug("Calibrating...");
  }

  private updateCalibrationBounds() {
    const elapsed = performance.now() - this.calibrationStartTime;
    const progress = Math.min(100, Math.floor((elapsed / this.calibrationDuration) * 100));
    
    if (this.calibrateBtnElem) {
      this.calibrateBtnElem.textContent = `${progress}%`;
    }

    this.bounds.minY = Math.min(this.bounds.minY, this.orientation.y);
    this.bounds.maxY = Math.max(this.bounds.maxY, this.orientation.y);

    let dMin = this.orientation.x - this.bounds.minX;
    if (dMin > 180) dMin -= 360;
    if (dMin < -180) dMin += 360;
    if (dMin < 0) this.bounds.minX = this.orientation.x;

    let dMax = this.orientation.x - this.bounds.maxX;
    if (dMax > 180) dMax -= 360;
    if (dMax < -180) dMax += 360;
    if (dMax > 0) this.bounds.maxX = this.orientation.x;
  }

  public finishCalibration() {
    if (!this.calibrating) return;
    if (this.calTimer) clearTimeout(this.calTimer);
    this.calibrating = false;
    this.saveCalibration();
    
    if (this.calibrateBtnElem) {
      this.calibrateBtnElem.style.background = "var(--success-color, #2ecc71)";
      this.calibrateBtnElem.innerHTML = `<ha-icon icon="mdi:border-radius" style="margin-bottom: 4px; pointer-events: none;"></ha-icon>Calibrated!`;
      
      setTimeout(() => {
          if (this.calibrateBtnElem) {
              this.calibrateBtnElem.innerHTML = this.originalCalibrateBtnIcon || "Absolute";
              this.calibrateBtnElem.style.background = this.gyroAbsoluteActive ? "var(--primary-color, #666)" : "var(--dark, #2b2c2f)";
          }
      }, 1000);
    }
    
    navigator.vibrate?.([100]);
    if (this.debugElem) this.updateDebug("Calibration Finished");
  }
}