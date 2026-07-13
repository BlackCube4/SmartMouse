import { SmartMouseCardBase, computeLabelFactory } from './base-card';
import { html, css } from 'lit';

const COMPUTE_LABEL = computeLabelFactory({ device_id: 'Target Device', inputType: 'Input Mode' });

class SmartMouseInputCard extends SmartMouseCardBase {
  private lastInputValue = " ";

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

  private handleLiveWrapperKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      this.serviceManager.sendKey(40, "send"); // Enter
      const input = e.target as HTMLInputElement;
      setTimeout(() => {
        input.value = " ";
        this.lastInputValue = " ";
      }, 0);
    }
  };

  private handleLiveInput = (e: InputEvent) => {
    const input = e.target as HTMLInputElement;
    const val = input.value;
    const diff = val.length - this.lastInputValue.length;

    if (val.length < 1) {
      this.serviceManager.sendKey(42, "send"); // Backspace
      setTimeout(() => { input.value = " "; this.lastInputValue = " "; }, 0);
      return;
    }

    if (diff > 0) {
      const added = val.slice(this.lastInputValue.length);
      if (added) this.serviceManager.sendText(added);
    } else if (diff < 0) {
      for (let i = 0; i < Math.abs(diff); i++) this.serviceManager.sendKey(42, "send");
    }

    this.lastInputValue = val;
    setTimeout(() => { input.value = " "; this.lastInputValue = " "; }, 0);
  };

  private handleLiveBlur = (e: FocusEvent) => {
    const input = e.target as HTMLInputElement;
    input.value = " ";
    this.lastInputValue = " ";
  };

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
        <div class="wrapper" @keydown=${this.handleLiveWrapperKeydown}>
          <input
            class="live-input"
            type="text"
            inputmode="text"
            enterkeyhint="enter"
            data-1p-ignore="true"
            data-bwignore="true"
            data-lpignore="true"
            data-form-type="other"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="none"
            .spellcheck=${false}
            .value=${" "}
            @input=${this.handleLiveInput}
            @blur=${this.handleLiveBlur}
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
