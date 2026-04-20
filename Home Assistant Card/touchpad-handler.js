export class TouchpadHandler {
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

    // --- CONFIGURATION ---
    this.TOUCH_GAIN = config.mouseSensitivity ?? 1.8;
    this.SCROLL_GAIN = config.scrollSensitivity ?? 3.0; 

    // Timing (ms)
    // "Wait for second tap" timer
    this.CLICK_DELAY = config.double_click_time ?? 250;
    // Time to trigger Right Click (Tap 1)
    this.HOLD_TIME = config.hold_time ?? 400;
    // Movement deadzone (px)
    this.DEADZONE = config.movement_deadzone ?? 3;
    
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

  runMomentum(onComplete) {
    const friction = 0.92; // Adjust for how long the slide lasts
    const step = () => {
      if (this.isTouchActive) {
        // Do NOT call onComplete() here. This allows an intercepting touch to keep dragActive = true.
        return; // Cancel on new touch
      }

      // Velocity is px/ms. At 60fps, 1 frame is ~16.6ms.
      const dx = this.velocityX * 16.6;
      const dy = this.velocityY * 16.6;

      // Stop when movement is negligible
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        this.velocityX = 0;
        this.velocityY = 0;
        if (onComplete) onComplete();
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
    // State Machine Variables
    let tapCount = 0;           // Tracks 1, 2 taps in a sequence
    let clickTimer = null;      // The "Wait for second tap" timer
    let holdTimer = null;       // The "Right Click" timer
    
    let isDragging = false;     // True if finger is actually moving
    let dragActive = false;     // True if we sent 'mousedown' (Left Down)
    let rightClickDone = false; // True if Tap 1 held long enough for Right Click
    
    let lastX = 0;
    let lastY = 0;

    const startTouch = (e) => {
      e.preventDefault();
      this.isTouchActive = true;
      this.velocityX = 0;
      this.velocityY = 0;

      this.gyroHandler.setGyroSuppression(400); // Stop gyro interference
      
      const touch = e.touches[0];
      lastX = touch.clientX;
      lastY = touch.clientY;
      
      // Reset move state
      isDragging = false;
      rightClickDone = false;

      // LOGIC: Check if we are waiting for a sequence (Tap 2)
      if (dragActive) {
        tapCount = 2; // Caught a momentum drag, maintain sequence
      } else if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        tapCount = 2; // Second tap
      } else {
        tapCount = 1;
      }

      // START HOLD TIMER
      holdTimer = setTimeout(() => {
        if (isDragging) return;

        if (tapCount === 1) {
          // Tap 1 Hold -> Right Click
          this.serviceManager.sendButton("right", "click");
          navigator.vibrate?.(50);
          rightClickDone = true;
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
        // Calculate velocity (pixels per ms) and apply smoothing
        const curVX = dx / dt;
        const curVY = dy / dt;
        this.velocityX = this.velocityX * 0.4 + curVX * 0.6;
        this.velocityY = this.velocityY * 0.4 + curVY * 0.6;
      }

      // Check for Movement (Deadzone)
      if (!isDragging && (Math.abs(dx) > this.DEADZONE || Math.abs(dy) > this.DEADZONE)) {
        isDragging = true;
        clearTimeout(holdTimer); 
        
        // If Tap 2 moves -> Trigger Drag (Left Down)
        if (tapCount === 2 && !dragActive) {
            this.serviceManager.sendButton("left", "down");
            dragActive = true;
            navigator.vibrate?.(30);
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
      const wantsMomentum = isDragging && timeSinceLastMove < 50;

      if (tapCount === 1) {
        // CASE: Tap 1 Hold (Right Click triggered)
        if (rightClickDone) {
          tapCount = 0;
          return;
        }

        // CASE: Tap 1 Move (Cursor Move)
        if (isDragging) {
          tapCount = 0;
          if (wantsMomentum) this.runMomentum();
          return;
        }

        // CASE: Tap 1 Released < 200ms
        clickTimer = setTimeout(() => {
          // Timer Expired -> No 2nd tap -> Execute Left Click
          this.serviceManager.sendButton("left", "click");
          tapCount = 0;
          clickTimer = null;
        }, this.CLICK_DELAY);

      } else if (tapCount === 2) {
        if (dragActive) {
          // Drag Termination Condition: No touch AND completely stopped moving
          if (wantsMomentum) {
            this.runMomentum(() => {
              this.serviceManager.sendButton("left", "up");
              dragActive = false;
              tapCount = 0;
            });
          } else {
            this.serviceManager.sendButton("left", "up");
            dragActive = false;
            tapCount = 0;
          }
        } else {
          // No Movement on Second Tap -> Double Click
          this.serviceManager.sendButton("left", "click");
          setTimeout(() => {
              this.serviceManager.sendButton("left", "click");
          }, 50); // Tiny delay to ensure OS registers two distinct clicks
          tapCount = 0;
        }
      } else {
        tapCount = 0;
      }
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
        this.serviceManager.sendTouchpadScroll(0, scrollAmount);
        accumulatedScroll -= scrollAmount / this.SCROLL_GAIN;
      }
    };

    const endScroll = (e) => {
      if (scrolling) {
        e.preventDefault();
        scrolling = false;
        accumulatedScroll = 0;
        this.serviceManager.sendTouchpadScroll(0, 0);
      }
    };

    scrollArea.addEventListener("touchstart", startScroll, { passive: false });
    scrollArea.addEventListener("touchmove", moveScroll, { passive: false });
    scrollArea.addEventListener("touchend", endScroll, { passive: false });
    scrollArea.addEventListener("touchcancel", endScroll, { passive: false });
  }
}