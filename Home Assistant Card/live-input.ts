import { IServiceManager } from './types';

// Shared "live" text capture used by both the HA input card and the firmware's
// standalone page. Sends each change straight to the device by diffing the
// field's value against a single anchor space and then resetting it.
//
// The caller sets the input to type="url": on Android that disables autocorrect,
// predictive text and the auto-space-after-punctuation that otherwise corrupt
// the diffing — the same suppression a password field gives, but WITHOUT the
// password-manager prompt or the password keyboard.
export function attachLiveInput(input: HTMLInputElement, sm: IServiceManager) {
  const ANCHOR = ' ';
  const KEY_ENTER = 40;
  const KEY_BACKSPACE = 42;

  // Non-text keys handled via keydown (they don't change the field value).
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

  let lastValue = ANCHOR;

  const caretEnd = () => {
    try { const n = input.value.length; input.setSelectionRange(n, n); } catch (e) {}
  };
  const reset = () => { input.value = ANCHOR; lastValue = ANCHOR; caretEnd(); };

  input.addEventListener('focus', caretEnd);
  input.addEventListener('click', caretEnd);
  input.addEventListener('touchend', caretEnd);

  input.addEventListener('input', () => {
    const val = input.value;

    // Field shrank below the anchor → the anchor space was deleted = Backspace.
    if (val.length < ANCHOR.length) {
      sm.sendKey(KEY_BACKSPACE, 'send');
      reset();
      return;
    }

    const diff = val.length - lastValue.length;
    if (diff > 0) {
      const added = val.slice(lastValue.length);
      if (added) sm.sendText(added);
    } else if (diff < 0) {
      for (let i = 0; i < Math.abs(diff); i++) sm.sendKey(KEY_BACKSPACE, 'send');
    }
    lastValue = val;

    // Collapse back to the anchor so the field never accumulates. Deferred so
    // the browser finishes processing this input event first.
    setTimeout(reset, 0);
  });

  input.addEventListener('blur', reset);

  input.addEventListener('keydown', (e) => {
    const code = NAV_KEYS[e.key];
    if (code) {
      e.preventDefault();
      sm.sendKey(code, 'send');
      if (e.key === 'Enter') reset();
    }
  });
}
