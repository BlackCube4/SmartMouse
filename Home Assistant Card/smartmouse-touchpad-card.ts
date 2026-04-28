import { ServiceManager } from './service-manager';
import { TouchpadHandler } from './touchpad-handler';
import { HomeAssistant, SmartMouseConfig } from './types';
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('smartmouse-touchpad-card-editor')
export class SmartMouseTouchpadCardEditor extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: any;

  setConfig(config: any) {
    this._config = config;
  }

  private _valueChanged(ev: any, key: string) {
    if (!this._config) return;
    const target = ev.target as any;
    const value = ev.detail?.value !== undefined ? ev.detail.value : target.value;
    if (this._config[key] === value) return;
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: { ...this._config, [key]: value } },
      bubbles: true, composed: true
    }));
  }

  protected render() {
    if (!this._config) return html``;
    return html`
      <div class="card-config">
        <div class="option">
          <label>Target Device</label>
          <ha-selector
            .hass=${this.hass}
            .selector=${{ device: {} }}
            .value=${this._config.device_id || ''}
            @value-changed=${(e: any) => this._valueChanged(e, 'device_id')}
          ></ha-selector>
        </div>
      </div>
    `;
  }

  static styles = css`
    .card-config { display: flex; flex-direction: column; gap: 12px; }
    .option { display: flex; flex-direction: column; gap: 4px; }
    label { font-size: 14px; font-weight: 500; color: var(--primary-text-color, #fff); margin: 0; }
    input { padding: 8px; border-radius: 4px; background: var(--card-background-color, #2a2b2e); color: var(--primary-text-color, #fff); border: 1px solid var(--divider-color, #3a3b3d); outline: none; }
  `;
}

class SmartMouseTouchpadCard extends HTMLElement {
  private _hass?: HomeAssistant;
  private _config: SmartMouseConfig = {} as SmartMouseConfig;
  private serviceManager!: ServiceManager;
  private touchpadHandler!: TouchpadHandler;
  private rendered = false;

  static getConfigElement() { return document.createElement("smartmouse-touchpad-card-editor"); }
  static getStubConfig() { return { type: "custom:smartmouse-touchpad-card" }; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config: SmartMouseConfig) {
    const oldConfig = this._config as any;
    this._config = config;
    if (this.rendered && oldConfig?.device_id !== config.device_id) {
      if (this.shadowRoot) this.shadowRoot.innerHTML = '';
      this.rendered = false;
      this.connectedCallback();
    }
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
  description: "Touchpad and scroll area for SmartMouse.",
  preview: true
});