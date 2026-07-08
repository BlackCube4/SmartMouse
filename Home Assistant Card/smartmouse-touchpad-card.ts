import { TouchpadHandler } from './touchpad-handler';
import { SmartMouseCardEditorBase, SmartMouseCardBase } from './base-card';
import { html, css } from 'lit';
import { customElement, query } from 'lit/decorators.js';

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

  @query('.pad') private padEl!: HTMLElement;
  @query('.scroll-area') private scrollAreaEl!: HTMLElement;

  static getConfigElement() { return document.createElement("smartmouse-touchpad-card-editor"); }
  static getStubConfig() { return { type: "custom:smartmouse-touchpad-card" }; }

  protected onConfigUpdated(config: any) {
    if (this.touchpadHandler) {
      this.touchpadHandler.updateConfig(config);
    }
  }

  protected firstUpdated() {
    this.touchpadHandler = new TouchpadHandler(this.serviceManager, this._config);
    this.touchpadHandler.setupPad(this.padEl);
    this.touchpadHandler.setupScrollArea(this.scrollAreaEl);
  }

  protected render() {
    return html`
      <div class="pad">Touchpad</div>
      <div class="divider"></div>
      <div class="scroll-area">☰</div>
    `;
  }

  static styles = css`
    :host {
      display: flex;
      height: 220px;
      width: 100%;
      border-radius: var(--ha-card-border-radius, 10px);
      overflow: hidden;
      border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, #2b2c2f);
      background: var(--ha-card-background, #1e1f22);
      box-shadow: var(--ha-card-box-shadow);
      color: var(--primary-text-color, #fff);
      user-select: none;
    }
    .pad {
      flex: 1;
      background: var(--dark, #2a2b2e);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      touch-action: none;
    }
    .divider {
      width: 1px;
      background: var(--divider-color, #3a3b3d);
    }
    .scroll-area {
      width: 56px;
      background: var(--dark, #2a2b2e);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      user-select: none;
      touch-action: none;
    }
  `;

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
