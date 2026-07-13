import { IServiceManager, SmartMouseConfig } from './types';

export class TouchpadHandler {
  private floatDX = 0;
  private floatDY = 0;
  private velocityX = 0;
  private velocityY = 0;
  private lastTouchTime = 0;
  private isTouchActive = false;
  private frameLoopRunning = false;

  private TOUCH_GAIN: number;
  private SCROLL_GAIN: number;
  private CLICK_DELAY: number;
  private HOLD_TIME: number;
  private DEADZONE: number;

  constructor(private serviceManager: IServiceManager, private config: SmartMouseConfig) {
    this.TOUCH_GAIN = config.mouseSensitivity ?? 1.8;
    this.SCROLL_GAIN = config.scrollSensitivity ?? 3.0; 
    this.CLICK_DELAY = config.doubleClickTime ?? 250;
    this.HOLD_TIME = config.holdTime ?? 400;
    this.DEADZONE = config.movementDeadzone ?? 3;
  }

  updateConfig(config: SmartMouseConfig) {
    this.config = config;
    this.TOUCH_GAIN = config.mouseSensitivity ?? 1.8;
    this.SCROLL_GAIN = config.scrollSensitivity ?? 3.0; 
    this.CLICK_DELAY = config.doubleClickTime ?? 250;
    this.HOLD_TIME = config.holdTime ?? 400;
    this.DEADZONE = config.movementDeadzone ?? 3;
  }

  // Runs only while there is pending movement to flush, instead of forever.
  private ensureFrameLoop() {
    if (this.frameLoopRunning) return;
    this.frameLoopRunning = true;

    const frameLoop = () => {
      const dx = this.floatDX > 0 ? Math.floor(this.floatDX) : Math.ceil(this.floatDX);
      const dy = this.floatDY > 0 ? Math.floor(this.floatDY) : Math.ceil(this.floatDY);

      if (dx !== 0 || dy !== 0) {
        this.floatDX -= dx;
        this.floatDY -= dy;
        this.serviceManager.sendMove(dx, dy);
      }

      if (Math.abs(this.floatDX) > 0.0001 || Math.abs(this.floatDY) > 0.0001) {
        requestAnimationFrame(frameLoop);
      } else {
        this.frameLoopRunning = false;
      }
    };
    requestAnimationFrame(frameLoop);
  }

  private addMovement(dx: number, dy: number) {
    this.floatDX += dx;
    this.floatDY += dy;
    this.ensureFrameLoop();
  }

  private runMomentum(onComplete?: () => void) {
    const friction = 0.92;
    const step = () => {
      if (this.isTouchActive) return;

      const dx = this.velocityX * 16.6;
      const dy = this.velocityY * 16.6;

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

  setupPad(pad: HTMLElement) {
    let tapCount = 0;
    let clickTimer: number | null = null;
    let holdTimer: number | null = null;
    let isDragging = false;
    let dragActive = false;
    let rightClickDone = false;
    let lastX = 0;
    let lastY = 0;

    const startTouch = (e: TouchEvent) => {
      e.preventDefault();
      this.isTouchActive = true;
      this.velocityX = 0;
      this.velocityY = 0;

      // DECOUPLED: Dispatch event so the GyroCard can listen and suppress itself
      window.dispatchEvent(new CustomEvent('smartmouse-gyro-suppress', { detail: { ms: 400 } }));
      
      const touch = e.touches[0];
      lastX = touch.clientX;
      lastY = touch.clientY;
      
      isDragging = false;
      rightClickDone = false;

      if (dragActive) {
        tapCount = 2; 
      } else if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        tapCount = 2; 
      } else {
        tapCount = 1;
      }

      holdTimer = window.setTimeout(() => {
        if (isDragging) return;
        if (tapCount === 1) {
          this.serviceManager.sendButton("right", "click");
          navigator.vibrate?.(50);
          rightClickDone = true;
        }
      }, this.HOLD_TIME);
    };

    const moveTouch = (e: TouchEvent) => {
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

      if (!isDragging && (Math.abs(dx) > this.DEADZONE || Math.abs(dy) > this.DEADZONE)) {
        isDragging = true;
        if (holdTimer) clearTimeout(holdTimer); 
        
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

    const endTouch = (e: TouchEvent) => {
      e.preventDefault();
      this.isTouchActive = false;
      if (holdTimer) clearTimeout(holdTimer);

      const timeSinceLastMove = performance.now() - this.lastTouchTime;
      const wantsMomentum = isDragging && timeSinceLastMove < 50;

      if (tapCount === 1) {
        if (rightClickDone) {
          tapCount = 0;
          return;
        }
        if (isDragging) {
          tapCount = 0;
          if (wantsMomentum) this.runMomentum();
          return;
        }
        clickTimer = window.setTimeout(() => {
          this.serviceManager.sendButton("left", "click");
          tapCount = 0;
          clickTimer = null;
        }, this.CLICK_DELAY);

      } else if (tapCount === 2) {
        if (dragActive) {
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
          this.serviceManager.sendButton("left", "click");
          setTimeout(() => this.serviceManager.sendButton("left", "click"), 50); 
          tapCount = 0;
        }
      } else {
        tapCount = 0;
      }
    };

    pad.addEventListener("touchstart", startTouch as EventListener, { passive: false });
    pad.addEventListener("touchmove", moveTouch as EventListener, { passive: false });
    pad.addEventListener("touchend", endTouch as EventListener, { passive: false });
    pad.addEventListener("touchcancel", endTouch as EventListener, { passive: false });
  }

  setupScrollArea(scrollArea: HTMLElement) {
    let scrolling = false;
    let lastY = 0;
    let accumulatedScroll = 0;
    let fingersDown = false;
    let lastSendTime = 0;
    let keepaliveTimer: number | null = null;

    // A real precision touchpad reports its contacts continuously while fingers
    // are down. We mimic that: while a scroll is active, resend the current
    // finger position at a fixed rate so Windows keeps the two-finger scroll
    // gesture alive instead of timing the stale contact out (which made a
    // paused-then-resumed scroll get misread as a cursor move). Fingers are
    // only lifted on the real touchend, so an abrupt stop with the finger still
    // down no longer ends the scroll (and no longer triggers OS scroll inertia).
    const KEEPALIVE_MS = 60;
    const isTouchpadMode = () => this.config.scrollType !== 'wheel';

    const sendMove = (amount: number) => {
      if (this.config.scrollType === 'wheel') {
        // Standard wheel conventionally expects inverted Y relative to the gesture
        this.serviceManager.sendScrollWheel(-(this.config.invertScroll ? -amount : amount));
        return;
      }
      this.serviceManager.sendTouchpadScroll(0, this.config.invertScroll ? -amount : amount);
      fingersDown = true;
      lastSendTime = performance.now();
    };

    const keepalive = () => {
      if (!scrolling || !isTouchpadMode()) return;
      if (performance.now() - lastSendTime >= KEEPALIVE_MS) {
        this.serviceManager.sendTouchpadScroll(0, 0); // hold: resend current position
        fingersDown = true;
        lastSendTime = performance.now();
      }
    };

    const startScroll = (e: TouchEvent) => {
      e.preventDefault();
      scrolling = true;
      lastY = e.touches[0].clientY;
      accumulatedScroll = 0;
      if (isTouchpadMode()) {
        // Place the fingers right away so the gesture is recognised immediately
        // (removes the "scroll only starts after some travel" dead zone).
        this.serviceManager.sendTouchpadScroll(0, 0);
        fingersDown = true;
        lastSendTime = performance.now();
        if (keepaliveTimer === null) keepaliveTimer = window.setInterval(keepalive, KEEPALIVE_MS);
      }
    };

    const moveScroll = (e: TouchEvent) => {
      if (!scrolling) return;
      e.preventDefault();
      const currentY = e.touches[0].clientY;
      accumulatedScroll += lastY - currentY;
      lastY = currentY;

      const amount = Math.trunc(accumulatedScroll * this.SCROLL_GAIN);
      if (amount !== 0) {
        sendMove(amount);
        accumulatedScroll -= amount / this.SCROLL_GAIN;
      }
    };

    const endScroll = (e: TouchEvent) => {
      if (!scrolling) return;
      e.preventDefault();
      scrolling = false;
      accumulatedScroll = 0;
      if (keepaliveTimer !== null) { clearInterval(keepaliveTimer); keepaliveTimer = null; }
      if (fingersDown && isTouchpadMode()) {
        this.serviceManager.endTouchpadScroll();
      }
      fingersDown = false;
    };

    scrollArea.addEventListener("touchstart", startScroll as EventListener, { passive: false });
    scrollArea.addEventListener("touchmove", moveScroll as EventListener, { passive: false });
    scrollArea.addEventListener("touchend", endScroll as EventListener, { passive: false });
    scrollArea.addEventListener("touchcancel", endScroll as EventListener, { passive: false });
  }
}