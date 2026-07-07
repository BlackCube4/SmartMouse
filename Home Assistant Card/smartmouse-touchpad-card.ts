import { TouchpadHandler } from './touchpad-handler';
import { SmartMouseCardEditorBase, SmartMouseCardBase } from './base-card';
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('smartmouse-touchpad-card-editor')
export class SmartMouseTouchpadCardEditor extends SmartMouseCardEditorBase {
  protected renderExtraOptions() {
    return html`
      <div class="option">
        <label>Touchpad Sensitivity (Default: 1.8)</label>
        <input type="number" step="0.1" .value=${this._config.mouseSensitivity ?? 1.8} @input=${(e: any) => this._valueChanged(e, 'mouseSensitivity')}>
      </div>
      <div class="option">
        <label>Scroll Sensitivity (Default: 3.0)</label>
        <input type="number" step="0.1" .value=${this._config.scrollSensitivity ?? 3.0} @input=${(e: any) => this._valueChanged(e, 'scrollSensitivity')}>
      </div>
      <div class="option">
        <label>Scroll Type</label>
        <select .value=${this._config.scrollType || 'touchpad'} @change=${(e: any) => this._valueChanged(e, 'scrollType')}>
          <option value="touchpad">High-Resolution (Precision Touchpad)</option>
          <option value="wheel">Standard (Mouse Wheel)</option>
        </select>
      </div>
      <div class="option" style="flex-direction: row; align-items: center; gap: 8px;">
        <input type="checkbox" id="invert-scroll" style="width: auto; margin: 0;" .checked=${this._config.invertScroll || false} @change=${(e: any) => this._valueChanged(e, 'invertScroll')}>
        <label style="cursor: pointer;" for="invert-scroll">Invert Scroll Direction</label>
      </div>
    `;
  }
}

class SmartMouseTouchpadCard extends SmartMouseCardBase {
  private touchpadHandler!: TouchpadHandler;

  static getConfigElement() { return document.createElement("smartmouse-touchpad-card-editor"); }
  static getStubConfig() { return { type: "custom:smartmouse-touchpad-card" }; }

  protected onConfigUpdated(config: any) {
    if (this.serviceManager) {
      this.serviceManager.config = config;
    }
    if (this.touchpadHandler) {
      this.touchpadHandler.updateConfig(config);
    }
  }

  protected buildCard() {
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