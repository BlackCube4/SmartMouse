import { SmartMouseCardBase, computeLabelFactory } from './base-card';
import { html, css } from 'lit';
import { query } from 'lit/decorators.js';
import { attachLiveInput } from './live-input';

const COMPUTE_LABEL = computeLabelFactory({ device_id: 'Target Device', inputType: 'Input Mode' });

class SmartMouseInputCard extends SmartMouseCardBase {
  @query('.live-input') private liveInputEl?: HTMLInputElement;
  private attachedLiveInput?: HTMLInputElement;

  static getConfigForm() {
    return {
      schema: [
        { name: 'device_id', selector: { device: {} } },
        {
          name: 'inputType',
          selector: {
            select: {
              options: [
                { value: 'buffered', label: 'Buffered (Press Enter to send)' },
                { value: 'live', label: 'Live (Sends as you type)' },
              ],
            },
          },
        },
      ],
      computeLabel: COMPUTE_LABEL,
    };
  }

  static getStubConfig() {
    return { type: "custom:smartmouse-input-card", inputType: "buffered" };
  }

  // Wire the shared beforeinput-based capture onto the live input once per
  // element (Lit recreates it when inputType toggles between live/buffered).
  protected updated() {
    const el = this.liveInputEl;
    if (el && el !== this.attachedLiveInput && this.serviceManager) {
      this.attachedLiveInput = el;
      attachLiveInput(el, this.serviceManager);
    }
  }

  private handleBufferedKeydown = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      const input = e.target as HTMLInputElement;
      if (input.value) {
        this.serviceManager.sendText(input.value);
        input.value = "";
      } else {
        this.serviceManager.sendKey(40, "send"); // Enter key
      }
    }
  };

  protected render() {
    if (this._config.inputType === "live") {
      return html`
        <div class="wrapper">
          <input
            class="live-input"
            type="text"
            inputmode="text"
            enterkeyhint="enter"
            data-1p-ignore="true"
            data-bwignore="true"
            data-lpignore="true"
            data-form-type="other"
          >
          <ha-icon icon="mdi:keyboard"></ha-icon>
        </div>
      `;
    }

    return html`
      <input
        class="buffered-input"
        type="text"
        placeholder="Type to send..."
        @keydown=${this.handleBufferedKeydown}
      >
    `;
  }

  static styles = css`
    :host { display: flex; gap: 8px; }
    .wrapper { position: relative; width: 100%; margin: 0; padding: 0; }
    .live-input {
      width: 100%; padding: 12px; border-radius: var(--ha-card-border-radius, 8px); box-sizing: border-box;
      background: var(--dark, #2a2b2e); border: 0px;
      color: transparent; font-size: 14px; text-align: center;
    }
    ha-icon {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none;
    }
    .buffered-input {
      flex: 1; padding: 12px; border-radius: var(--ha-card-border-radius, 8px); box-sizing: border-box;
      background: var(--dark, #2a2b2e); border: 0px;
      color: var(--primary-text-color, #fff); font-size: 14px; outline: none;
    }
  `;
}

customElements.define("smartmouse-input-card", SmartMouseInputCard);

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "smartmouse-input-card",
  name: "SmartMouse Input",
  description: "Text input buffers for SmartMouse.",
  preview: true
});
