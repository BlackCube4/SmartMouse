import { SmartMouseCardBase, computeLabelFactory } from './base-card';
import { html, css } from 'lit';
import { state } from 'lit/decorators.js';

const COMPUTE_LABEL = computeLabelFactory({ device_id: 'Target Device' });

interface ModifierKey {
  label: string;
  code: number;
  toggle: boolean;
}

const MODIFIER_KEYS: ModifierKey[] = [
  { label: "Ctrl", code: 224, toggle: true },
  { label: "Shift", code: 225, toggle: true },
  { label: "Alt", code: 226, toggle: true },
  { label: "Win", code: 227, toggle: true },
  { label: "ESC", code: 41, toggle: false },
];

class SmartMouseModifierCard extends SmartMouseCardBase {
  @state() private modifierState: Record<string, boolean> = { ctrl: false, shift: false, alt: false, win: false };

  static getConfigForm() {
    return {
      schema: [
        { name: 'device_id', selector: { device: {} } },
      ],
      computeLabel: COMPUTE_LABEL,
    };
  }

  static getStubConfig() {
    return { type: "custom:smartmouse-modifier-card" };
  }

  private handleClick(key: ModifierKey) {
    if (key.toggle) {
      const stateKey = key.label.toLowerCase();
      const active = !this.modifierState[stateKey];
      this.modifierState = { ...this.modifierState, [stateKey]: active };
      this.serviceManager.sendKey(key.code, active ? "press" : "release");
    } else {
      this.serviceManager.sendKey(key.code, "send");
    }
    navigator.vibrate?.([30]);
  }

  protected render() {
    return html`
      <div class="grid">
        ${MODIFIER_KEYS.map(key => html`
          <button
            class=${key.toggle && this.modifierState[key.label.toLowerCase()] ? 'active' : ''}
            @click=${() => this.handleClick(key)}
          >${key.label}</button>
        `)}
      </div>
    `;
  }

  static styles = css`
    .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
    button {
      display: flex; align-items: center; justify-content: center;
      padding: 12px 4px; border-radius: var(--ha-card-border-radius, 8px);
      background: var(--dark, #2b2c2f); color: var(--primary-text-color, #fff);
      border: none; cursor: pointer; font-size: 14px; font-weight: 600; touch-action: manipulation;
    }
    button.active { background: var(--primary-color, #666); }
  `;
}

customElements.define("smartmouse-modifier-card", SmartMouseModifierCard);

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "smartmouse-modifier-card",
  name: "SmartMouse Modifiers",
  description: "Toggleable modifier keys for SmartMouse.",
  preview: true
});
