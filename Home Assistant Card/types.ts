export interface SmartMouseConfig {
  type: string;
  device_id?: string;
  mouseSensitivity?: number;
  scrollSensitivity?: number;
  gyroSensitivity?: number;
  smoothing?: number;
  suppression_offset?: number;
  double_click_time?: number;
  hold_time?: number;
  movement_deadzone?: number;
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