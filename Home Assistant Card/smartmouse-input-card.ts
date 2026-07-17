import { SmartMouseCardBase, computeLabelFactory } from './base-card';
import { html, css } from 'lit';
import { query } from 'lit/decorators.js';
import { attachLiveInput, attachPredictiveInput, LIVE_INPUT_DEBUG_EVENT, LiveInputDebugDetail } from './live-input';

const COMPUTE_LABEL = computeLabelFactory({
  device_id: 'Target Device',
  inputType: 'Input Mode',
  predictiveIdleSeconds: 'Predictive: Clear After Idle (s)',
  debugVisible: 'Debug: Show Raw Text',
});

const DEFAULT_PREDICTIVE_IDLE_SECONDS = 4;

// Substitute otherwise-invisible whitespace with a visible glyph for the
// debug readout, matching the "render whitespace" convention most code
// editors use. The zero-width-space anchor character (see live-input.ts)
// gets its own distinct glyph rather than reusing the regular-space one, so
// it's visually obvious in the readout which spaces are real (typed) and
// which are our own internal padding.
const WHITESPACE_GLYPHS: Record<string, string> = { ' ': '·', '\t': '→', '\n': '¶', '\r': '', '\u200B': '_' };
const CURSOR_GLYPH = '|';

function renderDebugText(detail: LiveInputDebugDetail): string {
  const chars = Array.from(detail.value).map((c) => WHITESPACE_GLYPHS[c] ?? c);
  const lo = Math.min(detail.selectionStart, detail.selectionEnd);
  const hi = Math.max(detail.selectionStart, detail.selectionEnd);
  if (lo === hi) {
    chars.splice(lo, 0, CURSOR_GLYPH);
  } else {
    chars.splice(hi, 0, ']');
    chars.splice(lo, 0, '[');
  }
  return chars.join('');
}

class SmartMouseInputCard extends SmartMouseCardBase {
  @query('.live-input') private liveInputEl?: HTMLInputElement;
  @query('.predictive-input') private predictiveInputEl?: HTMLInputElement;
  @query('.debug-readout') private debugReadoutEl?: HTMLElement;
  private attachedInput?: HTMLInputElement;

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
                { value: 'predictive', label: 'Predictive (keeps autocorrect/prediction)' },
              ],
            },
          },
        },
        { name: 'predictiveIdleSeconds', selector: { number: { mode: 'box', min: 1, max: 60, step: 1, unit_of_measurement: 's' } } },
        { name: 'debugVisible', selector: { boolean: {} } },
      ],
      computeLabel: COMPUTE_LABEL,
    };
  }

  static getStubConfig() {
    return { type: "custom:smartmouse-input-card", inputType: "buffered" };
  }

  // Wire the shared capture onto whichever input element is currently
  // rendered, once per element (Lit recreates it when inputType changes).
  protected updated() {
    const el = this.liveInputEl || this.predictiveInputEl;
    if (el && el !== this.attachedInput && this.serviceManager) {
      this.attachedInput = el;
      // Listen before attaching, so the initial anchor-space emit fired
      // synchronously during attach isn't missed.
      el.addEventListener(LIVE_INPUT_DEBUG_EVENT, (e: Event) => {
        if (this.debugReadoutEl) this.debugReadoutEl.textContent = renderDebugText((e as CustomEvent<LiveInputDebugDetail>).detail);
      });
      if (this.liveInputEl) attachLiveInput(el, this.serviceManager);
      else {
        const idleSeconds = this._config.predictiveIdleSeconds ?? DEFAULT_PREDICTIVE_IDLE_SECONDS;
        attachPredictiveInput(el, this.serviceManager, idleSeconds * 1000);
      }
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

  private renderDebugReadout() {
    return this._config.debugVisible ? html`<div class="debug-readout"></div>` : '';
  }

  protected render() {
    if (this._config.inputType === "live") {
      return html`
        <div class="wrapper">
          <div class="input-row">
            <input
              class="live-input"
              type="password"
              data-1p-ignore="true"
              data-bwignore="true"
              data-lpignore="true"
              data-form-type="other"
            >
            <ha-icon icon="mdi:keyboard"></ha-icon>
          </div>
          ${this.renderDebugReadout()}
        </div>
      `;
    }

    if (this._config.inputType === "predictive") {
      return html`
        <div class="wrapper">
          <div class="input-row">
            <input class="predictive-input" type="text">
            <ha-icon icon="mdi:keyboard"></ha-icon>
          </div>
          ${this.renderDebugReadout()}
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
    .wrapper { display: flex; flex-direction: column; gap: 6px; width: 100%; margin: 0; padding: 0; }
    .input-row { position: relative; width: 100%; }
    .live-input, .predictive-input {
      width: 100%; padding: 12px; border-radius: var(--ha-card-border-radius, 8px); box-sizing: border-box;
      background: var(--dark, #2a2b2e); border: 0px;
      color: transparent; font-size: 14px; text-align: center;
    }
    ha-icon {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none;
    }
    .debug-readout {
      font-family: monospace; font-size: 11px; text-align: left;
      white-space: pre-wrap; word-break: break-all;
      padding: 4px 8px; border-radius: 4px;
      background: rgba(0, 0, 0, 0.15); color: var(--secondary-text-color, #aaa);
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
