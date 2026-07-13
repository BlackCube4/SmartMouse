import { SmartMouseCardBase, computeLabelFactory } from './base-card';
import { MouseButton, KeyMode } from './types';
import { keyboardEventToHid } from './hid-keycodes';
import { html, css } from 'lit';
import { query } from 'lit/decorators.js';

const COMPUTE_LABEL = computeLabelFactory({ device_id: 'Target Device', height: 'Card Height' });
const DEFAULT_HEIGHT = 400;

class SmartMouseDesktopCard extends SmartMouseCardBase {
  private isLocked = false;
  private lockIntent = false;

  @query('.overlay') private overlayEl!: HTMLElement;
  @query('.decoy') private decoyInputEl!: HTMLInputElement;

  static getConfigForm() {
    return {
      schema: [
        { name: 'device_id', selector: { device: {} } },
        { name: 'height', selector: { number: { mode: 'box', min: 100, max: 1000, unit_of_measurement: 'px' } } },
      ],
      computeLabel: COMPUTE_LABEL,
    };
  }
  static getStubConfig() { return { type: "custom:smartmouse-desktop-card" }; }

  protected onConfigUpdated(config: any) {
    this.style.height = `${config.height || DEFAULT_HEIGHT}px`;
  }

  // Element-scoped listeners can bind declaratively, but pointer lock relies
  // on document/window-level listeners with no Lit template equivalent, and
  // "wheel" needs {passive:false} to preventDefault() - both wired manually.
  protected firstUpdated() {
    this.addEventListener("pointerdown", this.handlePointerDown);
    this.addEventListener("pointerup", this.handlePointerUp);
    this.addEventListener("wheel", this.handleWheel, { passive: false });
    this.addEventListener("contextmenu", this.handleContextMenu);
    document.addEventListener("pointerlockchange", this.handlePointerLockChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("pointerlockchange", this.handlePointerLockChange);
    window.removeEventListener("keydown", this.handleKeyDown, true);
    window.removeEventListener("keyup", this.handleKeyUp, true);
    window.removeEventListener("wheel", this.blockScroll);
    document.removeEventListener("pointermove", this.handlePointerMove, { capture: true });
  }

  // In Home Assistant this card lives inside nested shadow roots, where
  // document.pointerLockElement is retargeted and identity checks against
  // `this` are unreliable across browsers. Instead we track our own intent:
  // once WE requested a lock, any active pointer lock means we hold it (only
  // this card ever requests one on the dashboard).
  private isPointerLocked(): boolean {
    const root = this.getRootNode() as unknown as DocumentOrShadowRoot;
    return document.pointerLockElement != null || root.pointerLockElement != null;
  }

  private handlePointerMove = (e: MouseEvent) => {
    if (this.isLocked) {
      this.serviceManager.sendMove(e.movementX || 0, e.movementY || 0);
    }
  };

  private handleKey = (e: KeyboardEvent, mode: KeyMode) => {
    if (!this.isLocked || e.key === 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    if (mode === "press" && e.repeat) return;

    const hidCode = keyboardEventToHid(e);
    if (hidCode) this.serviceManager.sendKey(hidCode, mode);
  };

  private handleKeyDown = (e: KeyboardEvent) => this.handleKey(e, "press");
  private handleKeyUp = (e: KeyboardEvent) => this.handleKey(e, "release");
  private blockScroll = (e: Event) => { if (this.isLocked) e.preventDefault(); };

  // Clear any modifier that got stuck (e.g. a keyup lost because focus changed
  // while it was held). Sent on both lock and unlock so a session never starts
  // or ends with Ctrl/Shift/Alt/Win still down on the PC.
  private releaseAllModifiers() {
    for (let code = 0xe0; code <= 0xe7; code++) {
      this.serviceManager.sendKey(code, "release");
    }
  }

  private handlePointerLockChange = () => {
    if (this.isPointerLocked() && this.lockIntent) {
      this.isLocked = true;
      this.releaseAllModifiers();
      this.overlayEl.textContent = "System Locked. Escape to Exit";
      this.style.background = "var(--dark, #232427)";
      this.style.cursor = "none";
      this.decoyInputEl.focus();

      window.addEventListener("keydown", this.handleKeyDown, true);
      window.addEventListener("keyup", this.handleKeyUp, true);
      window.addEventListener("wheel", this.blockScroll, { passive: false });
      document.addEventListener("pointermove", this.handlePointerMove, { capture: true });
    } else {
      this.isLocked = false;
      this.lockIntent = false;
      this.releaseAllModifiers();
      this.overlayEl.innerHTML = "Click to Lock System<br><small style='font-size: 0.7em; opacity: 0.7;'>Exit: Escape</small>";
      this.style.background = "var(--ha-card-background, #1e1f22)";
      this.style.cursor = "pointer";
      this.decoyInputEl.blur();

      window.removeEventListener("keydown", this.handleKeyDown, true);
      window.removeEventListener("keyup", this.handleKeyUp, true);
      window.removeEventListener("wheel", this.blockScroll);
      document.removeEventListener("pointermove", this.handlePointerMove, { capture: true });
    }
  };

  private handlePointerDown = (e: PointerEvent) => {
    if (!this.isLocked) {
      this.lockIntent = true;
      this.requestPointerLock();
      e.preventDefault();
    } else {
      const btnMap: Record<number, MouseButton> = { 0: "left", 1: "middle", 2: "right" };
      this.serviceManager.sendButton(btnMap[e.button] || "left", "down");
      try { this.releasePointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    }
  };

  private handlePointerUp = (e: PointerEvent) => {
    if (this.isLocked) {
      const btnMap: Record<number, MouseButton> = { 0: "left", 1: "middle", 2: "right" };
      this.serviceManager.sendButton(btnMap[e.button] || "left", "up");
      e.preventDefault();
    }
  };

  private handleWheel = (e: WheelEvent) => {
    if (this.isLocked) {
      e.preventDefault();
      this.serviceManager.sendScrollWheel(Math.sign(e.deltaY) * -1);
    }
  };

  private handleContextMenu = (e: Event) => { if (this.isLocked) e.preventDefault(); };

  protected render() {
    return html`
      <div class="overlay">Click to Lock System<br><small style="font-size: 0.7em; opacity: 0.7;">Exit: Escape</small></div>
      <input class="decoy" type="text">
    `;
  }

  static styles = css`
    :host {
      display: flex;
      width: 100%;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      background-color: var(--ha-card-background, #1e1f22);
      border-radius: var(--ha-card-border-radius, 14px);
      border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, #2b2c2f);
      color: var(--primary-text-color, #fff);
      transition: background 0.3s;
      user-select: none;
      overflow: hidden;
    }
    .overlay { text-align: center; pointer-events: none; }
    .decoy { position: absolute; opacity: 0; pointer-events: none; z-index: -1; }
  `;

  getCardSize() { return 4; }
}

customElements.define("smartmouse-desktop-card", SmartMouseDesktopCard);

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "smartmouse-desktop-card",
  name: "SmartMouse Desktop",
  description: "Desktop lock card for mouse and keyboard passthrough.",
  preview: true
});
