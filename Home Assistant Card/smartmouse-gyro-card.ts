import { GyroHandler } from './gyro-handler';
import { SmartMouseCardBase, computeLabelFactory } from './base-card';
import { html, css } from 'lit';
import { query } from 'lit/decorators.js';

const COMPUTE_LABEL = computeLabelFactory({
  device_id: 'Target Device',
  gyroMode: 'Gyro Mode',
  buttonText: 'Custom Button Text (Optional)',
  buttonIcon: 'Custom Button Icon (Optional)',
  hideText: 'Hide Button Text',
});

class SmartMouseGyroCard extends SmartMouseCardBase {
  private gyroHandler!: GyroHandler;
  private pressTimer: number | null = null;
  private isLongPress = false;

  @query('.gyro-btn') private btnEl?: HTMLElement;
  @query('.debug') private debugEl?: HTMLElement;

  static getConfigForm() {
    return {
      schema: [
        { name: 'device_id', selector: { device: {} } },
        {
          name: 'gyroMode',
          selector: {
            select: {
              options: [
                { value: 'relative', label: 'Relative (Standard Air Mouse)' },
                { value: 'absolute', label: 'Absolute (Laser Pointer)' },
              ],
            },
          },
        },
        { name: 'buttonText', selector: { text: {} } },
        { name: 'buttonIcon', selector: { icon: {} } },
        { name: 'hideText', selector: { boolean: {} } },
      ],
      computeLabel: COMPUTE_LABEL,
    };
  }
  static getStubConfig() { return { type: "custom:smartmouse-gyro-card", gyroMode: "relative" }; }

  // Only recreate the handler when device_id/gyroMode actually change -
  // cosmetic fields (buttonText/buttonIcon/hideText) just re-render.
  protected onConfigUpdated(config: any, oldConfig: any) {
    const needsNewHandler = !this.gyroHandler || !oldConfig ||
      oldConfig.device_id !== config.device_id || oldConfig.gyroMode !== config.gyroMode;
    if (needsNewHandler) {
      this.gyroHandler = new GyroHandler(this.serviceManager, config);
    }
  }

  protected updated() {
    if (this.debugEl) {
      this.gyroHandler.debugElem = this.debugEl;
    }
    // GyroHandler owns the button's innerHTML while calibrating - don't fight it.
    if (this.btnEl && !this.gyroHandler.calibrating) {
      this.syncButtonContent(this.btnEl, this._config.gyroMode === "absolute");
    }
  }

  // The gyro button's inner markup (icon+text) is set imperatively rather than
  // via Lit bindings, because GyroHandler also writes to it directly during
  // calibration (innerHTML/style) - mixing the two would corrupt Lit's
  // internal tracking of that node's children.
  private syncButtonContent(btn: HTMLElement, isAbsolute: boolean) {
    const text = this._config.hideText ? "" : (this._config.buttonText || (isAbsolute ? "Absolute" : "Relative"));
    const icon = this._config.buttonIcon || (isAbsolute ? "mdi:bullseye" : "mdi:ray-start-arrow");
    const iconMargin = text ? "4px" : "0px";
    btn.innerHTML = `<ha-icon icon="${icon}" style="margin-bottom: ${iconMargin}; pointer-events: none;"></ha-icon>${text}`;
  }

  private cancelPress = () => {
    if (this.pressTimer) { clearTimeout(this.pressTimer); this.pressTimer = null; }
  };

  private handleAbsPointerDown = (e: Event) => {
    e.preventDefault();
    this.isLongPress = false;
    this.pressTimer = window.setTimeout(() => {
      this.isLongPress = true;
      if (!this.gyroHandler.calibrating) {
        this.gyroHandler.startCalibration(this.btnEl);
        navigator.vibrate?.([50]);
      }
    }, 600); // 600ms long press to manually calibrate
  };

  private handleAbsPointerUp = (e: Event) => {
    e.preventDefault();
    this.cancelPress();
    if (this.isLongPress) return;
    if (this.gyroHandler.calibrating) {
      return; // Let calibration finish
    } else if (!this.gyroHandler.isCalibrated) {
      this.gyroHandler.startCalibration(this.btnEl); // Start required calibration
    } else {
      this.gyroHandler.toggleGyroAbsolute().then(() => {
        if (this.btnEl) {
          this.btnEl.style.background = this.gyroHandler.gyroAbsoluteActive ? "var(--primary-color, #666)" : "var(--dark, #2b2c2f)";
        }
      });
    }
  };

  private handleRelClick = () => {
    this.gyroHandler.toggleGyroRelative().then(() => {
      if (this.btnEl) {
        this.btnEl.style.background = this.gyroHandler.gyroRelativeActive ? "var(--primary-color, #666)" : "var(--dark, #2b2c2f)";
      }
    });
  };

  protected render() {
    const isAbsolute = this._config.gyroMode === "absolute";
    return html`
      ${isAbsolute
        ? html`<button
            class="gyro-btn"
            @pointerdown=${this.handleAbsPointerDown}
            @pointerup=${this.handleAbsPointerUp}
            @pointercancel=${this.cancelPress}
            @pointerleave=${this.cancelPress}
          ></button>`
        : html`<button class="gyro-btn" @click=${this.handleRelClick}></button>`}
      ${this._config.debug ? html`<div class="debug">Initializing Sensors...</div>` : ''}
    `;
  }

  static styles = css`
    :host { display: flex; flex-direction: column; gap: 8px; }
    .gyro-btn {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 72px;
      padding: 12px; border-radius: var(--ha-card-border-radius, 8px); background: var(--dark, #2b2c2f);
      color: var(--primary-text-color, #fff); border: none; cursor: pointer; touch-action: manipulation;
    }
    .debug {
      padding: 8px; background: rgba(0,0,0,0.2); border-radius: 4px;
      font-family: monospace; font-size: 11px; white-space: pre-wrap;
    }
  `;

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
