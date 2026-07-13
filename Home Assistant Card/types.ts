export interface SmartMouseConfig {
  type: string;
  device_id?: string;
  mouseSensitivity?: number;
  scrollSensitivity?: number;
  gyroSensitivity?: number;
  smoothing?: number;
  gyroTightenThreshold?: number;
  suppressionOffset?: number;
  doubleClickTime?: number;
  holdTime?: number;
  movementDeadzone?: number;
  debug?: boolean;
  debugPrint?: boolean;
  scrollType?: "touchpad" | "wheel";
  invertScroll?: boolean;
}

export interface HomeAssistant {
  states: Record<string, any>;
  callService(domain: string, service: string, data?: Record<string, any>): void;
}

export type MouseButton = "left" | "right" | "middle";
export type KeyMode = "press" | "release" | "send" | "click" | "down" | "up";

// The transport-agnostic surface every gesture/sensor handler depends on.
// Implemented by ServiceManager (Home Assistant services) and WsServiceManager
// (raw WebSocket, for the firmware's standalone page).
export interface IServiceManager {
  config: SmartMouseConfig;
  sendMove(dx: number, dy: number): void;
  sendMoveAbsolute(x: number, y: number): void;
  sendButton(button: MouseButton, mode: KeyMode): void;
  sendScrollWheel(delta: number): void;
  sendTouchpadScroll(dx: number, dy: number): void;
  sendKey(keycode: number, mode: KeyMode): void;
  sendMediaKey(code: number, mode?: KeyMode): void;
  sendText(text: string): void;
}