import { GyroHandler } from './gyro-handler';
import { SmartMouseCardEditorBase, SmartMouseCardBase } from './base-card';
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('smartmouse-gyro-card-editor')
export class SmartMouseGyroCardEditor extends SmartMouseCardEditorBase {
  protected renderExtraOptions() {
    return html`
      <div class="option">
        <label>Gyro Mode</label>
        <select .value=${this._config.gyroMode || 'relative'} @change=${(e: any) => this._valueChanged(e, 'gyroMode')}>
          <option value="relative">Relative (Standard Air Mouse)</option>
          <option value="absolute">Absolute (Laser Pointer)</option>
        </select>
      </div>
      <div class="option">
        <label>Custom Button Text (Optional)</label>
        <input type="text" .value=${this._config.buttonText || ''} @input=${(e: any) => this._valueChanged(e, 'buttonText')} placeholder="Default">
      </div>
      <div class="option">
        <label>Custom Button Icon (Optional)</label>
        <input type="text" .value=${this._config.buttonIcon || ''} @input=${(e: any) => this._valueChanged(e, 'buttonIcon')} placeholder="e.g. mdi:laser-pointer">
      </div>
      <div class="option" style="flex-direction: row; align-items: center; gap: 8px;">
        <input type="checkbox" id="hide-text" style="width: auto; margin: 0;" .checked=${this._config.hideText || false} @change=${(e: any) => this._valueChanged(e, 'hideText')}>
        <label style="cursor: pointer;" for="hide-text">Hide Button Text</label>
      </div>
    `;
  }
}

class SmartMouseGyroCard extends SmartMouseCardBase {
  private gyroHandler!: GyroHandler;

  static getConfigElement() { return document.createElement("smartmouse-gyro-card-editor"); }
  static getStubConfig() { return { type: "custom:smartmouse-gyro-card", gyroMode: "relative" }; }

  protected reconnectKeys() {
    return ['device_id', 'gyroMode', 'buttonText', 'buttonIcon', 'hideText'];
  }

  protected buildCard() {
    this.gyroHandler = new GyroHandler(this.serviceManager, this._config);

    const root = document.createElement("div");
    Object.assign(root.style, {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      padding: "0",
      background: "transparent",
      border: "none",
    });

    const createBtn = (text: string, icon: string, handler: (() => void) | null = null) => {
      const btn = document.createElement("button");
      Object.assign(btn.style, {
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "12px", borderRadius: "var(--ha-card-border-radius, 8px)", background: "var(--dark, #2b2c2f)",
        color: "var(--primary-text-color, #fff)", border: "none", cursor: "pointer", touchAction: "none"
      });
      const iconMargin = text ? "4px" : "0px";
      btn.innerHTML = `<ha-icon icon="${icon}" style="margin-bottom: ${iconMargin}; pointer-events: none;"></ha-icon>${text}`;
      if (handler) btn.addEventListener("click", handler);
      return btn;
    };

    const isAbsolute = (this._config as any).gyroMode === "absolute";
    const btnText = this._config.hideText ? "" : (this._config.buttonText || (isAbsolute ? "Absolute" : "Relative"));
    const btnIcon = this._config.buttonIcon || (isAbsolute ? "mdi:bullseye" : "mdi:ray-start-arrow");

    if (isAbsolute) {
      const absBtn = createBtn(btnText, btnIcon);
      
      let pressTimer: number | null = null;
      let isLongPress = false;

      const cancelPress = () => {
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      };

      const startPress = (e: Event) => {
        e.preventDefault();
        isLongPress = false;
        pressTimer = window.setTimeout(() => {
          isLongPress = true;
          if (!this.gyroHandler.calibrating) {
            this.gyroHandler.startCalibration(absBtn);
            navigator.vibrate?.([50]);
          }
        }, 600); // 600ms long press to manually calibrate
      };

      const endPress = (e: Event) => {
        e.preventDefault();
        cancelPress();
        if (!isLongPress) {
          if (this.gyroHandler.calibrating) {
            return; // Let calibration finish
          } else if (!this.gyroHandler.isCalibrated) {
            this.gyroHandler.startCalibration(absBtn); // Start required calibration
          } else {
            this.gyroHandler.toggleGyroAbsolute().then(() => {
              absBtn.style.background = this.gyroHandler.gyroAbsoluteActive ? "var(--primary-color, #666)" : "var(--dark, #2b2c2f)";
            });
          }
        }
      };

      absBtn.addEventListener("pointerdown", startPress);
      absBtn.addEventListener("pointerup", endPress);
      absBtn.addEventListener("pointercancel", cancelPress);
      absBtn.addEventListener("pointerleave", cancelPress);

      root.append(absBtn);
    } else {
      const relBtn = createBtn(btnText, btnIcon, () => {
        this.gyroHandler.toggleGyroRelative().then(() => {
          relBtn.style.background = this.gyroHandler.gyroRelativeActive ? "var(--primary-color, #666)" : "var(--dark, #2b2c2f)";
        });
      });
      root.append(relBtn);
    }

    if (this._config.debug) {
      const debugRow = document.createElement("div");
      Object.assign(debugRow.style, {
        padding: "8px",
        background: "rgba(0,0,0,0.2)",
        borderRadius: "4px",
        fontFamily: "monospace",
        fontSize: "11px",
        whiteSpace: "pre-wrap"
      });
      debugRow.textContent = "Initializing Sensors...";
      this.gyroHandler.debugElem = debugRow;
      root.appendChild(debugRow);
    }

    this.shadowRoot?.appendChild(root);
  }

  getCardSize() { return 1; }
}

customElements.define("smartmouse-gyro-card", SmartMouseGyroCard);

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "smartmouse-gyro-card",
  name: "SmartMouse Gyro",
  description: "Gyroscope controls (Air Mouse) for SmartMouse.",
  preview: true
});