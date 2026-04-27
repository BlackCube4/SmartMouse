import { ServiceManager } from './service-manager';
import { SmartMouseConfig } from './types';

export class TouchpadHandler {
  private floatDX = 0;
  private floatDY = 0;
  private velocityX = 0;
  private velocityY = 0;
  private lastTouchTime = 0;
  private isTouchActive = false;

  private TOUCH_GAIN: number;
  private SCROLL_GAIN: number;
  private CLICK_DELAY: number;
  private HOLD_TIME: number;
  private DEADZONE: number;

  constructor(private serviceManager: ServiceManager, private config: SmartMouseConfig) {
    this.TOUCH_GAIN = config.mouseSensitivity ?? 1.8;
    this.SCROLL_GAIN = config.scrollSensitivity ?? 3.0; 
    this.CLICK_DELAY = config.double_click_time ?? 250;
    this.HOLD_TIME = config.hold_time ?? 400;
    this.DEADZONE = config.movement_deadzone ?? 3;
    
    this.startFrameLoop();
  }

  private startFrameLoop() {
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

  private addMovement(dx: number, dy: number) {
    this.floatDX += dx;
    this.floatDY += dy;
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
    let lastY = 0;
    let scrolling = false;
    let accumulatedScroll = 0;

    const startScroll = (e: TouchEvent) => {
      e.preventDefault();
      scrolling = true;
      lastY = e.touches[0].clientY;
    };

    const moveScroll = (e: TouchEvent) => {
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

    const endScroll = (e: TouchEvent) => {
      if (!scrolling) return;
      e.preventDefault();
      scrolling = false;
      accumulatedScroll = 0;
      this.serviceManager.sendTouchpadScroll(0, 0);
    };

    scrollArea.addEventListener("touchstart", startScroll as EventListener, { passive: false });
    scrollArea.addEventListener("touchmove", moveScroll as EventListener, { passive: false });
    scrollArea.addEventListener("touchend", endScroll as EventListener, { passive: false });
    scrollArea.addEventListener("touchcancel", endScroll as EventListener, { passive: false });
  }
}