import { IServiceManager } from './types';

// Shared "live" text capture used by both the HA input card and the firmware's
// standalone page. Sends each keystroke straight to the device.
//
// Approach: keep a single anchor space in the field and intercept `beforeinput`
// with preventDefault(), so typed characters never actually enter the field.
// That defeats Android autocorrect/predictive text (there is nothing in the
// field for it to mangle, and no value-diffing to be thrown off by its
// auto-inserted spaces), while the anchor space still gives Backspace something
// to "delete" so it reliably fires a delete event we can forward.
export function attachLiveInput(input: HTMLInputElement, sm: IServiceManager) {
  const ANCHOR = ' ';
  const KEY_ENTER = 40;
  const KEY_BACKSPACE = 42;

  // Non-text keys don't produce beforeinput on a single-line input, so they're
  // handled via keydown. Backspace is intentionally NOT here — it goes through
  // beforeinput (deleteContentBackward) to avoid double-sending.
  const NAV_KEYS: Record<string, number> = {
    Enter: KEY_ENTER, Escape: 41, Tab: 43,
    Delete: 76, Home: 74, End: 77, PageUp: 75, PageDown: 78,
    ArrowRight: 0x4f, ArrowLeft: 0x50, ArrowDown: 0x51, ArrowUp: 0x52,
  };

  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('autocapitalize', 'off');
  input.spellcheck = false;
  input.value = ANCHOR;

  const caretEnd = () => {
    try { const n = input.value.length; input.setSelectionRange(n, n); } catch (e) {}
  };
  const reset = () => { input.value = ANCHOR; caretEnd(); };

  let composing = false;

  input.addEventListener('focus', caretEnd);
  input.addEventListener('click', caretEnd);
  input.addEventListener('touchend', caretEnd);

  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', (e) => {
    composing = false;
    const data = (e as CompositionEvent).data;
    if (data) sm.sendText(data);
    reset();
  });

  input.addEventListener('beforeinput', (e) => {
    const ie = e as InputEvent;
    if (composing) return; // swipe/IME handled on compositionend
    const t = ie.inputType;
    if (t === 'insertText' || t === 'insertReplacementText' || t === 'insertFromPaste') {
      if (ie.data) sm.sendText(ie.data);
      ie.preventDefault();
      caretEnd();
    } else if (t.startsWith('delete')) {
      sm.sendKey(KEY_BACKSPACE, 'send');
      ie.preventDefault();
      caretEnd();
    }
  });

  input.addEventListener('keydown', (e) => {
    const code = NAV_KEYS[e.key];
    if (code) {
      e.preventDefault();
      sm.sendKey(code, 'send');
      if (e.key === 'Enter') reset();
    }
  });

  // Safety net: if composition/swipe leaves text behind, flush isn't needed
  // (compositionend already sent it) — just clear so nothing accumulates.
  input.addEventListener('input', () => {
    if (!composing && input.value !== ANCHOR) reset();
  });

  input.addEventListener('blur', () => { input.value = ANCHOR; });
}
