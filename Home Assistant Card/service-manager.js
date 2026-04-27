export class ServiceManager {
  constructor(hass, config = {}) {
    this.hass = hass;
    this.config = config;
  }

  _log(action, data) {
    if (this.config.debugPrint) {
      console.log(`[SmartMouse] ${action}`, data);
    }
  }

  sendMove(dx, dy) {
    if (!this.hass) return;
    this._log("move", { x: dx, y: dy });
    this.hass.callService("smartmouse", "move", { x: dx, y: dy });
  }

  sendMoveAbsolute(x, y) {
    if (!this.hass) return;
    this._log("move_absolute", { x: x, y: y });
    this.hass.callService("smartmouse", "move_absolute", { x: x, y: y });
  }

  sendButton(button, mode) {
    if (!this.hass) return;
    this._log("button", { button, mode });
    this.hass.callService("smartmouse", "button", { button: button, mode: mode });
  }

  sendScrollWheel(delta) {
    if (!this.hass) return;
    this._log("scroll_wheel", { delta });
    this.hass.callService("smartmouse", "scroll_wheel", { delta: delta });
  }

  sendTouchpadScroll(dx, dy) {
    if (!this.hass) return;
    this._log("touchpad_scroll", { x: dx, y: dy });
    this.hass.callService("smartmouse", "touchpad_scroll", { x: dx, y: dy });
  }

  sendKey(keycode, mode) {
    if (!this.hass) return;
    this._log("key_control", { keycode, mode });
    this.hass.callService("smartmouse", "key_control", { keycode: keycode, mode: mode });
  }

  sendMediaKey(code, mode = "send") {
    if (!this.hass) return;
    this._log("media_control", { code, mode });
    this.hass.callService("smartmouse", "media_control", { code: code, mode: mode });
  }

  sendText(text) {
    if (!this.hass) return;
    this._log("text_send", { text });
    this.hass.callService("smartmouse", "text_send", { text: text });
  }
}