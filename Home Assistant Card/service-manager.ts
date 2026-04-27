import { HomeAssistant, SmartMouseConfig, MouseButton, KeyMode } from './types';

export class ServiceManager {
  constructor(public hass?: HomeAssistant, public config: SmartMouseConfig = {} as SmartMouseConfig) {}

  private _log(action: string, data: any): void {
    if (this.config.debugPrint) {
      console.log(`[SmartMouse] ${action}`, data);
    }
  }

  sendMove(dx: number, dy: number): void {
    if (!this.hass) return;
    this._log("move", { x: dx, y: dy });
    this.hass.callService("smartmouse", "move", { x: dx, y: dy });
  }

  sendMoveAbsolute(x: number, y: number): void {
    if (!this.hass) return;
    this._log("move_absolute", { x, y });
    this.hass.callService("smartmouse", "move_absolute", { x, y });
  }

  sendButton(button: MouseButton, mode: KeyMode): void {
    if (!this.hass) return;
    this._log("button", { button, mode });
    this.hass.callService("smartmouse", "button", { button, mode });
  }

  sendScrollWheel(delta: number): void {
    if (!this.hass) return;
    this._log("scroll_wheel", { delta });
    this.hass.callService("smartmouse", "scroll_wheel", { delta });
  }

  sendTouchpadScroll(dx: number, dy: number): void {
    if (!this.hass) return;
    this._log("touchpad_scroll", { x: dx, y: dy });
    this.hass.callService("smartmouse", "touchpad_scroll", { x: dx, y: dy });
  }

  sendKey(keycode: number, mode: KeyMode): void {
    if (!this.hass) return;
    this._log("key_control", { keycode, mode });
    this.hass.callService("smartmouse", "key_control", { keycode, mode });
  }

  sendMediaKey(code: number, mode: KeyMode = "send"): void {
    if (!this.hass) return;
    this._log("media_control", { code, mode });
    this.hass.callService("smartmouse", "media_control", { code, mode });
  }

  sendText(text: string): void {
    if (!this.hass) return;
    this._log("text_send", { text });
    this.hass.callService("smartmouse", "text_send", { text });
  }
}