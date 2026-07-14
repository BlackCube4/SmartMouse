import { IServiceManager } from './types';

const HID = {
  ENTER: 40,
  BACKSPACE: 42,
  RIGHT: 0x4f,
  LEFT: 0x50,
  DOWN: 0x51,
  UP: 0x52,
};

// Shared "live" text capture used by both the HA input card and the firmware's
// standalone page. This is the original password-field approach: a password
// input reliably suppresses Android autocorrect/predictions, and the value is
// diffed against a single anchor space then reset after each change.
//
// (Password mode does trigger a password-manager prompt on some setups and
// shows the password keyboard — that was accepted as the reliable trade-off.
// See attachPredictiveInput below for a mode that embraces prediction instead.)
export function attachLiveInput(input: HTMLInputElement, sm: IServiceManager) {
  input.type = 'password';
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('autocapitalize', 'none');
  input.spellcheck = false;
  input.value = ' ';

  let lastInputValue = ' ';

  // Keep the caret after the anchor space so Backspace always has that space to
  // delete - which is what makes a held Backspace keep firing input events (and
  // keep repeating on the keyboard) instead of stalling after one deletion.
  const caretEnd = () => {
    try { const n = input.value.length; input.setSelectionRange(n, n); } catch (e) {}
  };
  const reset = () => { input.value = ' '; lastInputValue = ' '; caretEnd(); };

  input.addEventListener('focus', caretEnd);

  input.addEventListener('input', () => {
    const val = input.value;
    const diff = val.length - lastInputValue.length;

    if (val.length < 1) {
      sm.sendKey(HID.BACKSPACE, 'send');
      setTimeout(reset, 0);
      return;
    }

    if (diff > 0) {
      const added = val.slice(lastInputValue.length);
      if (added) sm.sendText(added);
    } else if (diff < 0) {
      for (let i = 0; i < Math.abs(diff); i++) sm.sendKey(HID.BACKSPACE, 'send');
    }

    lastInputValue = val;
    setTimeout(reset, 0);
  });

  input.addEventListener('blur', () => { input.value = ' '; lastInputValue = ' '; });

  // Forward physical/on-screen arrow key taps directly to the PC. This is
  // additive and doesn't touch the text-diffing logic above - it only catches
  // real keydown events, so it won't see gesture-based cursor movement (e.g.
  // swiping on Gboard's spacebar), which needs the field to actually grow/
  // shrink to observe via selectionchange - see attachPredictiveInput, whose
  // architecture supports that naturally.
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sm.sendKey(HID.ENTER, 'send');
      setTimeout(reset, 0);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      sm.sendKey(HID.LEFT, 'send');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      sm.sendKey(HID.RIGHT, 'send');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      sm.sendKey(HID.UP, 'send');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      sm.sendKey(HID.DOWN, 'send');
    }
  });
}

// Predictive mode: embraces the phone's own autocorrect/word-prediction
// instead of suppressing it. The field is a normal text input that grows and
// shrinks naturally as you type. Every change - typing, autocorrect rewriting
// a word several characters back, or moving the caret (arrow keys or a
// swipe-to-move-cursor gesture) - is captured by diffing the field's value
// (and cursor position) against what was last synced, then replayed on the PC
// using only relative operations: move the cursor with arrow keys, backspace,
// type. That mirrors exactly what a physical keyboard would produce, so a
// mid-field autocorrection is replayed as "move left past the untouched tail,
// backspace the old word, type the corrected one, move back" rather than
// requiring the PC side to support absolute cursor placement.
export function attachPredictiveInput(input: HTMLInputElement, sm: IServiceManager, idleMs = 4000) {
  input.type = 'text';
  input.setAttribute('data-1p-ignore', 'true');
  input.setAttribute('data-bwignore', 'true');
  input.setAttribute('data-lpignore', 'true');
  input.setAttribute('data-form-type', 'other');
  input.enterKeyHint = 'enter';
  // Deliberately do NOT disable autocomplete/autocorrect/autocapitalize here -
  // the whole point of this mode is to let the keyboard do its thing.

  let lastValue = '';
  let pcCursor = 0;
  let idleTimer: number | null = null;

  const clearField = () => {
    input.value = '';
    lastValue = '';
    pcCursor = 0;
  };

  const armIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = window.setTimeout(clearField, idleMs);
  };

  // Walk the PC's cursor from its last known position to `to` using arrow
  // keys, since that's the only cursor control the HID protocol gives us.
  const moveCursor = (to: number) => {
    const steps = to - pcCursor;
    if (steps === 0) return;
    const key = steps > 0 ? HID.RIGHT : HID.LEFT;
    for (let i = 0; i < Math.abs(steps); i++) sm.sendKey(key, 'send');
    pcCursor = to;
  };

  input.addEventListener('input', () => {
    armIdle();
    const newValue = input.value;
    const newCursor = input.selectionStart ?? newValue.length;

    // Common-prefix/suffix diff against the last synced value - this finds
    // the smallest changed region regardless of where in the field it is.
    let prefix = 0;
    const minLen = Math.min(lastValue.length, newValue.length);
    while (prefix < minLen && lastValue[prefix] === newValue[prefix]) prefix++;
    let suffix = 0;
    const maxSuffix = minLen - prefix;
    while (
      suffix < maxSuffix &&
      lastValue[lastValue.length - 1 - suffix] === newValue[newValue.length - 1 - suffix]
    ) suffix++;

    const removed = lastValue.length - prefix - suffix;
    const added = newValue.slice(prefix, newValue.length - suffix);

    moveCursor(prefix + removed); // step past the untouched tail, to the edit point
    for (let i = 0; i < removed; i++) sm.sendKey(HID.BACKSPACE, 'send');
    pcCursor = prefix;
    if (added) {
      sm.sendText(added);
      pcCursor = prefix + added.length;
    }
    moveCursor(newCursor); // land wherever the keyboard actually left the caret

    lastValue = newValue;
  });

  // Pure caret moves (arrow keys, or a swipe-to-move-cursor gesture) don't
  // change the value, so they never fire `input` - only `selectionchange`.
  document.addEventListener('selectionchange', () => {
    if (document.activeElement !== input) return;
    if (input.value !== lastValue) return; // an `input` handler run is pending; let it sync
    const cur = input.selectionStart ?? input.value.length;
    if (cur !== pcCursor) moveCursor(cur);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sm.sendKey(HID.ENTER, 'send');
      clearField();
    }
  });

  input.addEventListener('blur', clearField);
}
