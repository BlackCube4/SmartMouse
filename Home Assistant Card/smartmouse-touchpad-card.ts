import { TouchpadHandler } from './touchpad-handler';
import { SmartMouseCardBase, computeLabelFactory } from './base-card';
import { html, css } from 'lit';
import { query } from 'lit/decorators.js';

const COMPUTE_LABEL = computeLabelFactory({
  device_id: 'Target Device',
  mouseSensitivity: 'Touchpad Sensitivity (Default: 1.8)',
  scrollSensitivity: 'Scroll Sensitivity (Default: 3.0)',
  scrollType: 'Scroll Type',
  invertScroll: 'Invert Scroll Direction',
});

class SmartMouseTouchpadCard extends SmartMouseCardBase {
  private touchpadHandler!: TouchpadHandler;

  @query('.pad') private padEl!: HTMLElement;
  @query('.scroll-area') private scrollAreaEl!: HTMLElement;

  static getConfigForm() {
    return {
      schema: [
        { name: 'device_id', selector: { device: {} } },
        { name: 'mouseSensitivity', selector: { number: { mode: 'box', step: 0.1 } } },
        { name: 'scrollSensitivity', selector: { number: { mode: 'box', step: 0.1 } } },
        {
          name: 'scrollType',
          selector: {
            select: {
              options: [
                { value: 'touchpad', label: 'High-Resolution (Precision Touchpad)' },
                { value: 'wheel', label: 'Standard (Mouse Wheel)' },
              ],
            },
          },
        },
        { name: 'invertScroll', selector: { boolean: {} } },
      ],
      computeLabel: COMPUTE_LABEL,
    };
  }
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
