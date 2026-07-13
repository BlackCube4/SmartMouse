import { IServiceManager, SmartMouseConfig, MouseButton, KeyMode } from './types';

// Opcodes — must match SmartMouse.ino and PROTOCOL.md. This is the raw-WebSocket
// transport used by the firmware's standalone page (the HA cards use
// ServiceManager, which goes through hass.callService instead).
const OP = {
  MOUSE_RELATIVE: 0x01, MOUSE_ABSOLUTE: 0x02, MOUSE_PRESS: 0x03, MOUSE_RELEASE: 0x04, MOUSE_CLICK: 0x05,
  KEY_PRESS: 0x11, KEY_RELEASE: 0x12, KEY_SEND: 0x13,
  MEDIA_PRESS: 0x21, MEDIA_RELEASE: 0x22, MEDIA_SEND: 0x23,
  TEXT_SEND: 0x31,
  SCROLL_WHEEL: 0x41, SCROLL_TOUCHPAD: 0x42, SCROLL_END: 0x4F,
  PC_CONTROL: 0xA0, SYSTEM_RESET: 0xFE, AUTH: 0xFF, TELEMETRY: 0xF0,
};

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

export interface TelemetryFrame {
  temp: number;
  rssi: number;
  sleeping: boolean;
  pcState: number;
  caps: number;
}

export interface WsServiceManagerOptions {
  authToken?: string;
  host?: string;
  port?: number;
  onStatus?: (status: WsStatus) => void;
  onTelemetry?: (frame: TelemetryFrame) => void;
}

export class WsServiceManager implements IServiceManager {
  private ws: WebSocket | null = null;
  private gateway: string;
  private authToken: string;
  private onStatus?: (status: WsStatus) => void;
  private onTelemetry?: (frame: TelemetryFrame) => void;

  constructor(public config: SmartMouseConfig = {} as SmartMouseConfig, opts: WsServiceManagerOptions = {}) {
    const host = opts.host ?? window.location.hostname;
    const port = opts.port ?? 81;
    this.gateway = `ws://${host}:${port}/`;
    this.authToken = opts.authToken ?? '';
    this.onStatus = opts.onStatus;
    this.onTelemetry = opts.onTelemetry;
    this.connect();
  }

  private connect() {
    this.onStatus?.('connecting');
    this.ws = new WebSocket(this.gateway);
    this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = () => this.handleOpen();
    this.ws.onclose = () => {
      this.onStatus?.('disconnected');
      setTimeout(() => this.connect(), 2000);
    };
    this.ws.onerror = () => this.ws?.close();
    this.ws.onmessage = (e) => this.handleMessage(e);
  }

  private handleOpen() {
    this.onStatus?.('connected');
    const encoded = new TextEncoder().encode(this.authToken);
    const buffer = new Uint8Array(1 + encoded.length + 1);
    buffer[0] = OP.AUTH;
    buffer.set(encoded, 1);
    buffer[buffer.length - 1] = 0;
    this.ws!.send(buffer);
  }

  private handleMessage(e: MessageEvent) {
    if (!(e.data instanceof ArrayBuffer)) return;
    const view = new DataView(e.data);
    if (view.byteLength === 9 && view.getUint8(0) === OP.TELEMETRY) {
      this.onTelemetry?.({
        temp: view.getFloat32(1, true),
        rssi: view.getInt8(5),
        sleeping: view.getUint8(6) === 1,
        pcState: view.getUint8(7),
        caps: view.getUint8(8),
      });
    }
  }

  private ready(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  private sendCmd(opcode: number, value: number) {
    if (!this.ready()) return;
    this.ws!.send(new Uint8Array([opcode, value]));
  }

  private sendOpInt16(opcode: number, a: number, b: number) {
    if (!this.ready()) return;
    const view = new DataView(new ArrayBuffer(5));
    view.setUint8(0, opcode);
    view.setInt16(1, a, true);
    view.setInt16(3, b, true);
    this.ws!.send(view.buffer);
  }

  // --- IServiceManager (shared gesture surface) ---

  sendMove(dx: number, dy: number): void {
    this.sendOpInt16(OP.MOUSE_RELATIVE, dx, dy);
  }

  sendMoveAbsolute(x: number, y: number): void {
    this.sendOpInt16(OP.MOUSE_ABSOLUTE, x, y);
  }

  sendButton(button: MouseButton, mode: KeyMode): void {
    const value = { left: 1, right: 2, middle: 4 }[button] ?? 1;
    let opcode: number | undefined;
    if (mode === 'down') opcode = OP.MOUSE_PRESS;
    else if (mode === 'up') opcode = OP.MOUSE_RELEASE;
    else if (mode === 'click' || mode === 'send') opcode = OP.MOUSE_CLICK;
    if (opcode !== undefined) this.sendCmd(opcode, value);
  }

  sendScrollWheel(delta: number): void {
    if (!this.ready()) return;
    const view = new DataView(new ArrayBuffer(2));
    view.setUint8(0, OP.SCROLL_WHEEL);
    view.setInt8(1, delta);
    this.ws!.send(view.buffer);
  }

  // (0,0) is a keepalive: it re-places/holds the two fingers so the firmware
  // keeps the gesture alive. Lifting is a separate, explicit call.
  sendTouchpadScroll(dx: number, dy: number): void {
    this.sendOpInt16(OP.SCROLL_TOUCHPAD, dx, dy);
  }

  endTouchpadScroll(): void {
    if (!this.ready()) return;
    this.ws!.send(new Uint8Array([OP.SCROLL_END])); // lift fingers
  }

  sendKey(keycode: number, mode: KeyMode): void {
    let opcode: number | undefined;
    if (mode === 'press') opcode = OP.KEY_PRESS;
    else if (mode === 'release') opcode = OP.KEY_RELEASE;
    else if (mode === 'send') opcode = OP.KEY_SEND;
    if (opcode !== undefined) this.sendCmd(opcode, keycode);
  }

  sendMediaKey(code: number, mode: KeyMode = 'send'): void {
    if (!this.ready()) return;
    if (mode === 'release') {
      this.ws!.send(new Uint8Array([OP.MEDIA_RELEASE]));
      return;
    }
    const opcode = mode === 'press' ? OP.MEDIA_PRESS : OP.MEDIA_SEND;
    const view = new DataView(new ArrayBuffer(3));
    view.setUint8(0, opcode);
    view.setInt16(1, code, true);
    this.ws!.send(view.buffer);
  }

  sendText(text: string): void {
    if (!this.ready()) return;
    const encoded = new TextEncoder().encode(text);
    const buffer = new Uint8Array(1 + encoded.length + 1);
    buffer[0] = OP.TEXT_SEND;
    buffer.set(encoded, 1);
    buffer[buffer.length - 1] = 0; // null terminator
    this.ws!.send(buffer.buffer);
  }

  // --- Standalone-page extras (not part of IServiceManager) ---

  sendPCPower(cmd: number): void {
    this.sendCmd(OP.PC_CONTROL, cmd);
  }

  sendReset(): void {
    if (!this.ready()) return;
    for (let code = 0xE0; code <= 0xE7; code++) this.sendKey(code, 'release');
    this.ws!.send(new Uint8Array([OP.SYSTEM_RESET]));
  }
}
