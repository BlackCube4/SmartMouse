import { ServiceManager } from './service-manager';
import { GyroHandler } from './gyro-handler';
import { HomeAssistant, SmartMouseConfig } from './types';

class SmartMouseGyroCardEditor extends HTMLElement {
  private _config: any;

  setConfig(config: any) {
    this._config = config;
    this.render();
  }

  render() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }
    this.shadowRoot!.innerHTML = `
      <div class="card-config">
        <div class="option">
          <label>Gyro Mode</label>
          <select id="gyro-mode">
            <option value="relative" ${this._config.gyroMode !== 'absolute' ? 'selected' : ''}>Relative (Standard Air Mouse)</option>
            <option value="absolute" ${this._config.gyroMode === 'absolute' ? 'selected' : ''}>Absolute (Laser Pointer)</option>
          </select>
        </div>
        <div class="option">
          <label>Custom Button Text (Optional)</label>
          <input type="text" id="button-text" value="${this._config.buttonText || ''}" placeholder="Default">
        </div>
        <div class="option">
          <label>Custom Button Icon (Optional)</label>
          <input type="text" id="button-icon" value="${this._config.buttonIcon || ''}" placeholder="e.g. mdi:laser-pointer">
        </div>
        <div class="option" style="flex-direction: row; align-items: center; gap: 8px;">
          <input type="checkbox" id="hide-text" style="width: auto; margin: 0;" ${this._config.hideText ? 'checked' : ''}>
          <label style="cursor: pointer;" for="hide-text">Hide Button Text</label>
        </div>
      </div>
      <style>
        .card-config { display: flex; flex-direction: column; gap: 12px; }
        .option { display: flex; flex-direction: column; gap: 4px; }
        label { font-size: 14px; font-weight: 500; color: var(--primary-text-color, #fff); }
        select, input { padding: 8px; border-radius: 4px; background: var(--card-background-color, #2a2b2e); color: var(--primary-text-color, #fff); border: 1px solid var(--divider-color, #3a3b3d); }
      </style>
    `;

    const select = this.shadowRoot!.querySelector("#gyro-mode") as HTMLSelectElement;
    select.addEventListener("change", () => {
      const newConfig = { ...this._config, gyroMode: select.value };
      this.dispatchEvent(new CustomEvent("config-changed", {
        detail: { config: newConfig },
        bubbles: true,
        composed: true,
      }));
    });

    ['button-text', 'button-icon'].forEach(id => {
      const el = this.shadowRoot!.querySelector(`#${id}`) as HTMLInputElement;
      el.addEventListener("input", (e) => {
        const key = id === 'button-text' ? 'buttonText' : 'buttonIcon';
        const val = (e.target as HTMLInputElement).value;
        const newConfig = { ...this._config, [key]: val };
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: newConfig }, bubbles: true, composed: true }));
      });
    });

    const hideTextEl = this.shadowRoot!.querySelector("#hide-text") as HTMLInputElement;
    hideTextEl.addEventListener("change", (e) => {
      const newConfig = { ...this._config, hideText: (e.target as HTMLInputElement).checked };
      this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: newConfig }, bubbles: true, composed: true }));
    });
  }
}
customElements.define("smartmouse-gyro-card-editor", SmartMouseGyroCardEditor);

class SmartMouseGyroCard extends HTMLElement {
  private _hass?: HomeAssistant;
  private _config: any = {};
  private serviceManager!: ServiceManager;
  private gyroHandler!: GyroHandler;
  private rendered = false;

  static getConfigElement() { return document.createElement("smartmouse-gyro-card-editor"); }
  static getStubConfig() { return { type: "custom:smartmouse-gyro-card", gyroMode: "relative" }; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config: any) { 
    const oldConfig = this._config as any;
    this._config = config; 
    if (this.rendered && (oldConfig?.gyroMode !== config.gyroMode || oldConfig?.buttonText !== config.buttonText || oldConfig?.buttonIcon !== config.buttonIcon || oldConfig?.hideText !== config.hideText)) {
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