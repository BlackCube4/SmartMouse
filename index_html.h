const char* INDEX_HTML = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <title>ESP32 S3 HID</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta charset="UTF-8">

  <style>
    /* Basis-Styles für die gesamte Seite, der Rest wird von UIBuilder.js verwaltet */
    body { 
      font-family: 'Inter', sans-serif; 
      text-align: center; 
      margin: 0; 
      padding: 10px; /* Leichtes Padding für den Header */
      background-color: #f4f4f4; 
    }
    
    /* Header Style */
    #status-header {
        margin-bottom: 10px;
    }
    #status-header h1 {
      font-size: 18px;
      color: #333; /* Dunkler Text für besseren Kontrast */
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    /* Status Dot */
    .status-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-left: 8px;
      transition: background-color 0.3s;
    }

    .status-dot.connected {
      background-color: #4a4; /* Grün */
    }

    .status-dot.disconnected {
      background-color: #a44; /* Rot */
    }

    .status-dot.connecting {
      background-color: #aa4; /* Gelb */
    }
    
    /* Root der Card */
    #root {
      width: 100%;
      min-height: 100vh;
      box-sizing: border-box;
    }
  </style>
</head>


<body>
  <div id="status-header">
    <h1>ESP32 S3 HID <span id="ws-status-dot" class="status-dot disconnected"></span></h1>
  </div>
  
  <div id="root">
    <h1>Loading HID Controller...</h1>
  </div>


<script>

  // -------------------------------------------------------------------------
  // 1. ServiceManager Class (Übernimmt WebSocket-Kommunikation)
  // -------------------------------------------------------------------------
  class ServiceManager {
      constructor() {
          this.statusDot = document.getElementById('ws-status-dot');
          this.gateway = `ws://${window.location.hostname}:81/`;
          this.websocket = null;
          this.initWebSocket();
      }

      setStatus(status) {
          if (this.statusDot) {
              this.statusDot.className = 'status-dot ' + status;
          }
      }

      initWebSocket() {
          console.log('Trying to open a WebSocket connection...');
          this.setStatus('connecting'); // Setze Status auf Gelb
          this.websocket = new WebSocket(this.gateway);
          this.websocket.binaryType = "arraybuffer";
          this.websocket.onopen = this.onOpen.bind(this);
          this.websocket.onclose = this.onClose.bind(this);
          this.websocket.onmessage = this.onMessage.bind(this);
          this.websocket.onerror = this.onError.bind(this); // Optional: Fehlerbehandlung
      }
      
      onOpen() {
          console.log('Connection opened');
          this.setStatus('connected'); // Setze Status auf Grün
      }

      onClose() {
          console.log('Connection closed');
          this.setStatus('disconnected'); // Setze Status auf Rot
          setTimeout(() => this.initWebSocket(), 2000);
      }
      
      onError(event) {
          console.error("WebSocket Error:", event);
          this.websocket.close();
      }

      onMessage(event) {
          console.log("Message from server: " + event.data);
      }
      
      // Allgemeine Send-Funktion für 2-Byte-Befehle
      sendCmd(opcode, value) {
          if (this.websocket && this.websocket.readyState === 1) {
              var buffer = new Uint8Array(2);
              buffer[0] = opcode;
              buffer[1] = value;
              this.websocket.send(buffer);
          }
      }

      // ---------------------------------------------------------------------
      // Funktionen, die von UIBuilder/TouchpadHandler aufgerufen werden
      // (OpCodes müssen mit dem ESP32-Backend übereinstimmen)
      // ---------------------------------------------------------------------
      
      // RELATIVE MOUSE MOVE (OpCode: 0x01, 5 Bytes: [0x01, dx_L, dx_H, dy_L, dy_H])
      sendMove(dx, dy) {
          if (this.websocket && this.websocket.readyState === 1) {
              const buffer = new ArrayBuffer(5);
              const view = new DataView(buffer);
              view.setUint8(0, 0x01); // RELATIVE MOUSE MOVE
              view.setInt16(1, dx, true);
              view.setInt16(3, dy, true);
              this.websocket.send(buffer);
          }
      }

      // ABSOLUTE MOUSE MOVE (OpCode: 0x02, 5 Bytes: [0x02, x_L, x_H, y_L, y_H]) - Beispiel
      sendMoveAbsolute(x, y) {
          if (this.websocket && this.websocket.readyState === 1) {
              const buffer = new ArrayBuffer(5);
              const view = new DataView(buffer);
              view.setUint8(0, 0x02); // Beispiel: ABSOLUTE MOUSE MOVE
              view.setInt16(1, x, true);
              view.setInt16(3, y, true);
              this.websocket.send(buffer);
          }
      }

      // MOUSE BUTTON (OpCodes: 0x21/0x22/0x23)
      sendButton(button, state) {
          let opcode;
          let value;
          
          const buttonMap = { "left": 1, "right": 2, "middle": 4 };
          value = buttonMap[button] || 1;
          
          if (state === "down") opcode = 0x21; 
          else if (state === "up") opcode = 0x22; 
          else if (state === "click" || state === "send") opcode = 0x23;

          if (opcode) {
              this.sendCmd(opcode, value);
          }
      }
      
      // SCROLL / WHEEL (OpCode: 0x51, 3 Bytes: [0x51, steps_L, steps_H])
      sendTouchpadScroll(amount) {
           this.sendScrollWheel(amount);
      }
      
      sendScrollWheel(amount) {
           if (this.websocket && this.websocket.readyState === 1) {
              const buffer = new ArrayBuffer(3);
              const view = new DataView(buffer);
              view.setUint8(0, 0x51); // LOW RES SCROLL
              view.setInt16(1, amount, true);
              this.websocket.send(buffer);
           }
      }
      
      // MEDIA KEY (OpCodes: 0x31/0x32, 2 Bytes: [OpCode, KeyCode]) - Beispiel
      sendMediaKey(code, state) {
          if (this.websocket && this.websocket.readyState === 1) {
              const buffer = new Uint8Array(2);
              buffer[0] = (state === "press") ? 0x31 : 0x32; // Beispiel: MEDIA KEY PRESS/RELEASE
              buffer[1] = code;
              this.websocket.send(buffer);
          }
      }

      // KEY (OpCodes: 0x11/0x12/0x13, 2 Bytes: [OpCode, KeyCode])
      sendKey(code, state) {
          if (this.websocket && this.websocket.readyState === 1) {
              let opcode;
              if (state === "press") opcode = 0x11;
              else if (state === "release") opcode = 0x12;
              else if (state === "send") opcode = 0x13; // press + release
              
              if (opcode) {
                  this.sendCmd(opcode, code);
              }
          }
      }
      
      // TEXT (OpCode: 0x41, N Bytes: [0x41, char1, char2, ...]) - Beispiel
      sendText(text) {
          if (this.websocket && this.websocket.readyState === 1) {
              const buffer = new ArrayBuffer(1 + text.length);
              const view = new DataView(buffer);
              view.setUint8(0, 0x41); // Beispiel: TEXT INPUT
              for (let i = 0; i < text.length; i++) {
                  view.setUint8(1 + i, text.charCodeAt(i));
              }
              this.websocket.send(buffer);
          }
      }
  }

  // -------------------------------------------------------------------------
  // 2. GyroHandler Class (Übernommen aus gyro-handler.js)
  // -------------------------------------------------------------------------
  class GyroHandler {
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
        this.calibrateBtn.textContent = "⊕";
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


  // -------------------------------------------------------------------------
  // 3. TouchpadHandler Class (Übernommen aus touchpad-handler.js)
  // -------------------------------------------------------------------------
  class TouchpadHandler {
    constructor(serviceManager, gyroHandler, config) {
      this.serviceManager = serviceManager;
      this.gyroHandler = gyroHandler;
      this.config = config;
      
      this.floatDX = 0;
      this.floatDY = 0;
      this.dragging = false;
      this.doubleTapDragging = false;
      this.waitingForSecondTap = false;
      
      // Constants
      this.TOUCH_GAIN = config.touch_gain ?? 1.8;
      this.TAP_THRESHOLD = 200;
      this.HOLD_THRESHOLD = 500;
      this.DOUBLE_TAP_THRESHOLD = 300;
      this.DOUBLE_CLICK_DELAY = 50;
      
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

    setupPad(pad) {
      let lastX = 0;
      let lastY = 0;
      let touchStartTime = 0;
      let lastTapTime = 0;
      let holdTimer = null;
      let singleTapTimer = null;

      const startTouch = (e) => {
        e.preventDefault();
        
        // Immediately suppress gyro
        this.gyroHandler.setGyroSuppression(400);
        
        const touch = e.touches[0];
        lastX = touch.clientX;
        lastY = touch.clientY;
        touchStartTime = Date.now();

        const timeSinceLastTap = Date.now() - lastTapTime;

        if (this.waitingForSecondTap && timeSinceLastTap < this.DOUBLE_TAP_THRESHOLD) {
          clearTimeout(singleTapTimer);
          this.waitingForSecondTap = false;
          this.doubleTapDragging = true;
          this.serviceManager.sendButton("left", "down");
          navigator.vibrate?.(30);
          return;
        }

        holdTimer = setTimeout(() => {
          if (!this.dragging && !this.doubleTapDragging) {
            this.serviceManager.sendButton("right", "click");
            navigator.vibrate?.(50);
            this.waitingForSecondTap = false;
            clearTimeout(singleTapTimer);
          }
        }, this.HOLD_THRESHOLD);
      };

      const moveTouch = (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const dx = touch.clientX - lastX;
        const dy = touch.clientY - lastY;

        if (!this.dragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
          clearTimeout(holdTimer);
          this.dragging = true;
          this.waitingForSecondTap = false;
          clearTimeout(singleTapTimer);
        }

        if (this.dragging || this.doubleTapDragging) {
          lastX = touch.clientX;
          lastY = touch.clientY;
          this.addMovement(dx * this.TOUCH_GAIN, dy * this.TOUCH_GAIN);
        }
      };

      const endTouch = (e) => {
        e.preventDefault();
        clearTimeout(holdTimer);

        const touchDuration = Date.now() - touchStartTime;
        const timeSinceLastTap = Date.now() - lastTapTime;

        if (this.doubleTapDragging) {
          this.serviceManager.sendButton("left", "up");
          this.doubleTapDragging = false;
          this.dragging = false;
          return;
        }

        if (!this.dragging && touchDuration < this.TAP_THRESHOLD) {
          const now = Date.now();
          
          if (this.waitingForSecondTap && timeSinceLastTap < this.DOUBLE_TAP_THRESHOLD) {
            clearTimeout(singleTapTimer);
            this.waitingForSecondTap = false;
            
            this.serviceManager.sendButton("left", "click");
            setTimeout(() => {
              this.serviceManager.sendButton("left", "click");
            }, this.DOUBLE_CLICK_DELAY);
            
            navigator.vibrate?.(40);
            lastTapTime = 0;
          } else {
            lastTapTime = now;
            this.waitingForSecondTap = true;
            
            singleTapTimer = setTimeout(() => {
              if (this.waitingForSecondTap) {
                this.serviceManager.sendButton("left", "click");
                navigator.vibrate?.(20);
                this.waitingForSecondTap = false;
              }
            }, this.DOUBLE_TAP_THRESHOLD);
          }
        }

        this.dragging = false;
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

        const scrollAmount = Math.floor(accumulatedScroll * 3);
        if (Math.abs(scrollAmount) >= 1) {
          this.serviceManager.sendTouchpadScroll(scrollAmount);
          accumulatedScroll -= scrollAmount / 3;
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


  // -------------------------------------------------------------------------
  // 4. UIBuilder Class (Übernommen aus ui-builder.js)
  // -------------------------------------------------------------------------
  class UIBuilder {
    constructor(config) {
      this.config = config;
    }

    createRoot() {
      const root = document.createElement("div");
      Object.assign(root.style, {
        background: "#1e1f22",
        borderRadius: "14px",
        border: "1px solid #2b2c2f",
        color: "#fff",
        userSelect: "none",
        touchAction: "none",
        padding: "10px",
        fontFamily: "Inter, sans-serif",
        boxSizing: "border-box",
      });
      return root;
    }

    createButton(text, handler, fontSize = "13px") {
      const btn = document.createElement("button");
      btn.textContent = text;

      Object.assign(btn.style, {
        padding: "10px 6px",
        borderRadius: "10px",
        background: "#2b2c2f",
        color: "#fff",
        border: "1px solid #323337",
        fontSize: fontSize,
        cursor: "pointer",
        transition: "background 0.15s",
      });

      btn.addEventListener("pointerdown", () => {
        btn.style.background = "#3a3b3f";
      });
      btn.addEventListener("pointerup", () => {
        btn.style.background = "#2b2c2f";
      });

      if (handler) btn.addEventListener("click", handler);
      return btn;
    }

    setupDesktopLayout(root, serviceManager) {
      Object.assign(root.style, {
        height: "400px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "crosshair",
        background: "#1b1c1f",
      });

      const overlay = document.createElement("div");
      overlay.textContent = "Hover to control";
      Object.assign(overlay.style, {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "18px",
        opacity: "0.5",
      });
      root.appendChild(overlay);

      let isActive = false;

      const handleMouseMove = (e) => {
        if (!isActive) return;
        const dx = e.movementX;
        const dy = e.movementY;
        if (dx || dy) serviceManager.sendMove(dx, dy);
      };

      const btnMap = { 0: "left", 1: "middle", 2: "right" };

      root.addEventListener("mouseenter", () => {
        isActive = true;
        overlay.textContent = "Controlling (ESC to release)";
        root.style.background = "#232427";
      });

      root.addEventListener("mouseleave", () => {
        isActive = false;
        overlay.textContent = "Hover to control";
        root.style.background = "#1b1c1f";
      });

      root.addEventListener("mousemove", handleMouseMove);
      root.addEventListener("mousedown", (e) => {
        if (!isActive) return;
        e.preventDefault();
        serviceManager.sendButton(btnMap[e.button] || "left", "down");
      });
      root.addEventListener("mouseup", (e) => {
        if (!isActive) return;
        e.preventDefault();
        serviceManager.sendButton(btnMap[e.button] || "left", "up");
      });
      root.addEventListener("wheel", (e) => {
        if (!isActive) return;
        e.preventDefault();
        serviceManager.sendScrollWheel(Math.sign(e.deltaY) * -1);
      }, { passive: false });

      root.tabIndex = 0;
      root.addEventListener("keydown", (e) => {
        if (!isActive) return;
        e.preventDefault();
        const key = this.getHIDKeycode(e.key, e.code);
        if (key) serviceManager.sendKey(key, "press");
      });
      root.addEventListener("keyup", (e) => {
        if (!isActive) return;
        e.preventDefault();
        const key = this.getHIDKeycode(e.key, e.code);
        if (key) serviceManager.sendKey(key, "release");
      });
    }

    setupMobileLayout(root, touchpadHandler, gyroHandler) {
      let expanded = false;

      const updateLayout = () => {
        expandedArea.style.display = expanded ? "flex" : "none";
        // FIX: Ersetze problematisches Symbol ⮟ (Collapse) durch ▼
        expandBtn.textContent = expanded ? "▼" : "▲"; 
      };

      Object.assign(root.style, {
        display: "flex",
        flexDirection: "column",
      });

      // TRACKPAD + SCROLLBAR ----------------------------------------------------
      const topArea = document.createElement("div");
      Object.assign(topArea.style, {
        display: "flex",
        height: "220px",
        width: "100%",
        borderRadius: "10px",
        overflow: "hidden",
      });

      const pad = document.createElement("div");
      Object.assign(pad.style, {
        flex: "1",
        background: "#2a2b2e",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "15px",
      });
      pad.textContent = "Touchpad";

      const divider = document.createElement("div");
      Object.assign(divider.style, {
        width: "1px",
        background: "#3a3b3d",
      });

      const scrollArea = document.createElement("div");
      Object.assign(scrollArea.style, {
        width: "56px",
        background: "#2a2b2e",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "18px",
        userSelect: "none",
      });
      scrollArea.textContent = "☰";

      topArea.appendChild(pad);
      topArea.appendChild(divider);
      topArea.appendChild(scrollArea);
      root.appendChild(topArea);

      // BUTTON ROW --------------------------------------------------------------
      const buttonRow1 = document.createElement("div");
      Object.assign(buttonRow1.style, {
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)",
        gap: "6px",
        marginTop: "10px",
      });

      // FIX: Setze das Startsymbol auf ▲ (Expand)
      const expandBtn = this.createButton("▲"); 
      const gyroRelBtn = this.createButton("↝", () => gyroHandler.toggleGyroRelative());
      const gyroAbsBtn = this.createButton("☉", () => gyroHandler.toggleGyroAbsolute());
      const calibrateBtn = this.createButton("⛶");
      const volDownBtn = this.createButton("-");
      const volUpBtn = this.createButton("+");

      gyroHandler.gyroRelBtn = gyroRelBtn;
      gyroHandler.gyroAbsBtn = gyroAbsBtn;

      const volHandler = (btn, code) => {
        // Pointer Events für die Volume-Tasten
        btn.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          touchpadHandler.serviceManager.sendMediaKey(code, "press");
          btn.style.background = "#3a3b3f"; 
        });
        btn.addEventListener("pointerup", (e) => {
          e.preventDefault();
          touchpadHandler.serviceManager.sendMediaKey(code, "release");
          btn.style.background = "#2b2c2f"; 
        });
        btn.addEventListener("pointercancel", (e) => {
          e.preventDefault();
          touchpadHandler.serviceManager.sendMediaKey(code, "release");
        });
      };

      volHandler(volDownBtn, 0xEA); // Volume Down (HID Consumer Code)
      volHandler(volUpBtn, 0xE9);   // Volume Up (HID Consumer Code)

      buttonRow1.append(expandBtn, gyroRelBtn, gyroAbsBtn, calibrateBtn, volDownBtn, volUpBtn);
      root.appendChild(buttonRow1);

      // EXPANDED AREA -----------------------------------------------------------
      const expandedArea = document.createElement("div");
      Object.assign(expandedArea.style, {
        display: "none",
        flexDirection: "column",
        gap: "10px",
        marginTop: "10px",
      });

      expandBtn.addEventListener("click", () => {
        expanded = !expanded;
        updateLayout();
      });

      calibrateBtn.addEventListener("click", () => {
        if (gyroHandler.calibrating) return gyroHandler.finishCalibration();
        if (gyroHandler.isCalibrated) {
          gyroHandler.isCalibrated = false;
          calibrateBtn.textContent = "⊕";
          calibrateBtn.style.background = "#2b2c2f";
          navigator.vibrate?.(50);
          return;
        }
        gyroHandler.startCalibration(calibrateBtn);
      });

      // TEXT INPUT + SEND -------------------------------------------------------
      const textRow = document.createElement("div");
      Object.assign(textRow.style, {
        display: "flex",
        gap: "6px",
        alignItems: "center",
      });

      const liveWrapper = document.createElement("div");
      Object.assign(liveWrapper.style, {
        position: "relative",
        width: "50%",
      });

      const liveInput = document.createElement("input");
      liveInput.type = "text";
      liveInput.placeholder = "Live text";
      Object.assign(liveInput.style, {
        width: "100%",
        padding: "10px",
        borderRadius: "10px",
        background: "#2a2b2e",
        border: "1px solid #323337",
        color: "white",
        fontSize: "14px",
        position: "relative",
        textAlign: "center"
      });

      // Live text input (zum Abfangen von physischen Tasten)
      liveInput.addEventListener("keydown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const mods = [];
        if (e.shiftKey) mods.push(0xE1);
        if (e.ctrlKey) mods.push(0xE0);
        if (e.altKey) mods.push(0xE2);

        mods.forEach((m) => touchpadHandler.serviceManager.sendKey(m, "press"));
        
        const code = this.getHIDKeycodeFromCode(e.code, e.key);
        if (code) {
          touchpadHandler.serviceManager.sendKey(code, "send");
        }
        
        mods.forEach((m) => touchpadHandler.serviceManager.sendKey(m, "release"));

        setTimeout(() => {
          liveInput.value = "";
        }, 0);
      });

      // Fallback for mobile keyboards (sendet Text zeichenweise)
      liveInput.addEventListener("input", (e) => {
        e.stopPropagation();
        const text = liveInput.value;
        if (text) {
          touchpadHandler.serviceManager.sendText(text);
          liveInput.value = "";
        }
      });

      const textInput = document.createElement("input");
      textInput.type = "text";
      textInput.placeholder = "Enter text...";
      Object.assign(textInput.style, {
        flex: "1",
        padding: "10px",
        borderRadius: "10px",
        background: "#2a2b2e",
        border: "1px solid #323337",
        color: "#fff",
        fontSize: "14px",
      });

      textInput.addEventListener("keydown", (e) => e.stopPropagation());
      textInput.addEventListener("keyup", (e) => e.stopPropagation());

      const sendTextBtn = this.createButton("→", () => {
        const text = textInput.value;
        if (text) {
          touchpadHandler.serviceManager.sendText(text);
          textInput.value = "";
        }
        else
          // Wenn kein Text eingegeben wurde, sende "Enter" (40)
          touchpadHandler.serviceManager.sendKey(40, "send");
      });
      Object.assign(sendTextBtn.style, {
        width: "15%",
      });

      textRow.append(liveWrapper, textInput, sendTextBtn);
      expandedArea.appendChild(textRow);

      // MODIFIER KEYS -----------------------------------------------------------
      const modifierRow = document.createElement("div");
      Object.assign(modifierRow.style, {
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "8px",
      });

      const modifierState = { ctrl: false, alt: false, shift: false };

      [
        ["Ctrl", 0xE0],
        ["Alt", 0xE2],
        ["Shift", 0xE1],
      ].forEach(([label, code]) => {
        const b = this.createButton(label, () => {
          const key = label.toLowerCase();
          modifierState[key] = !modifierState[key];
          b.style.background = modifierState[key] ? "#3a3b3f" : "#2b2c2f";
          touchpadHandler.serviceManager.sendKey(code, modifierState[key] ? "press" : "release");
        });
        modifierRow.appendChild(b);
      });

      const escBtn = this.createButton("ESC", () => {
        touchpadHandler.serviceManager.sendKey(41, "send");
        navigator.vibrate?.(30);
      });
      modifierRow.appendChild(escBtn);

      expandedArea.appendChild(modifierRow);
      root.appendChild(expandedArea);

      touchpadHandler.setupPad(pad);
      touchpadHandler.setupScrollArea(scrollArea);
    }

    // Helper functions: getHIDKeycodeFromCode is missing in the uploaded ui-builder.js, 
    // but the following functions are present and used:
    
    getHIDKeycodeFromCode(code, key) {
      // Da die vollständige Implementierung von getHIDKeycodeFromCode fehlt (wurde in ui-builder.js nicht hochgeladen),
      // muss ich annehmen, dass es existiert oder getHIDKeycode aufruft. 
      // Basierend auf den uploadeaten nutze ich getHIDKeycode, um Konflikte zu vermeiden.
      return this.getHIDKeycode(key, code);
    }
    
    getHIDKeycodeFromEvent(e) {
      const k = e.key;
      if (k.length === 1) {
        if (/[a-z]/.test(k)) return 4 + (k.charCodeAt(0) - 97);
        if (/[A-Z]/.test(k)) return 4 + (k.charCodeAt(0) - 65);
        if (/[1-9]/.test(k)) return 30 + (k.charCodeAt(0) - 49);
        if (k === "0") return 39;
      }

      const map = {
        Enter: 40, Escape: 41, Backspace: 42, Tab: 43, " ": 44,
        "-": 45, "=": 46, "[": 47, "]": 48, "\\": 49, ";": 51, "'": 52,
        "`": 53, ",": 54, ".": 55, "/": 56,
        Delete: 76, Home: 74, End: 77, PageUp: 75, PageDown: 78,
        ArrowRight: 0x4F, ArrowLeft: 0x50, ArrowDown: 0x51, ArrowUp: 0x52,
        "!": 30, "@": 31, "#": 32, "$": 33, "%": 34, "^": 35, "&": 36, "*": 37,
        "(": 38, ")": 39, "_": 45, "+": 46, "{": 47, "}": 48, "|": 49,
        ":": 51, '"': 52, "~": 53, "<": 54, ">": 55, "?": 56
      };
      return map[k] || null;
    }

    getHIDKeycode(key, code) {
      return this.getHIDKeycodeFromEvent({ key, code });
    }
  }


  // -------------------------------------------------------------------------
  // 5. Initialisierung und Ausführung
  // -------------------------------------------------------------------------
  window.addEventListener('load', () => {
    // 1. Initialisierung des Service Managers
    const serviceManager = new ServiceManager();
    
    // 2. Konfiguration
    const config = {
        touch_gain: 1.8,
        gyro_gain_x: 32,
        gyro_gain_y: 38,
        gyro_speed_filter: 0.5,
    };

    // 3. Initialisierung der Handler
    const gyroHandler = new GyroHandler(serviceManager, config);
    const touchpadHandler = new TouchpadHandler(serviceManager, gyroHandler, config);
    gyroHandler.touchpadHandler = touchpadHandler;

    const uiBuilder = new UIBuilder(config);
    const rootElement = document.getElementById('root');
    rootElement.innerHTML = ''; // Leeren des "Loading..." Textes

    // 4. Layout-Erstellung (Standard ist mobil, wie die JS-Dateien andeuten)
    const isMobile = window.matchMedia("only screen and (max-width: 760px)").matches;
    
    if (isMobile) {
        uiBuilder.setupMobileLayout(rootElement, touchpadHandler, gyroHandler);
    } else {
        uiBuilder.setupDesktopLayout(rootElement, serviceManager);
    }
  });

</script>
</body>
</html>
)rawliteral";