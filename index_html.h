#ifndef INDEX_HTML_H
#define INDEX_HTML_H

const char* INDEX_HTML = R"rawliteral(
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <title>ESP32 S3 HID</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <meta charset="UTF-8">

  <style>
    /* Theme Variables */
    :root[data-theme="dark"] {
      --bg-color: #121212;
      --card-bg: #1e1f22;
      --border-color: #2b2c2f;
      --text-color: #ffffff;
      --text-muted: #aaaaaa;
      --btn-dark: #2b2c2f;
      --btn-light: #3a3b3f;
      --trackpad-bg: #2a2b2e;
      --primary: #666666;
      --error: #e74c3c;
      --divider: #3a3b3d;
      --box-shadow: 0px 4px 10px rgba(0,0,0,0.5);
    }

    :root[data-theme="light"] {
      --bg-color: #e9ecef;
      --card-bg: #ffffff;
      --border-color: transparent;
      --text-color: #212529;
      --text-muted: #6c757d;
      --btn-dark: #ffffff;
      --btn-light: #f0f0f0;
      --trackpad-bg: #f8f9fa;
      --primary: #0d6efd;
      --error: #dc3545;
      --divider: transparent;
      --box-shadow: 0px 4px 10px rgba(0,0,0,0.1);
    }

    body { 
      font-family: 'Inter', system-ui, sans-serif; 
      text-align: center; 
      margin: 0; 
      padding: 10px; 
      background-color: var(--bg-color);
      color: var(--text-color);
      transition: background-color 0.3s, color 0.3s;
      user-select: none;
      -webkit-user-select: none;
      height: 100vh;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      overflow: hidden;
    }
    
    #header-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding: 0 5px;
    }

    #status-header h1 {
      font-size: 18px;
      margin: 0;
      display: flex;
      align-items: center;
    }
    
    .status-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-left: 8px;
      transition: background-color 0.3s;
    }
    .status-dot.connected { background-color: #4a4; }
    .status-dot.disconnected { background-color: #a44; }
    .status-dot.connecting { background-color: #aa4; }
    
    #theme-toggle {
      background: var(--btn-dark);
      color: var(--text-color);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      padding: 5px 12px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }
    #theme-toggle:active {
      background: var(--btn-light);
    }

    #root {
      width: 100%;
      box-sizing: border-box;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
  </style>
</head>
<body>
  <div id="header-container">
    <div id="status-header">
      <h1>ESP32 HID <span id="ws-status-dot" class="status-dot disconnected"></span></h1>
    </div>
    <button id="theme-toggle">☀️/🌙</button>
  </div>
  
  <div id="root">
    <h1>Loading HID Controller...</h1>
  </div>

<script>
  // ==========================================
  // THEME MANAGEMENT
  // ==========================================
  const themeToggle = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('esp_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  themeToggle.addEventListener('click', () => {
      const root = document.documentElement;
      const isDark = root.getAttribute('data-theme') === 'dark';
      const newTheme = isDark ? 'light' : 'dark';
      root.setAttribute('data-theme', newTheme);
      localStorage.setItem('esp_theme', newTheme);
  });

  // ==========================================
  // 1. ServiceManager Class
  // ==========================================
  class ServiceManager {
      constructor() {
          this.statusDot = document.getElementById('ws-status-dot');
          this.gateway = `ws://${window.location.hostname}:81/`;
          this.websocket = null;
          this.initWebSocket();
      }

      setStatus(status) {
          if (this.statusDot) this.statusDot.className = 'status-dot ' + status;
      }

      initWebSocket() {
          this.setStatus('connecting');
          this.websocket = new WebSocket(this.gateway);
          this.websocket.binaryType = "arraybuffer";
          this.websocket.onopen = this.onOpen.bind(this);
          this.websocket.onclose = this.onClose.bind(this);
          this.websocket.onmessage = this.onMessage.bind(this);
          this.websocket.onerror = this.onError.bind(this);
      }

  sendReset() {
      if (this.websocket && this.websocket.readyState === 1) {
          // 1. Release all 8 HID modifier keys (0xE0 to 0xE7)
          for (let code = 0xE0; code <= 0xE7; code++) {
              this.sendKey(code, "release");
          }
          // 2. Trigger Hardware Restart
          const buffer = new Uint8Array(1);
          buffer[0] = 0xFE;
          this.websocket.send(buffer);
      }
  }
      
      onOpen() { this.setStatus('connected'); }
      onClose() {
          this.setStatus('disconnected');
          setTimeout(() => this.initWebSocket(), 2000);
      }
      onError(event) { this.websocket.close(); }
      onMessage(event) { console.log("Msg: " + event.data); }
      
      sendCmd(opcode, value) {
          if (this.websocket && this.websocket.readyState === 1) {
              var buffer = new Uint8Array(2);
              buffer[0] = opcode;
              buffer[1] = value;
              this.websocket.send(buffer);
          }
      }

      sendMove(dx, dy) {
          if (this.websocket && this.websocket.readyState === 1) {
              const buffer = new ArrayBuffer(5);
              const view = new DataView(buffer);
              view.setUint8(0, 0x01);
              view.setInt16(1, dx, true);
              view.setInt16(3, dy, true);
              this.websocket.send(buffer);
          }
      }

      sendMoveAbsolute(x, y) {
          if (this.websocket && this.websocket.readyState === 1) {
              const buffer = new ArrayBuffer(5);
              const view = new DataView(buffer);
              view.setUint8(0, 0x02);
              view.setInt16(1, x, true);
              view.setInt16(3, y, true);
              this.websocket.send(buffer);
          }
      }

      sendButton(button, state) {
          let opcode;
          let value;
          const buttonMap = { "left": 1, "right": 2, "middle": 4 };
          value = buttonMap[button] || 1;
          if (state === "down") opcode = 0x21; 
          else if (state === "up") opcode = 0x22;
          else if (state === "click" || state === "send") opcode = 0x23;
          if (opcode) this.sendCmd(opcode, value);
      }
      
      sendTouchpadScroll(amount) {
          if (this.websocket && this.websocket.readyState === 1) {
              if (amount === 0) {
                  const buffer = new Uint8Array(1);
                  buffer[0] = 0x53; // OPCODE_SCROLL_END
                  this.websocket.send(buffer);
              } else {
                  const buffer = new ArrayBuffer(3);
                  const view = new DataView(buffer);
                  view.setUint8(0, 0x52); // OPCODE_SCROLL_TOUCHPAD
                  view.setInt16(1, amount, true);
                  this.websocket.send(buffer);
              }
          }
      }

      sendScrollWheel(amount) {
          this.sendTouchpadScroll(amount);
      }
      
      sendMediaKey(code, state) {
          if (this.websocket && this.websocket.readyState === 1) {
              const buffer = new Uint8Array(2);
              buffer[0] = (state === "press") ? 0x31 : 0x32;
              buffer[1] = code;
              this.websocket.send(buffer);
          }
      }

      sendKey(code, state) {
          if (this.websocket && this.websocket.readyState === 1) {
              let opcode;
              if (state === "press") opcode = 0x11;
              else if (state === "release") opcode = 0x12;
              else if (state === "send") opcode = 0x13;
              if (opcode) this.sendCmd(opcode, code);
          }
      }
      
      sendText(text) {
          if (this.websocket && this.websocket.readyState === 1) {
              const encoder = new TextEncoder();
              const encodedText = encoder.encode(text);
              const buffer = new Uint8Array(2 + encodedText.length);
              buffer[0] = 0x41; // OPCODE_TEXT_SEND
              buffer.set(encodedText, 1);
              buffer[buffer.length - 1] = 0; // Null terminator
              this.websocket.send(new Uint8Array(buffer).buffer);
          }
      }
  }

  // ==========================================
  // 2. GyroHandler Class (Hybrid Mode)
  // ==========================================
  class GyroHandler {
    constructor(serviceManager, config) {
      this.serviceManager = serviceManager;
      this.config = config;

      this.gyroRelativeActive = false;
      this.gyroAbsoluteActive = false;
      this.isCalibrated = false;
      this.calibrationStartTime = 0;
      this.calibrationDuration = 3000;
      this.calibrating = false;

      this.orientation = { x: 0, y: 0, z: 0 };
      this.lastOrientation = { x: null, y: null, z: null };
      this.originalCalibrateBtnIcon = "";

      this.bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
      this.smoothX = 0;
      this.smoothY = 0;
      this.smoothZ = 0;

      this.lastReadingTime = performance.now();
      this.readingCount = 0;
      this.measuredFrequency = 0.0;

      this.GAIN = config.gyroSensitivity ?? 8.0;
      this.SMOOTHING = config.smoothing ?? 0.2; 
      this.SUPPRESSION_OFFSET = config.suppression_offset ?? 20;
      this.suppressionEndTime = 0;

      this.sensor = null;
      this.usingModernAPI = false;
      this.isListening = false;

      this.updateInterval = setInterval(() => this.processLoop(), 10);
      this.loadCalibration();

      if (this.config.debug) {
          this.startListening();
      }
    }

    processLoop() {
      if (!this.gyroRelativeActive && !this.gyroAbsoluteActive) return;

      if (performance.now() < this.suppressionEndTime) {
        this.lastOrientation.x = this.orientation.x;
        this.lastOrientation.y = this.orientation.y;
        return;
      }

      if (this.gyroAbsoluteActive) {
        this.processAbsolute();
        return;
      }

      if (this.lastOrientation.x === null) {
        this.lastOrientation.x = this.orientation.x;
        this.lastOrientation.y = this.orientation.y;
        return;
      }

      let dX = this.orientation.x - this.lastOrientation.x;
      let dY = this.orientation.y - this.lastOrientation.y;

      if (dX > 180) dX -= 360;
      if (dX < -180) dX += 360;

      this.smoothX = (this.smoothX * this.SMOOTHING) + (dX * (1 - this.SMOOTHING));
      this.smoothY = (this.smoothY * this.SMOOTHING) + (dY * (1 - this.SMOOTHING));

      this.lastOrientation.x = this.orientation.x;
      this.lastOrientation.y = this.orientation.y;

      const moveX = this.smoothX * this.GAIN * -1;
      const moveY = this.smoothY * this.GAIN * -1;

      if (Math.abs(moveX) > 0.01 || Math.abs(moveY) > 0.01) {
        this.serviceManager.sendMove(Math.round(moveX * 10), Math.round(moveY * 10));
      }
    }

    processAbsolute() {
      if (!this.isCalibrated || this.calibrating) return;

      const targetMax = 32767;
      const absX = this.mapCircular(this.orientation.x, this.bounds.minX, this.bounds.maxX, targetMax);
      const absY = this.mapLinear(this.orientation.y, this.bounds.minY, this.bounds.maxY, targetMax);
      const invertedAbsX = targetMax - absX;
      const invertedAbsY = targetMax - absY;

      this.smoothX = (this.smoothX * 0.7) + (invertedAbsX * 0.3);
      this.smoothY = (this.smoothY * 0.7) + (invertedAbsY * 0.3);

      this.serviceManager.sendMoveAbsolute(Math.round(this.smoothX), Math.round(this.smoothY));
    }

    mapLinear(val, min, max, targetMax) {
      if (max === min) return targetMax / 2;
      const clampedVal = Math.max(min, Math.min(max, val));
      const ratio = (clampedVal - min) / (max - min);
      return Math.round(ratio * targetMax);
    }

    mapCircular(val, minBound, maxBound, targetMax) {
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

    recenter() {
      if (!this.isCalibrated) return;
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

    setGyroSuppression(ms) {
      this.suppressionEndTime = performance.now() + ms + this.SUPPRESSION_OFFSET;
    }

    startListening() {
      if (this.isListening) return;
      this.isListening = true;
      this.readingCount = 0;
      this.lastReadingTime = performance.now();

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
          this.updateDebug("Modern API (Waiting for data)");
          return;
        } catch (err) {
          console.warn("Modern Sensor API not available.", err);
        }
      }
      this.startLegacyListener();
    }
    
    startLegacyListener() {
      if (!this.isListening) return;
      this.usingModernAPI = false;
      this.readingCount = 0;
      this.lastReadingTime = performance.now();
      if (!this._boundHandler) {
          this._boundHandler = this.handleLegacyOrientation.bind(this);
          window.addEventListener("deviceorientation", this._boundHandler, true);
          this.updateDebug("Legacy API (Waiting for data)");
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

      const siny_cosp = 2 * (w * z + x * y);
      const cosy_cosp = 1 - 2 * (y * y + z * z);
      let alpha = Math.atan2(siny_cosp, cosy_cosp) * (180 / Math.PI);
      alpha = (alpha + 360) % 360;

      const sinr_cosp = 2 * (w * x + y * z);
      const cosr_cosp = 1 - 2 * (x * x + y * y);
      const beta = Math.atan2(sinr_cosp, cosr_cosp) * (180 / Math.PI); 

      const sinp = 2 * (w * y - z * x);
      let gamma;
      if (Math.abs(sinp) >= 1) gamma = (Math.sign(sinp) * Math.PI / 2) * (180 / Math.PI);
      else gamma = Math.asin(sinp) * (180 / Math.PI);

      this.orientation = { x: alpha, y: beta, z: gamma };
      if (this.calibrating) this.updateCalibrationBounds();
      this.updateDebug("Modern API");
    }

    handleLegacyOrientation(event) {
      this.measureFrequency();
      this.orientation = {
          x: event.alpha || 0,
          y: event.beta || 0,
          z: event.gamma || 0
      };
      if (this.calibrating) this.updateCalibrationBounds();
      this.updateDebug("Legacy API", event);
    }

    updateDebug(source, event = null) {
      if (!this.debugElem) return;
      let frequencyText = "Measuring...";
      if (this.measuredFrequency > 0) frequencyText = `${this.measuredFrequency.toFixed(1)} Hz`;
      
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

    async toggleGyroRelative() {
      if (this.gyroRelativeActive) {
        this.gyroRelativeActive = false;
        this.stopListening();
        return;
      }
      const granted = await this.requestPermission();
      if (granted) {
        this.gyroRelativeActive = true;
        this.smoothX = 0;
        this.smoothY = 0;
        this.lastOrientation.x = null;
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
        this.smoothX = 0;
        this.smoothY = 0;
        this.startListening();
      }
    }
    
    async requestPermission() {
      if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
        try { return (await DeviceOrientationEvent.requestPermission()) === "granted"; } 
        catch (error) { return false; }
      }
      return true;
    }

    saveCalibration() {
      localStorage.setItem('esp_mouse_gyro_bounds', JSON.stringify(this.bounds));
      this.isCalibrated = true;
    }

    loadCalibration() {
      const stored = localStorage.getItem('esp_mouse_gyro_bounds');
      if (stored) {
        this.bounds = JSON.parse(stored);
        this.isCalibrated = true;
      }
    }

    startCalibration(btn) {
      this.calibrating = true;
      this.isCalibrated = false;
      this.calibrateBtnElem = btn;
      this.originalCalibrateBtnIcon = btn.querySelector('.icon-placeholder')?.textContent || "⛶";
      btn.innerHTML = "0%";
      
      this.bounds.minX = this.orientation.x;
      this.bounds.maxX = this.orientation.x;
      this.bounds.minY = this.orientation.y;
      this.bounds.maxY = this.orientation.y;

      btn.style.background = "var(--error)";
      btn.style.color = "#fff";
      this.calibrationStartTime = performance.now();
      this.calTimer = setTimeout(() => this.finishCalibration(), 3000);
      
      if (this.debugElem) this.updateDebug("Calibrating...");
    }

    updateCalibrationBounds() {
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

    finishCalibration() {
      if (!this.calibrating) return;
      clearTimeout(this.calTimer);
      this.calibrating = false;
      this.saveCalibration();
      if (this.calibrateBtnElem) {
        this.calibrateBtnElem.style.background = "var(--btn-dark)";
        this.calibrateBtnElem.style.color = "var(--text-color)";
        if (this.originalCalibrateBtnIcon) {
          this.calibrateBtnElem.innerHTML = "";
          const icon = document.createElement("span");
          icon.className = "icon-placeholder";
          icon.textContent = this.originalCalibrateBtnIcon;
          icon.style.pointerEvents = "none";
          this.calibrateBtnElem.appendChild(icon);
        }
      }
      navigator.vibrate?.(100);
    }
  }

  // ==========================================
  // 3. TouchpadHandler Class
  // ==========================================
  class TouchpadHandler {
    constructor(serviceManager, gyroHandler, config) {
      this.serviceManager = serviceManager;
      this.gyroHandler = gyroHandler;
      this.config = config;
      
      this.floatDX = 0;
      this.floatDY = 0;
      
      // Momentum state
      this.velocityX = 0;
      this.velocityY = 0;
      this.lastTouchTime = 0;
      this.isTouchActive = false;

      this.TOUCH_GAIN = config.mouseSensitivity ?? 1.8;
      this.SCROLL_GAIN = config.scrollSensitivity ?? 3.0; 
      this.CLICK_DELAY = config.double_click_time ?? 250;
      this.HOLD_TIME = config.hold_time ?? 500;
      
      this.startFrameLoop();
    }

    startFrameLoop() {
      const frameLoop = () => {
        const dx = this.floatDX > 0 ? Math.floor(this.floatDX) : Math.ceil(this.floatDX);
        const dy = this.floatDY > 0 ? Math.floor(this.floatDY) : Math.ceil(this.floatDY);
        if (dx !== 0 || dy !== 0) {
          this.floatDX -= dx;
          this.floatDY -= dy;
          this.serviceManager.sendMove(dx, dy);
        }
        requestAnimationFrame(frameLoop);
      };
      requestAnimationFrame(frameLoop);
    }

    addMovement(dx, dy) {
      this.floatDX += dx;
      this.floatDY += dy;
    }

    runMomentum() {
      const friction = 0.92;
      const step = () => {
        if (this.isTouchActive) return; 

        const dx = this.velocityX * 16.6;
        const dy = this.velocityY * 16.6;

        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
          this.velocityX = 0;
          this.velocityY = 0;
          return;
        }

        this.addMovement(dx * this.TOUCH_GAIN, dy * this.TOUCH_GAIN);
        this.velocityX *= friction;
        this.velocityY *= friction;
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    setupPad(pad) {
      let tapCount = 0;
      let clickTimer = null;
      let holdTimer = null;
      let isDragging = false;
      let dragActive = false;
      let rightClickDone = false;
      let lastX = 0;
      let lastY = 0;

      const startTouch = (e) => {
        e.preventDefault();
        this.isTouchActive = true;
        this.velocityX = 0;
        this.velocityY = 0;

        this.gyroHandler.setGyroSuppression(400);
        
        const touch = e.touches[0];
        lastX = touch.clientX;
        lastY = touch.clientY;
        
        isDragging = false;
        rightClickDone = false;

        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
          tapCount++;
        } else {
          tapCount = 1;
        }

        holdTimer = setTimeout(() => {
          if (isDragging) return;

          if (tapCount === 1) {
            this.serviceManager.sendButton("right", "click");
            navigator.vibrate?.(50);
            rightClickDone = true;
          } else {
            if (!dragActive) {
              this.serviceManager.sendButton("left", "down");
              dragActive = true;
              navigator.vibrate?.(30);
            }
          }
        }, this.HOLD_TIME);
      };

      const moveTouch = (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const now = performance.now();
        const dt = now - this.lastTouchTime;

        const dx = touch.clientX - lastX;
        const dy = touch.clientY - lastY;
        
        if (isDragging && dt > 0) {
          const curVX = dx / dt;
          const curVY = dy / dt;
          this.velocityX = this.velocityX * 0.4 + curVX * 0.6;
          this.velocityY = this.velocityY * 0.4 + curVY * 0.6;
        }

        if (!isDragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
          isDragging = true;
          if (tapCount === 1) clearTimeout(holdTimer);
          if (tapCount > 1 && !dragActive) {
              clearTimeout(holdTimer);
              this.serviceManager.sendButton("left", "down");
              dragActive = true;
          }
        }

        if (isDragging) {
          lastX = touch.clientX;
          lastY = touch.clientY;
          this.addMovement(dx * this.TOUCH_GAIN, dy * this.TOUCH_GAIN);
        }
        this.lastTouchTime = now;
      };

      const endTouch = (e) => {
        e.preventDefault();
        this.isTouchActive = false;
        clearTimeout(holdTimer);

        const timeSinceLastMove = performance.now() - this.lastTouchTime;
        if (isDragging && !dragActive && timeSinceLastMove < 50) {
          this.runMomentum();
        }

        if (dragActive) {
          this.serviceManager.sendButton("left", "up");
          dragActive = false;
          tapCount = 0; 
          return;
        }

        if (rightClickDone) {
          tapCount = 0;
          return;
        }

        if (tapCount === 1 && isDragging) {
          tapCount = 0;
          return;
        }

        clickTimer = setTimeout(() => {
          for (let i = 0; i < tapCount; i++) {
              setTimeout(() => {
                  this.serviceManager.sendButton("left", "click");
              }, i * 50); 
          }
          tapCount = 0;
          clickTimer = null;
        }, this.CLICK_DELAY);
      };

      pad.addEventListener("touchstart", startTouch, { passive: false });
      pad.addEventListener("touchmove", moveTouch, { passive: false });
      pad.addEventListener("touchend", endTouch, { passive: false });
      pad.addEventListener("touchcancel", endTouch, { passive: false });
    }

    setupScrollArea(scrollArea) {
      let lastY = 0;
      let scrolling = false;
      let accumulatedScroll = 0;

      const startScroll = (e) => {
        e.preventDefault();
        scrolling = true;
        lastY = e.touches[0].clientY;
      };

      const moveScroll = (e) => {
        if (!scrolling) return;
        e.preventDefault();
        const currentY = e.touches[0].clientY;
        const delta = lastY - currentY;
        lastY = currentY;
        accumulatedScroll += delta;
        const scrollAmount = Math.floor(accumulatedScroll * this.SCROLL_GAIN);
        if (Math.abs(scrollAmount) >= 1) {
          this.serviceManager.sendTouchpadScroll(scrollAmount);
          accumulatedScroll -= scrollAmount / this.SCROLL_GAIN;
        }
      };

      const endScroll = (e) => {
        if (scrolling) {
          e.preventDefault();
          scrolling = false;
          accumulatedScroll = 0;
          this.serviceManager.sendTouchpadScroll(0);
        }
      };

      scrollArea.addEventListener("touchstart", startScroll, { passive: false });
      scrollArea.addEventListener("touchmove", moveScroll, { passive: false });
      scrollArea.addEventListener("touchend", endScroll, { passive: false });
      scrollArea.addEventListener("touchcancel", endScroll, { passive: false });
    }
  }

  // ==========================================
  // 4. UIBuilder Class
  // ==========================================
  class UIBuilder {
    constructor(config) {
      this.config = config;
      
      // Standalone text/unicode map for offline mdi: icons
      this.iconMap = {
        "mdi:chevron-up": "▲",
        "mdi:chevron-down": "▼",
        "mdi:ray-start-arrow": "↝",
        "mdi:bullseye": "☉",
        "mdi:border-radius": "⛶",
        "mdi:volume-minus": "-",
        "mdi:volume-plus": "+",
        "mdi:keyboard": "⌨",
        "mdi:arrow-right-thin": "→"
      };
    }

    createRoot() {
      const root = document.createElement("div");
      Object.assign(root.style, {
        background: "var(--card-bg)",
        borderRadius: "14px",
        border: "1px solid var(--border-color)",
        color: "var(--text-color)",
        padding: "10px",
        boxSizing: "border-box",
        boxShadow: "var(--box-shadow)"
      });
      return root;
    }

    createButton(textOrIcon, handler, fontSize = "18px") {
      const btn = document.createElement("button");
      Object.assign(btn.style, {
        display: "flex",              
        alignItems: "center",
        justifyContent: "center",
        padding: "10px 6px",
        borderRadius: "10px",
        background: "var(--btn-dark)",
        color: "var(--text-color)",
        border: "1px solid var(--border-color)",
        fontSize: fontSize,
        cursor: "pointer",
        transition: "background 0.15s, color 0.15s",
        outline: "none",                        
        webkitTapHighlightColor: "transparent", 
        touchAction: "manipulation",            
        overflow: "hidden"                      
      });

      if (textOrIcon.startsWith("mdi:")) {
        const icon = document.createElement("span");
        icon.className = "icon-placeholder";
        icon.textContent = this.iconMap[textOrIcon] || "•";
        icon.style.pointerEvents = "none";
        icon.style.fontSize = fontSize;
        btn.appendChild(icon);
      } else {
        btn.textContent = textOrIcon;
      }

      const setBg = (color) => { btn.style.background = color; };
      btn.addEventListener("pointerdown", () => setBg("var(--btn-light)"));
      btn.addEventListener("pointerup", () => setBg("var(--btn-dark)"));
      btn.addEventListener("pointerleave", () => setBg("var(--btn-dark)"));

      if (handler) btn.addEventListener("click", handler);
      return btn;
    }

    setupDesktopLayout(root, serviceManager) {
      let isLocked = false;
      Object.assign(root.style, {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        position: "relative",
        background: "var(--card-bg)",
        transition: "background 0.3s",
        overflow: "hidden"
      });

      const overlay = document.createElement("div");
      overlay.innerHTML = "Click to Lock System<br><small style='font-size: 0.7em; opacity: 0.7;'>Exit: Escape</small>";
      Object.assign(overlay.style, {
        textAlign: "center", pointerEvents: "none", userSelect: "none"
      });
      root.appendChild(overlay);

      const decoyInput = document.createElement("input");
      decoyInput.type = "text";
      Object.assign(decoyInput.style, { position: "absolute", opacity: 0, pointerEvents: "none", zIndex: -1 });
      root.appendChild(decoyInput);

      // Bind Reset to Status Dot for Desktop
      const statusDot = document.getElementById('ws-status-dot');
      if (statusDot) statusDot.addEventListener('mousedown', (e) => { e.stopPropagation(); serviceManager.sendReset(); });

      const handleKey = (e, mode) => {
        if (!isLocked) return;
        
        // Allow Escape to propagate for native browser unlock
        if (e.key === 'Escape') return;

        e.preventDefault();
        e.stopPropagation(); e.stopImmediatePropagation();

        if (mode === "press" && e.repeat) return;

        let hidCode = this.getHIDKeycode(e.key, e.code);
        
        // Robust Dead Key / Composer Handling
        const isDeadKey = e.key === "Dead" && (e.code === "Equal" || e.code === "Backquote");
        if (isDeadKey || e.key === "´" || e.key === "´´") hidCode = 227; // Meta/Cmd mapping for dead key triggers

        if (!hidCode && e.code.startsWith('Key')) hidCode = e.code.charCodeAt(3) - 65 + 4;
        if (!hidCode && e.code.startsWith('Digit')) {
          const d = parseInt(e.code.slice(-1));
          hidCode = d === 0 ? 39 : d + 29;
        }

        const symbolMap = {
          Space: 44, Minus: 45, Equal: 46, BracketLeft: 47, BracketRight: 48,
          Backslash: 49, Semicolon: 51, Quote: 52, Backquote: 53, Comma: 54, 
          Period: 55, Slash: 56, CapsLock: 57, Tab: 43, Escape: 41
        };
        if (!hidCode) hidCode = symbolMap[e.code];

        const modMap = { 
          ControlLeft: 224, ShiftLeft: 225, AltLeft: 226, MetaLeft: 227, 
          ControlRight: 228, ShiftRight: 229, AltRight: 230 
        };
        if (!hidCode) hidCode = modMap[e.code];

        if (hidCode) serviceManager.sendKey(hidCode, mode);
      };

      const onKeyDown = (e) => handleKey(e, "press");
      const onKeyUp = (e) => handleKey(e, "release");
      const blockScroll = (e) => { if (isLocked) e.preventDefault(); };
      
      const onPointerMove = (e) => {
        if (isLocked && document.pointerLockElement) {
          serviceManager.sendMove(e.movementX || 0, e.movementY || 0);
        }
      };

      const syncLockState = () => {
        if (document.pointerLockElement === root) {
          isLocked = true;
          overlay.textContent = "System Locked. Escape to Exit";
          root.style.background = "var(--trackpad-bg)";
          root.style.cursor = "none";
          decoyInput.focus();
          window.addEventListener("keydown", onKeyDown, true);
          window.addEventListener("keyup", onKeyUp, true);
          window.addEventListener("wheel", blockScroll, { passive: false });
          document.addEventListener("pointermove", onPointerMove, { capture: true });
        } else {
          isLocked = false;
          overlay.innerHTML = "Click to Lock System<br><small style='font-size: 0.7em; opacity: 0.7;'>Exit: Escape</small>";
          root.style.background = "var(--card-bg)";
          root.style.cursor = "pointer";
          decoyInput.blur();
          window.removeEventListener("keydown", onKeyDown, true);
          window.removeEventListener("keyup", onKeyUp, true);
          window.removeEventListener("wheel", blockScroll);
          document.removeEventListener("pointermove", onPointerMove, { capture: true });
        }
      };

      document.addEventListener("pointerlockchange", syncLockState);

      root.addEventListener("pointerdown", (e) => {
        if (!isLocked) {
          root.requestPointerLock();
          e.preventDefault();
        } else {
          const btnMap = { 0: "left", 1: "middle", 2: "right" };
          const btnName = btnMap[e.button] || "left";
          
          serviceManager.sendButton(btnName, "down");
          
          // CRITICAL: Prevent OS from intercepting delta when mouse hits screen edge during drag
          if (e.pointerId !== undefined) { 
            try { root.releasePointerCapture(e.pointerId); } catch(err) {} 
          }
          e.preventDefault();
        }
      });

      root.addEventListener("pointerup", (e) => {
        if (isLocked) {
          const btnMap = { 0: "left", 1: "middle", 2: "right" };
          serviceManager.sendButton(btnMap[e.button] || "left", "up");
          e.preventDefault();
        }
      });

      root.addEventListener("wheel", (e) => {
        if (!isLocked) return;
        e.preventDefault();
        serviceManager.sendScrollWheel(Math.sign(e.deltaY) * -1);
      }, { passive: false });

      root.addEventListener("auxclick", (e) => { if (isLocked) e.preventDefault(); });

      root.addEventListener("contextmenu", (e) => { if (isLocked) e.preventDefault(); });
    }

    setupMobileLayout(root, touchpadHandler, gyroHandler) {
      let expanded = false;
      const updateLayout = () => {
        expandedArea.style.display = expanded ? "flex" : "none";
        expandBtn.innerHTML = "";
        const icon = document.createElement("span");
        icon.className = "icon-placeholder";
        icon.textContent = expanded ? this.iconMap["mdi:chevron-down"] : this.iconMap["mdi:chevron-up"];
        icon.style.pointerEvents = "none";
        icon.style.fontSize = "14px";
        expandBtn.appendChild(icon);
      };

      Object.assign(root.style, { display: "flex", flexDirection: "column" });

      const topArea = document.createElement("div");
      Object.assign(topArea.style, {
        display: "flex", height: "220px", width: "100%",
        borderRadius: "10px", overflow: "hidden",
        border: "1px solid var(--border-color)",
      });

      const pad = document.createElement("div");
      Object.assign(pad.style, {
        flex: "1", background: "var(--trackpad-bg)", display: "flex",
        alignItems: "center", justifyContent: "center", fontSize: "15px", touchAction: "none", 
      });
      pad.textContent = "Touchpad";

      const divider = document.createElement("div");
      Object.assign(divider.style, { width: "1px", background: "var(--divider)" });

      const scrollArea = document.createElement("div");
      Object.assign(scrollArea.style, {
        width: "56px", background: "var(--trackpad-bg)", display: "flex",
        alignItems: "center", justifyContent: "center", fontSize: "18px", touchAction: "none",
      });
      scrollArea.textContent = "☰";

      topArea.appendChild(pad); topArea.appendChild(divider); topArea.appendChild(scrollArea);
      root.appendChild(topArea);

      const buttonRow1 = document.createElement("div");
      Object.assign(buttonRow1.style, {
        display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "6px", marginTop: "10px",
      });

      const expandBtn = this.createButton("mdi:chevron-up", null, "14px"); 
      const gyroRelBtn = this.createButton("mdi:ray-start-arrow", () => {
          gyroHandler.toggleGyroRelative().then(() => {
              if (gyroHandler.gyroRelativeActive) {
                  gyroRelBtn.style.background = "var(--primary)";
                  gyroRelBtn.style.color = "#fff";
              } else {
                  gyroRelBtn.style.background = "var(--btn-dark)";
                  gyroRelBtn.style.color = "var(--text-color)";
              }
          });
      });
      const gyroAbsBtn = this.createButton("mdi:bullseye", () => {
          gyroHandler.toggleGyroAbsolute().then(() => {
              if (gyroHandler.gyroAbsoluteActive) {
                  gyroAbsBtn.style.background = "var(--primary)";
                  gyroAbsBtn.style.color = "#fff";
              } else {
                  gyroAbsBtn.style.background = "var(--btn-dark)";
                  gyroAbsBtn.style.color = "var(--text-color)";
              }
          });
      });
      const calibrateBtn = this.createButton("mdi:border-radius", () => {
          if (gyroHandler.calibrating) gyroHandler.finishCalibration();
          else if (gyroHandler.gyroAbsoluteActive) gyroHandler.recenter();
          else gyroHandler.startCalibration(calibrateBtn);
      }); 
      const volDownBtn = this.createButton("mdi:volume-minus");
      const volUpBtn = this.createButton("mdi:volume-plus");

      gyroHandler.gyroRelBtn = gyroRelBtn;
      gyroHandler.gyroAbsBtn = gyroAbsBtn;
      if (gyroHandler.isCalibrated) calibrateBtn.style.background = "var(--btn-dark)";

      const volHandler = (btn, code) => {
        btn.addEventListener("touchstart", (e) => {
          e.preventDefault(); touchpadHandler.serviceManager.sendMediaKey(code, "press");
        });
        btn.addEventListener("touchend", (e) => {
          e.preventDefault(); touchpadHandler.serviceManager.sendMediaKey(code, "release");
        });
        btn.addEventListener("touchcancel", (e) => {
          e.preventDefault(); touchpadHandler.serviceManager.sendMediaKey(code, "release");
        });
      };
      volHandler(volDownBtn, 0xEA); volHandler(volUpBtn, 0xE9);

      buttonRow1.append(expandBtn, gyroRelBtn, gyroAbsBtn, calibrateBtn, volDownBtn, volUpBtn);
      root.appendChild(buttonRow1);

      const expandedArea = document.createElement("div");
      Object.assign(expandedArea.style, {
        display: "none", flexDirection: "column", gap: "10px", marginTop: "10px",
      });
      expandBtn.addEventListener("click", () => {
        expanded = !expanded; updateLayout();
      });

      const textRow = document.createElement("div");
      Object.assign(textRow.style, { display: "flex", gap: "6px", alignItems: "center" });

      const liveWrapper = document.createElement("div");
      Object.assign(liveWrapper.style, { position: "relative", width: "15%" });
      
      const ANCHOR = " "; 
      this.lastInputValue = ANCHOR;
      const liveInput = document.createElement("input");
      liveInput.type = "password"; 
      liveInput.autocomplete = "off"; liveInput.autocorrect = "off";
      liveInput.autocapitalize = "off"; liveInput.spellcheck = false;
      liveInput.value = ANCHOR;

      Object.assign(liveInput.style, {
        width: "100%", padding: "10px", borderRadius: "10px",
        background: "var(--trackpad-bg)", border: "1px solid var(--border-color)",
        color: "transparent", fontSize: "14px", position: "relative",
        paddingInline: "0", textAlign: "center"
      });

      const liveInputOverlay = document.createElement("div");
      Object.assign(liveInputOverlay.style, {
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        pointerEvents: "none", zIndex: "1", color: "var(--text-color)",
        display: "flex", alignItems: "center", justifyContent: "center"
      });
      const kbIcon = document.createElement("span");
      kbIcon.textContent = this.iconMap["mdi:keyboard"];
      kbIcon.style.fontSize = "18px"; 
      liveInputOverlay.appendChild(kbIcon);

      liveWrapper.appendChild(liveInput); liveWrapper.appendChild(liveInputOverlay);

      const ensureCursorAtEnd = () => {
        try { const len = liveInput.value.length; liveInput.setSelectionRange(len, len); } catch(e){}
      };
      liveInput.addEventListener("focus", ensureCursorAtEnd);
      liveInput.addEventListener("click", ensureCursorAtEnd);
      liveInput.addEventListener("touchend", ensureCursorAtEnd);
      
      liveInput.addEventListener("input", (e) => {
        const val = liveInput.value;
        const prev = this.lastInputValue;
        const diff = val.length - prev.length;
        
        if (val.length < ANCHOR.length) {
           touchpadHandler.serviceManager.sendKey(42, "send"); 
           setTimeout(() => {
               liveInput.value = ANCHOR; this.lastInputValue = ANCHOR; ensureCursorAtEnd();
           }, 0);
           return;
        }
        if (diff > 0) {
            const added = val.slice(prev.length);
            if (added) touchpadHandler.serviceManager.sendText(added);
        } else if (diff < 0) {
            const absDiff = Math.abs(diff);
            for(let i=0; i<absDiff; i++) {
              touchpadHandler.serviceManager.sendKey(42, "send");
            }
        }
        this.lastInputValue = val;
        if (val.length > 30) {
            setTimeout(() => {
                liveInput.value = ANCHOR; this.lastInputValue = ANCHOR; ensureCursorAtEnd();
            }, 0);
        }
      });
      
      liveInput.addEventListener("blur", () => {
          liveInput.value = ANCHOR; this.lastInputValue = ANCHOR;
      });
      liveInput.addEventListener("keydown", (e) => {
        const specialKeys = ["Enter", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", 
                              "Home", "End", "PageUp", "PageDown", "Delete", "Tab"];
        if (specialKeys.includes(e.key)) {
          e.preventDefault();
          const code = this.getHIDKeycodeFromEvent(e);
          if (code) touchpadHandler.serviceManager.sendKey(code, "send");
        }
      });

      const textInput = document.createElement("input");
      textInput.type = "text"; textInput.placeholder = "Enter text...";
      Object.assign(textInput.style, {
        flex: "1", padding: "10px", borderRadius: "10px", background: "var(--trackpad-bg)",
        border: "1px solid var(--border-color)", color: "var(--text-color)", fontSize: "14px",
      });
      textInput.addEventListener("keydown", (e) => e.stopPropagation());
      textInput.addEventListener("keyup", (e) => e.stopPropagation());

      const sendTextBtn = this.createButton("mdi:arrow-right-thin", () => {
        const text = textInput.value;
        if (text) {
          touchpadHandler.serviceManager.sendText(text); textInput.value = "";
        } else {
          touchpadHandler.serviceManager.sendKey(40, "send");
        }
      });
      Object.assign(sendTextBtn.style, { width: "15%" });

      textRow.append(liveWrapper, textInput, sendTextBtn);
      expandedArea.appendChild(textRow);

      const modifierRow = document.createElement("div");
      Object.assign(modifierRow.style, { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" });
      const modifierState = { ctrl: false, alt: false, shift: false };
      
      [ ["Ctrl", 0xE0], ["Alt", 0xE2], ["Shift", 0xE1] ].forEach(([label, code]) => {
        const b = this.createButton(label, () => {
          const key = label.toLowerCase();
          modifierState[key] = !modifierState[key];
          if (modifierState[key]) {
              b.style.background = "var(--primary)"; b.style.color = "#fff";
          } else {
              b.style.background = "var(--btn-dark)"; b.style.color = "var(--text-color)";
          }
          touchpadHandler.serviceManager.sendKey(code, modifierState[key] ? "press" : "release");
        }, "14px");
        modifierRow.appendChild(b);
      });
      const escBtn = this.createButton("ESC", () => {
        touchpadHandler.serviceManager.sendKey(41, "send");
        navigator.vibrate?.(30);
      }, "14px");
      modifierRow.appendChild(escBtn);
      expandedArea.appendChild(modifierRow);
      
      if (this.config.debug) {
          const debugRow = document.createElement("div");
          Object.assign(debugRow.style, {
              marginTop: "10px", padding: "8px", background: "rgba(0,0,0,0.1)",
              borderRadius: "4px", fontFamily: "monospace", fontSize: "11px",
              lineHeight: "1.4", color: "var(--text-muted)", whiteSpace: "pre-wrap",
              textAlign: "left"
          });
          debugRow.textContent = "Waiting for sensor data...";
          gyroHandler.debugElem = debugRow;
          expandedArea.appendChild(debugRow);
      }

      root.appendChild(expandedArea);
      touchpadHandler.setupPad(pad);
      touchpadHandler.setupScrollArea(scrollArea);
    }

    getHIDKeycodeFromEvent(e) {
      const k = e.key;
      const map = {
        Enter: 40, Escape: 41, Backspace: 42, Tab: 43,
        Delete: 76, Home: 74, End: 77, PageUp: 75, PageDown: 78,
        ArrowRight: 0x4F, ArrowLeft: 0x50, ArrowDown: 0x51, ArrowUp: 0x52
      };
      return map[k] || null;
    }
    
    getHIDKeycode(key, code) {
      return this.getHIDKeycodeFromEvent({ key, code });
    }
  }

  // ==========================================
  // 5. Initialization
  // ==========================================
  window.addEventListener('load', () => {
    const serviceManager = new ServiceManager();
    const config = {
        mouseSensitivity: 1.8,
        scrollSensitivity: 3.0,
        gyroSensitivity: 8.0,
        smoothing: 0.2,
        suppression_offset: 20,
        double_click_time: 250,
        hold_time: 500,
        debug: true // set to false to hide the debug panel
    };

    const gyroHandler = new GyroHandler(serviceManager, config);
    const touchpadHandler = new TouchpadHandler(serviceManager, gyroHandler, config);
    gyroHandler.touchpadHandler = touchpadHandler;

    const uiBuilder = new UIBuilder(config);
    const rootElement = document.getElementById('root');
    rootElement.innerHTML = ''; 

    const isMobile = window.matchMedia("only screen and (max-width: 760px)").matches;
    if (isMobile) {
        uiBuilder.setupMobileLayout(rootElement, touchpadHandler, gyroHandler);
        // Add Reset to Status Dot
        const statusDot = document.getElementById('ws-status-dot');
        if (statusDot) {
            statusDot.style.cursor = "pointer";
            statusDot.addEventListener('touchstart', (e) => {
                serviceManager.sendReset();
            });
        }
    } else {
        uiBuilder.setupDesktopLayout(rootElement, serviceManager);
    }
  });

</script>
</body>
</html>
)rawliteral";

#endif