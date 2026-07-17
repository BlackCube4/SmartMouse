import { IServiceManager } from './types';

const HID = {
  ENTER: 40,
  BACKSPACE: 42,
  RIGHT: 0x4f,
  LEFT: 0x50,
  DOWN: 0x51,
  UP: 0x52,
};

// The anchor character used to pad both capture modes below (see their own
// comments for why). A zero-width space rather than a regular space - it's
// still exactly one character for Backspace/cursor-move purposes, but can
// never be confused with a real space the user (or their keyboard's
// autocorrect) types, which a literal space anchor could be: e.g. Android
// auto-appending a space after a tapped word suggestion, landing right next
// to our own anchor, made the two indistinguishable by content alone.
const ANCHOR = '\u200B'; // zero-width space

// Fired on the input element whenever its internal buffer or caret changes.
// Purely a debug hook for the input card's optional "show raw text" readout
// - not used by the capture logic itself.
export interface LiveInputDebugDetail {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}
export const LIVE_INPUT_DEBUG_EVENT = 'smartmouse-live-input-debug';
const emitDebug = (input: HTMLInputElement) => {
  const detail: LiveInputDebugDetail = {
    value: input.value,
    selectionStart: input.selectionStart ?? input.value.length,
    selectionEnd: input.selectionEnd ?? input.value.length,
  };
  input.dispatchEvent(new CustomEvent<LiveInputDebugDetail>(LIVE_INPUT_DEBUG_EVENT, { detail, bubbles: true }));
};

// `document.activeElement` is retargeted to the shadow host when the actual
// focused element (e.g. our input) lives inside a shadow root (as in the HA
// cards), so it never equals `input` there even while it's genuinely
// focused. `selectionchange` itself still only ever fires on `document`
// regardless - only the focus check needs to go through the input's own
// root (its shadow root, or `document` on the plain-DOM standalone page).
const isFocused = (input: HTMLInputElement) =>
  (input.getRootNode() as Document | ShadowRoot).activeElement === input;

// Common-prefix/suffix diff between two strings - finds the smallest changed
// region regardless of where in the string it is, so typing/deleting/
// autocorrecting anywhere (not just at the very end) is captured correctly.
// Shared by both capture modes below.
//
// `priorCursor`/`newCursor` (the cursor position just before and just after
// this change) bound how far the prefix/suffix scan is allowed to extend.
// Without that bound, a run of identical characters - which is exactly what
// our own left/right anchor padding is - is ambiguous: e.g. "   " -> "  "
// could equally be "removed the 1st, 2nd, or 3rd space" by content alone,
// and the greedy unbounded scan always picks the last one (maximal prefix
// match), which is wrong whenever the edit actually happened earlier (e.g.
// backspacing right after a swipe-left). The cursor position pins down
// exactly which occurrence changed, since a normal edit only ever touches
// content between the old and new cursor position - nothing before it or
// after it moves.
function diffStrings(oldVal: string, newVal: string, priorCursor: number, newCursor: number) {
  const maxPrefix = Math.max(0, Math.min(priorCursor, newCursor, oldVal.length, newVal.length));
  let prefix = 0;
  while (prefix < maxPrefix && oldVal[prefix] === newVal[prefix]) prefix++;

  const maxSuffix = Math.max(0, Math.min(oldVal.length - priorCursor, newVal.length - newCursor));
  let suffix = 0;
  while (suffix < maxSuffix && oldVal[oldVal.length - 1 - suffix] === newVal[newVal.length - 1 - suffix]) suffix++;

  const removed = oldVal.length - prefix - suffix;
  const added = newVal.slice(prefix, newVal.length - suffix);
  return { prefix, suffix, removed, added };
}

// Sends however many Right/Left presses are needed to walk the PC's cursor
// from `tracker.pos` to `to`, since that's the only cursor control the HID
// protocol gives us. Shared by both capture modes below.
function makeMoveCursor(sm: IServiceManager, tracker: { pos: number }) {
  return (to: number) => {
    const steps = to - tracker.pos;
    if (steps === 0) return;
    const key = steps > 0 ? HID.RIGHT : HID.LEFT;
    for (let i = 0; i < Math.abs(steps); i++) sm.sendKey(key, 'send');
    tracker.pos = to;
  };
}

// Handles an explicit ArrowLeft/ArrowRight keydown by sending the key
// directly and synchronously, rather than moving the caret via
// setSelectionRange() and waiting for the async `selectionchange` listener
// to notice and forward it - that indirection turned out to be unreliable on
// real desktop browsers (unlike in synthetic testing here), so tap-driven
// arrow keys go straight out. `cursor.pos` is pre-synced to the new local
// position, so if setSelectionRange() below does still fire its own
// `selectionchange`, that listener's own `cur !== cursor.pos` check no-ops
// instead of sending the same key a second time.
//
// The debug-view update and padding growth are triggered directly here too,
// rather than solely through that same `selectionchange` - on the same real
// desktop browsers, a `selectionchange` fired by a setSelectionRange() call
// made from inside a keydown handler didn't reliably reach the listener
// either, which left the debug view stale and the anchor never regrowing (so
// a 2nd press in the same direction had nowhere left to go).
function handleArrowKey(
  input: HTMLInputElement,
  sm: IServiceManager,
  cursor: { pos: number },
  ensurePadding: () => void,
  key: 'ArrowLeft' | 'ArrowRight',
) {
  const cur = input.selectionStart ?? input.value.length;
  const next = key === 'ArrowLeft' ? Math.max(0, cur - 1) : Math.min(input.value.length, cur + 1);
  if (next !== cur) sm.sendKey(key === 'ArrowLeft' ? HID.LEFT : HID.RIGHT, 'send');
  cursor.pos = next;
  try { input.setSelectionRange(next, next); } catch (err) {}
  emitDebug(input);
  setTimeout(ensurePadding, 0);
}

// Shared "live" text capture used by both the HA input card and the firmware's
// standalone page. This is the password-field approach: a password input
// reliably suppresses Android autocorrect/predictions. The field always holds
// exactly a left anchor space and a right anchor space with the caret between
// them (e.g. "  " at rest); typing inserts between the anchors, is diffed
// against the anchors-only rest state, sent, then the field is reset back to
// rest. The two anchors are never sent to the PC themselves - they exist so
// there's always a character on both sides of the caret for Backspace/Delete
// (or a swipe-to-move-cursor gesture) to act on; consuming one sends one real
// Backspace/Delete to the PC (reaching into whatever text already existed
// there) and is silently replaced on the next reset.
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

  const REST = ANCHOR + ANCHOR;
  let lastValue = REST;
  const cursor = { pos: 1 };
  const moveCursor = makeMoveCursor(sm, cursor);

  const setRest = () => {
    input.value = REST;
    lastValue = REST;
    cursor.pos = 1;
    try { input.setSelectionRange(1, 1); } catch (e) {}
    emitDebug(input);
  };
  setRest();

  // Reset is deferred slightly (rather than immediately) so a rapid sequence
  // of events - e.g. an on-screen keyboard's Backspace auto-repeat - isn't
  // fighting the field's own value out from under it on every single
  // keystroke, which on some keyboards suppresses per-repeat haptic feedback
  // even though the repeat keeps firing correctly. A plain timeout (not
  // requestAnimationFrame) on purpose - rAF is tied to the page's paint
  // lifecycle and can be throttled or not fire at all while the page isn't
  // actively rendering (e.g. backgrounded), which would stall the reset.
  //
  // `delayMs` is longer specifically for the "just backspaced the leftmost
  // anchor away" case (see the `input` handler below) - an experiment to see
  // if giving that particular case more time before the anchor reappears
  // helps a mobile keyboard's per-repeat haptic feedback.
  const scheduleReset = (delayMs = 20) => setTimeout(setRest, delayMs);

  // Like attachPredictiveInput's, but the field only ever holds the two
  // anchors between edits (nothing persists), so growth only matters for a
  // run of pure caret moves (arrow keys/swipes) between edits.
  const ensurePadding = () => {
    let value = input.value;
    let cur = input.selectionStart ?? value.length;

    if (cur <= 0) {
      value = ANCHOR + value;
      lastValue = ANCHOR + lastValue;
      cursor.pos += 1;
      cur = 1;
    }
    if (cur >= value.length) {
      value = value + ANCHOR;
      lastValue = lastValue + ANCHOR;
    }

    if (value !== input.value) {
      input.value = value;
      try { input.setSelectionRange(cur, cur); } catch (e) {}
      emitDebug(input);
    }
  };

  input.addEventListener('focus', () => {
    try { input.setSelectionRange(1, 1); } catch (e) {}
  });

  input.addEventListener('input', () => {
    emitDebug(input);
    const val = input.value;
    const newCursor = input.selectionStart ?? val.length;
    const { prefix, removed, added } = diffStrings(lastValue, val, cursor.pos, newCursor);

    moveCursor(prefix + removed);
    for (let i = 0; i < removed; i++) sm.sendKey(HID.BACKSPACE, 'send');
    cursor.pos = prefix;
    if (added) {
      sm.sendText(added);
      cursor.pos = prefix + added.length;
    }
    moveCursor(newCursor);

    lastValue = val;
    // prefix === 0 with something removed means the removed region started
    // at the very beginning of the old value - i.e. the leftmost anchor
    // itself was just backspaced away (the "reach into pre-existing PC text"
    // case), rather than a normal in-bounds edit.
    const consumedLeftAnchor = prefix === 0 && removed > 0;
    scheduleReset(consumedLeftAnchor ? 200 : 20);
  });

  input.addEventListener('blur', setRest);

  // Notices wherever the local caret now sits (a swipe-to-move-cursor
  // gesture, or a mouse click - which we can't intercept the way keydown
  // lets us, so this is the only path for a click) and forwards/repads
  // accordingly. Called from both `selectionchange` and `click` below,
  // since neither one alone proved reliable enough by itself on real
  // desktop browsers for every way the caret can move.
  const syncCursor = () => {
    if (input.value !== lastValue) return; // an `input` handler run is pending; let it sync
    const cur = input.selectionStart ?? input.value.length;
    if (cur !== cursor.pos) moveCursor(cur);
    emitDebug(input);
    setTimeout(ensurePadding, 0);
  };

  // Pure caret moves (a swipe-to-move-cursor gesture) don't change the
  // value, so they never fire `input` - only `selectionchange`.
  document.addEventListener('selectionchange', () => {
    if (!isFocused(input)) return;
    syncCursor();
  });
  input.addEventListener('click', syncCursor);

  input.addEventListener('keydown', (e) => {
    // Stop the keystroke from bubbling past this field - otherwise a
    // dashboard-level shortcut handler further up (which typically checks
    // `document.activeElement` and sees our shadow host, not the input - see
    // isFocused() above) can mistake e.g. an arrow key for a navigation
    // shortcut and preventDefault() it before we ever see it.
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      sm.sendKey(HID.ENTER, 'send');
      scheduleReset();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      handleArrowKey(input, sm, cursor, ensurePadding, e.key);
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

  // Like live mode, the field always carries a left and a right anchor space
  // around the real content (e.g. "  " at rest, " hello " while editing) -
  // neither anchor is ever sent to the PC itself. They exist so there's
  // always at least one character on each side of the caret: without a
  // trailing anchor, a swipe-to-move-cursor gesture (or Delete) run out of
  // field content to consume once the caret reaches either edge, since
  // there'd be nothing left there to move into. ensurePadding() below keeps
  // re-growing whichever side the caret reaches, so both directions work an
  // unlimited number of times; consuming an anchor via Backspace/Delete sends
  // one real key to the PC (reaching into pre-existing text there).
  let lastValue = ANCHOR + ANCHOR;
  const cursor = { pos: 1 };
  const moveCursor = makeMoveCursor(sm, cursor);
  let idleTimer: number | null = null;

  const clearField = () => {
    input.value = ANCHOR + ANCHOR;
    lastValue = ANCHOR + ANCHOR;
    cursor.pos = 1;
    try { input.setSelectionRange(1, 1); } catch (e) {}
    emitDebug(input);
  };
  clearField();

  const armIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = window.setTimeout(clearField, idleMs);
  };

  // Re-grow whichever anchor the caret has reached, purely locally (no keys
  // sent) - shifting `lastValue`/`cursor.pos` to match so the diffing above
  // stays consistent. Deferred like the resets below, to stay clear of any
  // in-flight IME composition on the same tick.
  const ensurePadding = () => {
    let value = input.value;
    let cur = input.selectionStart ?? value.length;

    if (cur <= 0) {
      value = ANCHOR + value;
      lastValue = ANCHOR + lastValue;
      cursor.pos += 1;
      cur = 1;
    }
    if (cur >= value.length) {
      value = value + ANCHOR;
      lastValue = lastValue + ANCHOR;
    }

    if (value !== input.value) {
      input.value = value;
      try { input.setSelectionRange(cur, cur); } catch (e) {}
      emitDebug(input);
    }
  };

  input.addEventListener('input', () => {
    armIdle();
    emitDebug(input);
    const newValue = input.value;
    const newCursor = input.selectionStart ?? newValue.length;

    const { prefix, removed, added } = diffStrings(lastValue, newValue, cursor.pos, newCursor);

    moveCursor(prefix + removed); // step past the untouched tail, to the edit point
    for (let i = 0; i < removed; i++) sm.sendKey(HID.BACKSPACE, 'send');
    cursor.pos = prefix;
    if (added) {
      sm.sendText(added);
      cursor.pos = prefix + added.length;
    }
    moveCursor(newCursor); // land wherever the keyboard actually left the caret

    lastValue = newValue;
    setTimeout(ensurePadding, 0);
  });

  // Notices wherever the local caret now sits (a swipe-to-move-cursor
  // gesture, or a mouse click - which we can't intercept the way keydown
  // lets us, so this is the only path for a click) and forwards/repads
  // accordingly. Called from both `selectionchange` and `click` below,
  // since neither one alone proved reliable enough by itself on real
  // desktop browsers for every way the caret can move.
  const syncCursor = () => {
    if (input.value !== lastValue) return; // an `input` handler run is pending; let it sync
    const cur = input.selectionStart ?? input.value.length;
    if (cur !== cursor.pos) {
      moveCursor(cur);
      armIdle(); // a cursor-only move still counts as activity
    }
    emitDebug(input);
    setTimeout(ensurePadding, 0);
  };

  // Pure caret moves (a swipe-to-move-cursor gesture) don't change the
  // value, so they never fire `input` - only `selectionchange`.
  document.addEventListener('selectionchange', () => {
    if (!isFocused(input)) return;
    syncCursor();
  });
  input.addEventListener('click', syncCursor);

  input.addEventListener('keydown', (e) => {
    // See the matching note in attachLiveInput - without this, an outer
    // dashboard-level shortcut handler can intercept e.g. arrow keys before
    // the browser ever moves the caret (which is what selectionchange above
    // depends on to notice and forward the move).
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      sm.sendKey(HID.ENTER, 'send');
      clearField();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      handleArrowKey(input, sm, cursor, ensurePadding, e.key);
    }
  });

  input.addEventListener('blur', clearField);
}
