export class ServiceManager {
  constructor(hass) {
    this.hass = hass;
  }

  sendMove(dx, dy) {
    if (!this.hass) return;
    this.hass.callService("esp_mouse", "move", { x: dx, y: dy });
  }

  sendMoveAbsolute(x, y) {
    if (!this.hass) return;
    this.hass.callService("esp_mouse", "move_absolute", { x: x, y: y });
  }

  sendButton(button, mode) {
    if (!this.hass) return;
    this.hass.callService("esp_mouse", "button", { button: button, mode: mode });
  }

  sendScrollWheel(delta) {
    if (!this.hass) return;
    this.hass.callService("esp_mouse", "scroll_wheel", { delta: delta });
  }

  sendTouchpadScroll(delta) {
    if (!this.hass) return;
    this.hass.callService("esp_mouse", "touchpad_scroll", { delta: delta });
  }

  sendKey(keycode, mode) {
    if (!this.hass) return;
    this.hass.callService("esp_mouse", "key_control", { keycode: keycode, mode: mode });
  }

  sendMediaKey(code, mode = "send") {
    if (!this.hass) return;
    this.hass.callService("esp_mouse", "media_control", { code: code, mode: mode });
  }

  sendText(text) {
    if (!this.hass) return;
    this.hass.callService("esp_mouse", "text_send", { text: text });
  }
}