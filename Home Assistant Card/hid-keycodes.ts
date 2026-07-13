// Map a browser KeyboardEvent to a USB HID usage code, based on the PHYSICAL
// key (event.code) so the PC applies its own keyboard layout. Shared by the HA
// desktop card and the firmware's standalone desktop layout.
export function keyboardEventToHid(e: KeyboardEvent): number | null {
  // Dead keys (accent composition, e.g. the German ´ key) → map to Meta so the
  // gesture still does something predictable instead of silently dropping.
  const isDeadKey = e.key === 'Dead' && (e.code === 'Equal' || e.code === 'Backquote');
  if (isDeadKey || e.key === '´' || e.key === '´´') return 227;

  // Letters: KeyA..KeyZ → HID 4..29
  if (e.code.startsWith('Key')) return e.code.charCodeAt(3) - 65 + 4;

  // Digits: Digit1..9 → 30..38, Digit0 → 39
  if (e.code.startsWith('Digit')) {
    const d = parseInt(e.code.slice(-1));
    return d === 0 ? 39 : d + 29;
  }

  const byCode: Record<string, number> = {
    Enter: 40, Escape: 41, Backspace: 42, Tab: 43, Space: 44,
    Minus: 45, Equal: 46, BracketLeft: 47, BracketRight: 48, Backslash: 49,
    Semicolon: 51, Quote: 52, Backquote: 53, Comma: 54, Period: 55, Slash: 56,
    CapsLock: 57,
    F1: 58, F2: 59, F3: 60, F4: 61, F5: 62, F6: 63,
    F7: 64, F8: 65, F9: 66, F10: 67, F11: 68, F12: 69,
    Insert: 73, Home: 74, PageUp: 75, Delete: 76, End: 77, PageDown: 78,
    ArrowRight: 0x4f, ArrowLeft: 0x50, ArrowDown: 0x51, ArrowUp: 0x52,
    NumpadEnter: 88,
    ControlLeft: 224, ShiftLeft: 225, AltLeft: 226, MetaLeft: 227,
    ControlRight: 228, ShiftRight: 229, AltRight: 230, MetaRight: 231,
  };
  if (byCode[e.code] !== undefined) return byCode[e.code];

  return null;
}
