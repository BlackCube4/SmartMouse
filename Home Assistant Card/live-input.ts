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

  input.addEventListener('input', () => {
    const val = input.value;
    const diff = val.length - lastInputValue.length;

    if (val.length < 1) {
      sm.sendKey(42, 'send'); // Backspace
      setTimeout(() => { input.value = ' '; lastInputValue = ' '; }, 0);
      return;
    }

    if (diff > 0) {
      const added = val.slice(lastInputValue.length);
      if (added) sm.sendText(added);
    } else if (diff < 0) {
      for (let i = 0; i < Math.abs(diff); i++) sm.sendKey(42, 'send');
    }

    lastInputValue = val;
    setTimeout(() => { input.value = ' '; lastInputValue = ' '; }, 0);
  });

  input.addEventListener('blur', () => { input.value = ' '; lastInputValue = ' '; });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sm.sendKey(40, 'send'); // Enter
      setTimeout(() => { input.value = ' '; lastInputValue = ' '; }, 0);
    }
  });
}
