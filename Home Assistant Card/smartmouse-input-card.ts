import { ServiceManager } from './service-manager';
import { HomeAssistant, SmartMouseConfig } from './types';
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('smartmouse-input-card-editor')
export class SmartMouseInputCardEditor extends LitElement {
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
        <div class="option">
          <label>Input Mode</label>
          <select .value=${this._config.inputType || 'buffered'} @change=${(e: any) => this._valueChanged(e, 'inputType')}>
            <option value="buffered">Buffered (Press Enter to send)</option>
            <option value="live">Live (Sends as you type)</option>
          </select>
        </div>
      </div>
    `;
  }

  static styles = css`
    .card-config { display: flex; flex-direction: column; gap: 12px; }
    .option { display: flex; flex-direction: column; gap: 4px; }
    label { font-size: 14px; font-weight: 500; color: var(--primary-text-color, #fff); margin: 0; }
    select, input { padding: 8px; border-radius: 4px; background: var(--card-background-color, #2a2b2e); color: var(--primary-text-color, #fff); border: 1px solid var(--divider-color, #3a3b3d); outline: none; }
  `;
}

class SmartMouseInputCard extends HTMLElement {
  private _hass?: HomeAssistant;
  private _config: any = {};
  private serviceManager!: ServiceManager;
  private rendered = false;
  private lastInputValue = " ";

  static getConfigElement() {
    return document.createElement("smartmouse-input-card-editor");
  }

  static getStubConfig() {
    return { type: "custom:smartmouse-input-card", inputType: "buffered" };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config: any) { 
    const oldConfig = this._config as any;
    this._config = config; 
    
    if (this.rendered && (oldConfig?.inputType !== config.inputType || oldConfig?.device_id !== config.device_id)) {
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
      display: "flex",
      gap: "8px",
      padding: "0",
      background: "transparent",
      border: "none",
    });

    const isLive = (this._config as any).inputType === "live";

    if (isLive) {
      // --- LIVE INPUT WRAPPER ---
      const liveWrapper = document.createElement("form");
      Object.assign(liveWrapper.style, { position: "relative", width: "100%", margin: "0", padding: "0" });
      
      liveWrapper.addEventListener("submit", (e) => {
        e.preventDefault();
        this.serviceManager.sendKey(40, "send"); // Enter
      });

      const liveInput = document.createElement("input");
      liveInput.type = "password"; 
      liveInput.value = " ";
      Object.assign(liveInput.style, {
        width: "100%", padding: "12px", borderRadius: "var(--ha-card-border-radius, 8px)", boxSizing: "border-box",
        background: "var(--dark, #2a2b2e)", border: "0px",
        color: "transparent", fontSize: "14px", textAlign: "center"
      });

      const kbIcon = document.createElement("ha-icon");
      kbIcon.setAttribute("icon", "mdi:keyboard");
      Object.assign(kbIcon.style, {
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none"
      });

      liveWrapper.append(liveInput, kbIcon);

      // Live Input Logic
      liveInput.addEventListener("input", () => {
        const val = liveInput.value;
        const diff = val.length - this.lastInputValue.length;
        
        if (val.length < 1) {
           this.serviceManager.sendKey(42, "send"); // Backspace
           setTimeout(() => { liveInput.value = " "; this.lastInputValue = " "; }, 0);
           return;
        }

        if (diff > 0) {
            const added = val.slice(this.lastInputValue.length);
            if (added) this.serviceManager.sendText(added);
        } else if (diff < 0) {
            for(let i=0; i<Math.abs(diff); i++) this.serviceManager.sendKey(42, "send");
        }

        this.lastInputValue = val;
        if (val.length > 30) setTimeout(() => { liveInput.value = " "; this.lastInputValue = " "; }, 0);
      });

      liveInput.addEventListener("blur", () => { liveInput.value = " "; this.lastInputValue = " "; });
      
      root.append(liveWrapper);
    } else {
      // --- STANDARD TEXT INPUT ---
      const textInput = document.createElement("input");
      textInput.type = "text";
      textInput.placeholder = "Type to send...";
      Object.assign(textInput.style, {
        flex: "1", padding: "12px", borderRadius: "var(--ha-card-border-radius, 8px)", boxSizing: "border-box",
        background: "var(--dark, #2a2b2e)", border: "0px",
        color: "var(--primary-text-color, #fff)", fontSize: "14px", outline: "none"
      });

      textInput.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          if (textInput.value) {
            this.serviceManager.sendText(textInput.value);
            textInput.value = "";
          } else {
            this.serviceManager.sendKey(40, "send"); // Enter key
          }
        }
      });

      root.append(textInput);
    }

    this.shadowRoot?.appendChild(root);
  }
}

customElements.define("smartmouse-input-card", SmartMouseInputCard);

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "smartmouse-input-card",
  name: "SmartMouse Input",
  description: "Text input buffers for SmartMouse.",
  preview: true
});