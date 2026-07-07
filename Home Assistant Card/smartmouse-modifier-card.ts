import { SmartMouseCardEditorBase, SmartMouseCardBase } from './base-card';
import { customElement } from 'lit/decorators.js';

@customElement('smartmouse-modifier-card-editor')
export class SmartMouseModifierCardEditor extends SmartMouseCardEditorBase {}

class SmartMouseModifierCard extends SmartMouseCardBase {
  private modifierState: Record<string, boolean> = { ctrl: false, alt: false, shift: false, win: false };

  static getConfigElement() { return document.createElement("smartmouse-modifier-card-editor"); }

  static getStubConfig() {
    return { type: "custom:smartmouse-modifier-card" };
  }

  protected buildCard() {
    const root = document.createElement("div");
    Object.assign(root.style, {
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      gap: "8px",
      padding: "0",
      background: "transparent",
      border: "none",
    });

    const createBtn = (label: string, code: number, isToggle: boolean) => {
      const btn = document.createElement("button");
      Object.assign(btn.style, {
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "12px 4px", borderRadius: "var(--ha-card-border-radius, 8px)", background: "var(--dark, #2b2c2f)",
        color: "var(--primary-text-color, #fff)", border: "none", cursor: "pointer", 
        fontSize: "14px", fontWeight: "600", touchAction: "none"
      });
      btn.textContent = label;

      if (isToggle) {
        const key = label.toLowerCase();
        btn.addEventListener("click", () => {
          this.modifierState[key] = !this.modifierState[key];
          btn.style.background = this.modifierState[key] ? "var(--primary-color, #666)" : "var(--dark, #2b2c2f)";
          this.serviceManager.sendKey(code, this.modifierState[key] ? "press" : "release");
          navigator.vibrate?.([30]);
        });
      } else {
        btn.addEventListener("click", () => {
          this.serviceManager.sendKey(code, "send");
          navigator.vibrate?.([30]);
        });
      }
      return btn;
    };

    root.append(
      createBtn("Ctrl", 224, true),
      createBtn("Shift", 225, true),
      createBtn("Alt", 226, true),
      createBtn("Win", 227, true),
      createBtn("ESC", 41, false)
    );

    this.shadowRoot?.appendChild(root);
  }
}

customElements.define("smartmouse-modifier-card", SmartMouseModifierCard);

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "smartmouse-modifier-card",
  name: "SmartMouse Modifiers",
  description: "Toggleable modifier keys for SmartMouse.",
  preview: true
});