import { ServiceManager } from './service-manager';
import { HomeAssistant, SmartMouseConfig } from './types';
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('smartmouse-modifier-card-editor')
export class SmartMouseModifierCardEditor extends LitElement {
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

class SmartMouseModifierCard extends HTMLElement {
  private _hass?: HomeAssistant;
  private _config: any = {};
  private serviceManager!: ServiceManager;
  private rendered = false;
  private modifierState: Record<string, boolean> = { ctrl: false, alt: false, shift: false, win: false };

  static getConfigElement() { return document.createElement("smartmouse-modifier-card-editor"); }

  static getStubConfig() {
    return { type: "custom:smartmouse-modifier-card" };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config: any) { 
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
    if (this.serviceManager) this.serviceManager.hass = hass;
  }

  connectedCallback() {
    if (this.rendered) return;
    this.rendered = true;

    this.serviceManager = new ServiceManager(this._hass, this._config);

    const root = document.createElement("div");
    Object.assign(root.style, {
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      gap: "8px",
      padding: "0",
      background: "transparent",
      border: "none",
    });

    const createBtn = (label: string, code: number, isToggle: boolean) => {
      const btn = document.createElement("button");
      Object.assign(btn.style, {
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "12px 4px", borderRadius: "var(--ha-card-border-radius, 8px)", background: "var(--dark, #2b2c2f)",
        color: "var(--primary-text-color, #fff)", border: "none", cursor: "pointer", 
        fontSize: "14px", fontWeight: "600", touchAction: "none"
      });
      btn.textContent = label;

      if (isToggle) {
        const key = label.toLowerCase();
        btn.addEventListener("click", () => {
          this.modifierState[key] = !this.modifierState[key];
          btn.style.background = this.modifierState[key] ? "var(--primary-color, #666)" : "var(--dark, #2b2c2f)";
          this.serviceManager.sendKey(code, this.modifierState[key] ? "press" : "release");
          navigator.vibrate?.([30]);
        });
      } else {
        btn.addEventListener("click", () => {
          this.serviceManager.sendKey(code, "send");
          navigator.vibrate?.([30]);
        });
      }
      return btn;
    };

    root.append(
      createBtn("Ctrl", 224, true),
      createBtn("Shift", 225, true),
      createBtn("Alt", 226, true),
      createBtn("Win", 227, true),
      createBtn("ESC", 41, false)
    );

    this.shadowRoot?.appendChild(root);
  }
}

customElements.define("smartmouse-modifier-card", SmartMouseModifierCard);

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "smartmouse-modifier-card",
  name: "SmartMouse Modifiers",
  description: "Toggleable modifier keys for SmartMouse.",
  preview: true
});