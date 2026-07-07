import { SmartMouseCardEditorBase, SmartMouseCardBase } from './base-card';
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('smartmouse-input-card-editor')
export class SmartMouseInputCardEditor extends SmartMouseCardEditorBase {
  protected renderExtraOptions() {
    return html`
      <div class="option">
        <label>Input Mode</label>
        <select .value=${this._config.inputType || 'buffered'} @change=${(e: any) => this._valueChanged(e, 'inputType')}>
          <option value="buffered">Buffered (Press Enter to send)</option>
          <option value="live">Live (Sends as you type)</option>
        </select>
      </div>
    `;
  }
}

class SmartMouseInputCard extends SmartMouseCardBase {
  private lastInputValue = " ";

  static getConfigElement() {
    return document.createElement("smartmouse-input-card-editor");
  }

  static getStubConfig() {
    return { type: "custom:smartmouse-input-card", inputType: "buffered" };
  }

  protected reconnectKeys() {
    return ['device_id', 'inputType'];
  }

  protected buildCard() {
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
      const liveWrapper = document.createElement("div");
      Object.assign(liveWrapper.style, { position: "relative", width: "100%", margin: "0", padding: "0" });
      
      liveWrapper.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.serviceManager.sendKey(40, "send"); // Enter
          setTimeout(() => {
            liveInput.value = " ";
            this.lastInputValue = " ";
          }, 0);
        }
      });

      const liveInput = document.createElement("input");
      liveInput.type = "password"; 
      liveInput.setAttribute("data-1p-ignore", "true");
      liveInput.setAttribute("data-bwignore", "true");
      liveInput.setAttribute("data-lpignore", "true");
      liveInput.setAttribute("data-form-type", "other");
      liveInput.autocomplete = "off";
      liveInput.setAttribute("autocorrect", "off");
      liveInput.setAttribute("autocapitalize", "none");
      liveInput.spellcheck = false;
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
        setTimeout(() => { liveInput.value = " "; this.lastInputValue = " "; }, 0);
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