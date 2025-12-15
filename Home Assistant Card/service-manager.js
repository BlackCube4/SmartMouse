export class ServiceManager {
  constructor(hass, config = {}) {
    this.hass = hass;
    this.config = config;
  }

  _log(action, data) {
    if (this.config.debugPrint) {
      console.log(`[KeyMouse] ${action}`, data);
    }
  }

  sendMove(dx, dy) {
    if (!this.hass) return;
    this._log("move", { x: dx, y: dy });
    this.hass.callService("esp_mouse", "move", { x: dx, y: dy });
  }

  sendMoveAbsolute(x, y) {
    if (!this.hass) return;
    this._log("move_absolute", { x: x, y: y });
    this.hass.callService("esp_mouse", "move_absolute", { x: x, y: y });
  }

  sendButton(button, mode) {
    if (!this.hass) return;
    this._log("button", { button, mode });
    this.hass.callService("esp_mouse", "button", { button: button, mode: mode });
  }

  sendScrollWheel(delta) {
    if (!this.hass) return;
    this._log("scroll_wheel", { delta });
    this.hass.callService("esp_mouse", "scroll_wheel", { delta: delta });
  }

  sendTouchpadScroll(delta) {
    if (!this.hass) return;
    this._log("touchpad_scroll", { delta });
    this.hass.callService("esp_mouse", "touchpad_scroll", { delta: delta });
  }

  sendKey(keycode, mode) {
    if (!this.hass) return;
    this._log("key_control", { keycode, mode });
    this.hass.callService("esp_mouse", "key_control", { keycode: keycode, mode: mode });
  }

  sendMediaKey(code, mode = "send") {
    if (!this.hass) return;
    this._log("media_control", { code, mode });
    this.hass.callService("esp_mouse", "media_control", { code: code, mode: mode });
  }

  sendText(text) {
    if (!this.hass) return;
    this._log("text_send", { text });
    this.hass.callService("esp_mouse", "text_send", { text: text });
  }
}