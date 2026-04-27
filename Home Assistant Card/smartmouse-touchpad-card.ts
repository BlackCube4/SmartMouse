import { ServiceManager } from './service-manager';
import { TouchpadHandler } from './touchpad-handler';
import { HomeAssistant, SmartMouseConfig } from './types';

class SmartMouseTouchpadCard extends HTMLElement {
  private _hass?: HomeAssistant;
  private _config: SmartMouseConfig = {} as SmartMouseConfig;
  private serviceManager!: ServiceManager;
  private touchpadHandler!: TouchpadHandler;
  private rendered = false;

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
    this.touchpadHandler = new TouchpadHandler(this.serviceManager, this._config);

    const root = document.createElement("div");
    Object.assign(root.style, {
      display: "flex",
      height: "220px",
      width: "100%",
      borderRadius: "var(--ha-card-border-radius, 10px)",
      overflow: "hidden",
      border: "var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, #2b2c2f)",
      background: "var(--ha-card-background, #1e1f22)",
      boxShadow: "var(--ha-card-box-shadow)",
      color: "var(--primary-text-color, #fff)",
      userSelect: "none"
    });

    const pad = document.createElement("div");
    Object.assign(pad.style, {
      flex: "1",
      background: "var(--dark, #2a2b2e)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "15px",
      touchAction: "none", 
    });
    pad.textContent = "Touchpad";

    const divider = document.createElement("div");
    Object.assign(divider.style, {
      width: "1px",
      background: "var(--divider-color, #3a3b3d)",
    });

    const scrollArea = document.createElement("div");
    Object.assign(scrollArea.style, {
      width: "56px",
      background: "var(--dark, #2a2b2e)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "18px",
      userSelect: "none",
      touchAction: "none",
    });
    scrollArea.textContent = "☰";

    root.appendChild(pad);
    root.appendChild(divider);
    root.appendChild(scrollArea);
    this.shadowRoot?.appendChild(root);

    this.touchpadHandler.setupPad(pad);
    this.touchpadHandler.setupScrollArea(scrollArea);
  }

  getCardSize() { return 4; }
}

customElements.define("smartmouse-touchpad-card", SmartMouseTouchpadCard);

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "smartmouse-touchpad-card",
  name: "SmartMouse Touchpad",
  description: "Touchpad and scroll area for SmartMouse."
});