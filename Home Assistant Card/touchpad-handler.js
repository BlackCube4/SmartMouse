export class TouchpadHandler {
  constructor(serviceManager, gyroHandler, config) {
    this.serviceManager = serviceManager;
    this.gyroHandler = gyroHandler;
    this.config = config;
    
    this.floatDX = 0;
    this.floatDY = 0;
    
    // --- CONFIGURATION ---
    this.TOUCH_GAIN = config.mouseSensitivity ?? 1.8;
    this.SCROLL_GAIN = config.scrollSensitivity ?? 3.0; 

    // Timing (ms)
    // "Wait for second tap" timer
    this.CLICK_DELAY = config.double_click_time ?? 250;
    // Time to trigger Right Click (Tap 1) or Start Drag (Tap 2+)
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

  setupPad(pad) {
    // State Machine Variables
    let tapCount = 0;           // Tracks 1, 2, 3... taps in a sequence
    let clickTimer = null;      // The "Wait for second tap" timer
    let holdTimer = null;       // The "Right Click" or "Drag" timer
    
    let isDragging = false;     // True if finger is actually moving
    let dragActive = false;     // True if we sent 'mousedown' (Left Down)
    let rightClickDone = false; // True if Tap 1 held long enough for Right Click
    
    let lastX = 0;
    let lastY = 0;

    const startTouch = (e) => {
      e.preventDefault();
      this.gyroHandler.setGyroSuppression(400); // Stop gyro interference
      
      const touch = e.touches[0];
      lastX = touch.clientX;
      lastY = touch.clientY;
      
      // Reset move state
      isDragging = false;
      rightClickDone = false;

      // LOGIC: Check if we are waiting for a sequence
      if (clickTimer) {
        // This is Tap 2, 3, etc.
        clearTimeout(clickTimer);
        clickTimer = null;
        tapCount++;
      } else {
        // This is a fresh Tap 1
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
        } else {
          // Tap 2+ Hold -> Start Drag (Left Down)
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
      const dx = touch.clientX - lastX;
      const dy = touch.clientY - lastY;

      // Noise filter
      if (!isDragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        isDragging = true;
        
        // If we move, cancel the Right Click timer
        if (tapCount === 1) {
            clearTimeout(holdTimer); 
        }
        
        // If Tap 2+ moves -> Immediate Drag Start (Left Down)
        if (tapCount > 1 && !dragActive) {
            clearTimeout(holdTimer); // Cancel hold wait, start immediately
            this.serviceManager.sendButton("left", "down");
            dragActive = true;
        }
      }

      if (isDragging) {
        lastX = touch.clientX;
        lastY = touch.clientY;
        this.addMovement(dx * this.TOUCH_GAIN, dy * this.TOUCH_GAIN);
      }
    };

    const endTouch = (e) => {
      e.preventDefault();
      clearTimeout(holdTimer);

      // CASE A: Drag Active (Tap 2+ was held/dragged)
      if (dragActive) {
        this.serviceManager.sendButton("left", "up");
        dragActive = false;
        tapCount = 0; // Reset sequence
        return;
      }

      // CASE B: Right Click (Tap 1 was held)
      if (rightClickDone) {
        tapCount = 0; // Reset sequence
        return;
      }

      // CASE C: Cursor Move (Tap 1 moved)
      if (tapCount === 1 && isDragging) {
        tapCount = 0; // Reset sequence, don't click
        return;
      }

      // CASE D: Quick Tap Release (Tap 1, 2, 3...)
      // We start the "Wait" timer to see if another tap comes
      clickTimer = setTimeout(() => {
        // Timer Expired -> Execute Clicks
        for (let i = 0; i < tapCount; i++) {
            // Add tiny delay between multi-clicks so OS registers them
            setTimeout(() => {
                this.serviceManager.sendButton("left", "click");
            }, i * 50); 
        }
        
        // Reset state
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