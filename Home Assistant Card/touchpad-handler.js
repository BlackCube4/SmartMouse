export class TouchpadHandler {
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