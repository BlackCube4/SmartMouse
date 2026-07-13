import { GyroHandler } from '../gyro-handler';
import { TouchpadHandler } from '../touchpad-handler';
import { WsServiceManager } from '../ws-service-manager';
import { SmartMouseConfig, MouseButton, KeyMode } from '../types';
import { attachLiveInput } from '../live-input';

// Plain-DOM UI for the firmware's standalone control page. Ported from the JS
// that used to live inside index_html.h; it now constructs the SHARED
// GyroHandler/TouchpadHandler, so gesture/sensor fixes reach this page too.
export class UIBuilder {
  // Offline text/unicode stand-ins for mdi: icons (no ha-icon available here).
  private iconMap: Record<string, string> = {
    'mdi:chevron-up': '▲',
    'mdi:chevron-down': '▼',
    'mdi:ray-start-arrow': '↝',
    'mdi:bullseye': '☉',
    'mdi:border-radius': '⛶',
    'mdi:volume-minus': '-',
    'mdi:volume-plus': '+',
    'mdi:keyboard': '⌨',
    'mdi:arrow-right-thin': '→',
  };

  constructor(private config: SmartMouseConfig, private pcPowerEnabled: boolean) {}

  createButton(textOrIcon: string, handler: (() => void) | null = null, fontSize = '18px'): HTMLButtonElement {
    const btn = document.createElement('button');
    Object.assign(btn.style, {
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '10px 6px', borderRadius: '10px', background: 'var(--btn-dark)',
      color: 'var(--text-color)', border: '1px solid var(--border-color)', fontSize,
      cursor: 'pointer', transition: 'background 0.15s, color 0.15s', outline: 'none',
      webkitTapHighlightColor: 'transparent', touchAction: 'manipulation', overflow: 'hidden',
    });

    if (textOrIcon.startsWith('mdi:')) {
      const icon = document.createElement('span');
      icon.className = 'icon-placeholder';
      icon.textContent = this.iconMap[textOrIcon] || '•';
      icon.style.pointerEvents = 'none';
      icon.style.fontSize = fontSize;
      btn.appendChild(icon);
    } else {
      btn.textContent = textOrIcon;
    }

    const setBg = (color: string) => { btn.style.background = color; };
    btn.addEventListener('pointerdown', () => setBg('var(--btn-light)'));
    btn.addEventListener('pointerup', () => setBg('var(--btn-dark)'));
    btn.addEventListener('pointerleave', () => setBg('var(--btn-dark)'));

    if (handler) btn.addEventListener('click', handler);
    return btn;
  }

  setupDesktopLayout(root: HTMLElement, serviceManager: WsServiceManager) {
    let isLocked = false;
    Object.assign(root.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', position: 'relative', background: 'var(--card-bg)',
      transition: 'background 0.3s', overflow: 'hidden',
    });

    const overlay = document.createElement('div');
    overlay.innerHTML = "Click to Lock System<br><small style='font-size: 0.7em; opacity: 0.7;'>Exit: Escape</small>";
    Object.assign(overlay.style, { textAlign: 'center', pointerEvents: 'none', userSelect: 'none' });
    root.appendChild(overlay);

    const decoyInput = document.createElement('input');
    decoyInput.type = 'text';
    Object.assign(decoyInput.style, { position: 'absolute', opacity: '0', pointerEvents: 'none', zIndex: '-1' });
    root.appendChild(decoyInput);

    const statusDot = document.getElementById('ws-status-dot');
    if (statusDot) statusDot.addEventListener('mousedown', (e) => { e.stopPropagation(); serviceManager.sendReset(); });

    const handleKey = (e: KeyboardEvent, mode: KeyMode) => {
      if (!isLocked) return;
      if (e.key === 'Escape') return; // let native unlock happen

      e.preventDefault();
      e.stopPropagation(); e.stopImmediatePropagation();

      if (mode === 'press' && e.repeat) return;

      let hidCode = this.getHIDKeycode(e.key, e.code) ?? 0;

      const isDeadKey = e.key === 'Dead' && (e.code === 'Equal' || e.code === 'Backquote');
      if (isDeadKey || e.key === '´' || e.key === '´´') hidCode = 227;

      if (!hidCode && e.code.startsWith('Key')) hidCode = e.code.charCodeAt(3) - 65 + 4;
      if (!hidCode && e.code.startsWith('Digit')) {
        const d = parseInt(e.code.slice(-1));
        hidCode = d === 0 ? 39 : d + 29;
      }

      const symbolMap: Record<string, number> = {
        Space: 44, Minus: 45, Equal: 46, BracketLeft: 47, BracketRight: 48,
        Backslash: 49, Semicolon: 51, Quote: 52, Backquote: 53, Comma: 54,
        Period: 55, Slash: 56, CapsLock: 57, Tab: 43, Escape: 41,
      };
      if (!hidCode) hidCode = symbolMap[e.code];

      const modMap: Record<string, number> = {
        ControlLeft: 224, ShiftLeft: 225, AltLeft: 226, MetaLeft: 227,
        ControlRight: 228, ShiftRight: 229, AltRight: 230,
      };
      if (!hidCode) hidCode = modMap[e.code];

      if (hidCode) serviceManager.sendKey(hidCode, mode);
    };

    const onKeyDown = (e: KeyboardEvent) => handleKey(e, 'press');
    const onKeyUp = (e: KeyboardEvent) => handleKey(e, 'release');
    const blockScroll = (e: Event) => { if (isLocked) e.preventDefault(); };

    const onPointerMove = (e: MouseEvent) => {
      if (isLocked && document.pointerLockElement) {
        serviceManager.sendMove(e.movementX || 0, e.movementY || 0);
      }
    };

    const syncLockState = () => {
      if (document.pointerLockElement === root) {
        isLocked = true;
        overlay.textContent = 'System Locked. Escape to Exit';
        root.style.background = 'var(--trackpad-bg)';
        root.style.cursor = 'none';
        decoyInput.focus();
        window.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('keyup', onKeyUp, true);
        window.addEventListener('wheel', blockScroll, { passive: false });
        document.addEventListener('pointermove', onPointerMove, { capture: true });
      } else {
        isLocked = false;
        overlay.innerHTML = "Click to Lock System<br><small style='font-size: 0.7em; opacity: 0.7;'>Exit: Escape</small>";
        root.style.background = 'var(--card-bg)';
        root.style.cursor = 'pointer';
        decoyInput.blur();
        window.removeEventListener('keydown', onKeyDown, true);
        window.removeEventListener('keyup', onKeyUp, true);
        window.removeEventListener('wheel', blockScroll);
        document.removeEventListener('pointermove', onPointerMove, { capture: true } as any);
      }
    };

    document.addEventListener('pointerlockchange', syncLockState);

    const btnMap: Record<number, MouseButton> = { 0: 'left', 1: 'middle', 2: 'right' };

    root.addEventListener('pointerdown', (e) => {
      if (!isLocked) {
        root.requestPointerLock();
        e.preventDefault();
      } else {
        serviceManager.sendButton(btnMap[e.button] || 'left', 'down');
        if (e.pointerId !== undefined) {
          try { root.releasePointerCapture(e.pointerId); } catch (err) {}
        }
        e.preventDefault();
      }
    });

    root.addEventListener('pointerup', (e) => {
      if (isLocked) {
        serviceManager.sendButton(btnMap[e.button] || 'left', 'up');
        e.preventDefault();
      }
    });

    root.addEventListener('wheel', (e) => {
      if (!isLocked) return;
      e.preventDefault();
      serviceManager.sendScrollWheel(Math.sign(e.deltaY) * -1);
    }, { passive: false });

    root.addEventListener('auxclick', (e) => { if (isLocked) e.preventDefault(); });
    root.addEventListener('contextmenu', (e) => { if (isLocked) e.preventDefault(); });
  }

  setupMobileLayout(root: HTMLElement, serviceManager: WsServiceManager, touchpadHandler: TouchpadHandler, gyroHandler: GyroHandler) {
    let expanded = false;
    const updateLayout = () => {
      expandedArea.style.display = expanded ? 'flex' : 'none';
      expandBtn.innerHTML = '';
      const icon = document.createElement('span');
      icon.className = 'icon-placeholder';
      icon.textContent = expanded ? this.iconMap['mdi:chevron-down'] : this.iconMap['mdi:chevron-up'];
      icon.style.pointerEvents = 'none';
      icon.style.fontSize = '14px';
      expandBtn.appendChild(icon);
    };

    Object.assign(root.style, { display: 'flex', flexDirection: 'column' });

    const topArea = document.createElement('div');
    Object.assign(topArea.style, {
      display: 'flex', height: '220px', width: '100%',
      borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)',
    });

    const pad = document.createElement('div');
    Object.assign(pad.style, {
      flex: '1', background: 'var(--trackpad-bg)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontSize: '15px', touchAction: 'none',
    });
    pad.textContent = 'Touchpad';

    const divider = document.createElement('div');
    Object.assign(divider.style, { width: '1px', background: 'var(--divider)' });

    const scrollArea = document.createElement('div');
    Object.assign(scrollArea.style, {
      width: '56px', background: 'var(--trackpad-bg)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontSize: '18px', touchAction: 'none',
    });
    scrollArea.textContent = '☰';

    topArea.append(pad, divider, scrollArea);
    root.appendChild(topArea);

    const buttonRow1 = document.createElement('div');
    Object.assign(buttonRow1.style, {
      display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', marginTop: '10px',
    });

    const expandBtn = this.createButton('mdi:chevron-up', null, '14px');
    const gyroRelBtn = this.createButton('mdi:ray-start-arrow', () => {
      gyroHandler.toggleGyroRelative().then(() => {
        const on = gyroHandler.gyroRelativeActive;
        gyroRelBtn.style.background = on ? 'var(--primary)' : 'var(--btn-dark)';
        gyroRelBtn.style.color = on ? '#fff' : 'var(--text-color)';
      });
    });
    const gyroAbsBtn = this.createButton('mdi:bullseye', () => {
      gyroHandler.toggleGyroAbsolute().then(() => {
        const on = gyroHandler.gyroAbsoluteActive;
        gyroAbsBtn.style.background = on ? 'var(--primary)' : 'var(--btn-dark)';
        gyroAbsBtn.style.color = on ? '#fff' : 'var(--text-color)';
      });
    });
    const calibrateBtn = this.createButton('mdi:border-radius', () => {
      if (gyroHandler.calibrating) gyroHandler.finishCalibration();
      else if (gyroHandler.gyroAbsoluteActive) gyroHandler.recenter();
      else gyroHandler.startCalibration(calibrateBtn);
    });
    const volDownBtn = this.createButton('mdi:volume-minus');
    const volUpBtn = this.createButton('mdi:volume-plus');

    if (gyroHandler.isCalibrated) calibrateBtn.style.background = 'var(--btn-dark)';

    const volHandler = (btn: HTMLButtonElement, code: number) => {
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); serviceManager.sendMediaKey(code, 'press'); });
      btn.addEventListener('touchend', (e) => { e.preventDefault(); serviceManager.sendMediaKey(code, 'release'); });
      btn.addEventListener('touchcancel', (e) => { e.preventDefault(); serviceManager.sendMediaKey(code, 'release'); });
    };
    volHandler(volDownBtn, 0xEA);
    volHandler(volUpBtn, 0xE9);

    buttonRow1.append(expandBtn, gyroRelBtn, gyroAbsBtn, calibrateBtn, volDownBtn, volUpBtn);
    root.appendChild(buttonRow1);

    const expandedArea = document.createElement('div');
    Object.assign(expandedArea.style, {
      display: 'none', flexDirection: 'column', gap: '10px', marginTop: '10px',
    });
    expandBtn.addEventListener('click', () => { expanded = !expanded; updateLayout(); });

    // --- Text row: live keyboard + buffered text input ---
    const textRow = document.createElement('div');
    Object.assign(textRow.style, { display: 'flex', gap: '6px', alignItems: 'center' });

    const liveWrapper = document.createElement('div');
    Object.assign(liveWrapper.style, { position: 'relative', width: '15%', margin: '0', padding: '0' });

    const liveInput = document.createElement('input');
    liveInput.type = 'url'; // disables Android autocorrect/predictions, no PW prompt
    liveInput.setAttribute('data-1p-ignore', 'true');
    liveInput.setAttribute('data-bwignore', 'true');
    liveInput.setAttribute('data-lpignore', 'true');
    liveInput.setAttribute('data-form-type', 'other');
    liveInput.enterKeyHint = 'enter';

    Object.assign(liveInput.style, {
      width: '100%', padding: '10px', borderRadius: '10px',
      background: 'var(--trackpad-bg)', border: '1px solid var(--border-color)',
      color: 'transparent', fontSize: '14px', position: 'relative',
      paddingInline: '0', textAlign: 'center',
    });

    const liveInputOverlay = document.createElement('div');
    Object.assign(liveInputOverlay.style, {
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      pointerEvents: 'none', zIndex: '1', color: 'var(--text-color)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    });
    const kbIcon = document.createElement('span');
    kbIcon.textContent = this.iconMap['mdi:keyboard'];
    kbIcon.style.fontSize = '18px';
    liveInputOverlay.appendChild(kbIcon);

    liveWrapper.append(liveInput, liveInputOverlay);

    // Shared beforeinput-based capture (defeats Android autocorrect/auto-space).
    attachLiveInput(liveInput, serviceManager);

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.placeholder = 'Enter text...';
    Object.assign(textInput.style, {
      flex: '1', padding: '10px', borderRadius: '10px', background: 'var(--trackpad-bg)',
      border: '1px solid var(--border-color)', color: 'var(--text-color)', fontSize: '14px',
    });
    textInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        const text = textInput.value;
        if (text) { serviceManager.sendText(text); textInput.value = ''; }
        else serviceManager.sendKey(40, 'send');
      }
    });
    textInput.addEventListener('keyup', (e) => e.stopPropagation());

    textRow.append(liveWrapper, textInput);
    expandedArea.appendChild(textRow);

    // --- Modifier row ---
    const modifierRow = document.createElement('div');
    Object.assign(modifierRow.style, { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' });
    const modifierState: Record<string, boolean> = { ctrl: false, alt: false, shift: false };

    ([['Ctrl', 0xE0], ['Alt', 0xE2], ['Shift', 0xE1]] as [string, number][]).forEach(([label, code]) => {
      const b = this.createButton(label, () => {
        const key = label.toLowerCase();
        modifierState[key] = !modifierState[key];
        b.style.background = modifierState[key] ? 'var(--primary)' : 'var(--btn-dark)';
        b.style.color = modifierState[key] ? '#fff' : 'var(--text-color)';
        serviceManager.sendKey(code, modifierState[key] ? 'press' : 'release');
      }, '14px');
      modifierRow.appendChild(b);
    });
    const escBtn = this.createButton('ESC', () => {
      serviceManager.sendKey(41, 'send');
      navigator.vibrate?.(30);
    }, '14px');
    modifierRow.appendChild(escBtn);
    expandedArea.appendChild(modifierRow);

    // --- PC power row (gated by capability) ---
    const pcPowerRow = document.createElement('div');
    Object.assign(pcPowerRow.style, { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '10px' });
    pcPowerRow.style.display = this.pcPowerEnabled ? 'grid' : 'none';

    document.addEventListener('pc-power-cap', (e) => {
      pcPowerRow.style.display = (e as CustomEvent).detail ? 'grid' : 'none';
    });

    const pcOnBtn = this.createButton('PC ON', () => {
      if (confirm('Turn PC ON?')) serviceManager.sendPCPower(0x03);
    }, '14px');
    const pcOffBtn = this.createButton('PC OFF', () => {
      if (confirm('Turn PC OFF?')) serviceManager.sendPCPower(0x04);
    }, '14px');
    pcPowerRow.append(pcOnBtn, pcOffBtn);
    expandedArea.appendChild(pcPowerRow);

    if (this.config.debug) {
      const debugRow = document.createElement('div');
      Object.assign(debugRow.style, {
        marginTop: '10px', padding: '8px', background: 'rgba(0,0,0,0.1)',
        borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px',
        lineHeight: '1.4', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', textAlign: 'left',
      });
      debugRow.textContent = 'Waiting for sensor data...';
      gyroHandler.debugElem = debugRow;
      expandedArea.appendChild(debugRow);
    }

    root.appendChild(expandedArea);
    touchpadHandler.setupPad(pad);
    touchpadHandler.setupScrollArea(scrollArea);
  }

  private getHIDKeycodeFromEvent(e: { key: string }): number | null {
    const map: Record<string, number> = {
      Enter: 40, Escape: 41, Backspace: 42, Tab: 43,
      Delete: 76, Home: 74, End: 77, PageUp: 75, PageDown: 78,
      ArrowRight: 0x4F, ArrowLeft: 0x50, ArrowDown: 0x51, ArrowUp: 0x52,
    };
    return map[e.key] || null;
  }

  private getHIDKeycode(key: string, _code: string): number | null {
    return this.getHIDKeycodeFromEvent({ key });
  }
}
