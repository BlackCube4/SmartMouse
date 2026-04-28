import { ServiceManager } from './service-manager';
import { HomeAssistant, SmartMouseConfig, MouseButton, KeyMode } from './types';

class SmartMouseDesktopCard extends HTMLElement {
  private _hass?: HomeAssistant;
  private _config: SmartMouseConfig = {} as SmartMouseConfig;
  private serviceManager!: ServiceManager;
  private rendered = false;
  private isLocked = false;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config: SmartMouseConfig) {
    this._config = config;
  }

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    if (this.serviceManager) {
      this.serviceManager.hass = hass;
    }
  }

  connectedCallback() {
    if (this.rendered) return;
    this.rendered = true;

    this.serviceManager = new ServiceManager(this._hass, this._config);

    const root = document.createElement("div");
    Object.assign(root.style, {
      height: "400px",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      position: "relative",
      backgroundColor: "var(--ha-card-background, #1e1f22)",
      borderRadius: "var(--ha-card-border-radius, 14px)",
      border: "var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, #2b2c2f)",
      color: "var(--primary-text-color, #fff)",
      transition: "background 0.3s",
      userSelect: "none",
      overflow: "hidden"
    });

    const overlay = document.createElement("div");
    overlay.innerHTML = "Click to Lock System<br><small style='font-size: 0.7em; opacity: 0.7;'>Exit: Escape</small>";
    Object.assign(overlay.style, { textAlign: "center", pointerEvents: "none" });
    root.appendChild(overlay);

    const decoyInput = document.createElement("input");
    decoyInput.type = "text";
    Object.assign(decoyInput.style, { position: "absolute", opacity: 0, pointerEvents: "none", zIndex: -1 });
    root.appendChild(decoyInput);

    this.shadowRoot?.appendChild(root);

    const onPointerMove = (e: MouseEvent) => {
      if (this.isLocked && document.pointerLockElement) {
        this.serviceManager.sendMove(e.movementX || 0, e.movementY || 0);
      }
    };

    const handleKey = (e: KeyboardEvent, mode: KeyMode) => {
      if (!this.isLocked || e.key === 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      if (mode === "press" && e.repeat) return;
      
      let hidCode = this.getHIDKeycodeFromEvent(e);
      if (hidCode) this.serviceManager.sendKey(hidCode, mode);
    };

    const onKeyDown = (e: KeyboardEvent) => handleKey(e, "press");
    const onKeyUp = (e: KeyboardEvent) => handleKey(e, "release");
    const blockScroll = (e: Event) => { if (this.isLocked) e.preventDefault(); };

    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement === root) {
        this.isLocked = true;
        overlay.textContent = "System Locked. Escape to Exit";
        root.style.background = "var(--dark, #232427)";
        root.style.cursor = "none";
        decoyInput.focus();
        
        window.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("keyup", onKeyUp, true);
        window.addEventListener("wheel", blockScroll, { passive: false });
        document.addEventListener("pointermove", onPointerMove, { capture: true });
      } else {
        this.isLocked = false;
        overlay.innerHTML = "Click to Lock System<br><small style='font-size: 0.7em; opacity: 0.7;'>Exit: Escape</small>";
        root.style.background = "var(--ha-card-background, #1e1f22)";
        root.style.cursor = "pointer";
        decoyInput.blur();
        
        window.removeEventListener("keydown", onKeyDown, true);
        window.removeEventListener("keyup", onKeyUp, true);
        window.removeEventListener("wheel", blockScroll);
        document.removeEventListener("pointermove", onPointerMove, { capture: true });
      }
    });

    root.addEventListener("pointerdown", (e) => {
      if (!this.isLocked) {
        root.requestPointerLock();
        e.preventDefault();
      } else {
        const btnMap: Record<number, MouseButton> = { 0: "left", 1: "middle", 2: "right" };
        this.serviceManager.sendButton(btnMap[e.button] || "left", "down");
        try { root.releasePointerCapture(e.pointerId); } catch(err) {}
        e.preventDefault();
      }
    });

    root.addEventListener("pointerup", (e) => {
      if (this.isLocked) {
        const btnMap: Record<number, MouseButton> = { 0: "left", 1: "middle", 2: "right" };
        this.serviceManager.sendButton(btnMap[e.button] || "left", "up");
        e.preventDefault();
      }
    });

    root.addEventListener("wheel", (e) => {
      if (this.isLocked) {
        e.preventDefault();
        this.serviceManager.sendScrollWheel(Math.sign(e.deltaY) * -1);
      }
    }, { passive: false });

    root.addEventListener("contextmenu", (e) => { if (this.isLocked) e.preventDefault(); });
  }

  private getHIDKeycodeFromEvent(e: KeyboardEvent): number | null {
    const map: Record<string, number> = {
      Enter: 40, Escape: 41, Backspace: 42, Tab: 43,
      Space: 44, ArrowRight: 0x4F, ArrowLeft: 0x50, ArrowDown: 0x51, ArrowUp: 0x52
    };
    return map[e.code] || map[e.key] || null;
    // Add full HID mapping as needed...
  }

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