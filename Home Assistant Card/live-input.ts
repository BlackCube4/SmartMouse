import { IServiceManager } from './types';

// Shared "live" text capture used by both the HA input card and the firmware's
// standalone page. It lets the (invisible) field grow normally and, on each
// change, sends only the difference by comparing against the previous value.
//
// Crucially it does NOT reset the field after every keystroke — doing that
// raced with the Android keyboard and swallowed most input. The field only
// resets on blur / Enter / when emptied. The caller sets type="url", which on
// Android disables autocorrect, predictions and the auto-space-after-
// punctuation (the same suppression a password field gives) without the
// password-manager prompt or password keyboard.
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

  // The leading anchor space is a permanent Backspace target and common prefix;
  // real typed text follows it and is what the diff compares.
  let lastValue = ANCHOR;

  const caretEnd = () => {
    try { const n = input.value.length; input.setSelectionRange(n, n); } catch (e) {}
  };
  const resetToAnchor = () => { input.value = ANCHOR; lastValue = ANCHOR; caretEnd(); };

  input.addEventListener('focus', caretEnd);
  input.addEventListener('click', caretEnd);
  input.addEventListener('touchend', caretEnd);

  input.addEventListener('input', () => {
    const val = input.value;

    // Anchor was deleted → treat as a Backspace and restore the anchor.
    if (val.length === 0) {
      sm.sendKey(KEY_BACKSPACE, 'send');
      resetToAnchor();
      return;
    }

    // Longest common prefix between old and new value; everything after it in
    // the old value was deleted, everything after it in the new value is typed.
    let p = 0;
    const min = Math.min(lastValue.length, val.length);
    while (p < min && lastValue.charCodeAt(p) === val.charCodeAt(p)) p++;

    const removed = lastValue.length - p;
    for (let i = 0; i < removed; i++) sm.sendKey(KEY_BACKSPACE, 'send');

    const added = val.slice(p);
    if (added) sm.sendText(added);

    lastValue = val;
  });

  input.addEventListener('blur', resetToAnchor);

  input.addEventListener('keydown', (e) => {
    const code = NAV_KEYS[e.key];
    if (code) {
      e.preventDefault();
      sm.sendKey(code, 'send');
      if (e.key === 'Enter') resetToAnchor();
    }
  });
}
