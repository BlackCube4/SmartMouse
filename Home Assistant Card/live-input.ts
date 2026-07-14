import { IServiceManager } from './types';

// Shared "live" text capture used by both the HA input card and the firmware's
// standalone page. This is the original password-field approach: a password
// input reliably suppresses Android autocorrect/predictions, and the value is
// diffed against a single anchor space then reset after each change.
//
// (Password mode does trigger a password-manager prompt on some setups and
// shows the password keyboard — that was accepted as the reliable trade-off.)
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
      sm.sendKey(42, 'send'); // Backspace
      setTimeout(reset, 0);
      return;
    }

    if (diff > 0) {
      const added = val.slice(lastInputValue.length);
      if (added) sm.sendText(added);
    } else if (diff < 0) {
      for (let i = 0; i < Math.abs(diff); i++) sm.sendKey(42, 'send');
    }

    lastInputValue = val;
    setTimeout(reset, 0);
  });

  input.addEventListener('blur', () => { input.value = ' '; lastInputValue = ' '; });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sm.sendKey(40, 'send'); // Enter
      setTimeout(reset, 0);
    }
  });
}
