import { HomeAssistant, SmartMouseConfig, MouseButton, KeyMode, IServiceManager } from './types';

export class ServiceManager implements IServiceManager {
  constructor(public hass?: HomeAssistant, public config: SmartMouseConfig = {} as SmartMouseConfig) {}

  private _log(action: string, data: any): void {
    if (this.config.debugPrint) {
      console.log(`[SmartMouse] ${action}`, data);
    }
  }

  private _call(service: string, payload: any): void {
    if (!this.hass) return;
    if (this.config.device_id) {
      payload.device_id = this.config.device_id;
    }
    this._log(service, payload);
    this.hass.callService("smartmouse", service, payload);
  }

  sendMove(dx: number, dy: number): void {
    this._call("move", { x: dx, y: dy });
  }

  sendMoveAbsolute(x: number, y: number): void {
    this._call("move_absolute", { x, y });
  }

  sendButton(button: MouseButton, mode: KeyMode): void {
    this._call("button", { button, mode });
  }

  sendScrollWheel(delta: number): void {
    this._call("scroll_wheel", { delta });
  }

  sendTouchpadScroll(dx: number, dy: number): void {
    this._call("touchpad_scroll", { x: dx, y: dy });
  }

  sendKey(keycode: number, mode: KeyMode): void {
    this._call("key_control", { keycode, mode });
  }

  sendMediaKey(code: number, mode: KeyMode = "send"): void {
    this._call("media_control", { code, mode });
  }

  sendText(text: string): void {
    this._call("text_send", { text });
  }
}