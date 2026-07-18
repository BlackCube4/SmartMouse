class Ze {
  constructor(e, t) {
    this.serviceManager = e, this.config = t, this.floatDX = 0, this.floatDY = 0, this.velocityX = 0, this.velocityY = 0, this.lastTouchTime = 0, this.isTouchActive = !1, this.frameLoopRunning = !1, this.TOUCH_GAIN = t.mouseSensitivity ?? 1.8, this.SCROLL_GAIN = t.scrollSensitivity ?? 3, this.CLICK_DELAY = t.doubleClickTime ?? 250, this.HOLD_TIME = t.holdTime ?? 400, this.DEADZONE = t.movementDeadzone ?? 3;
  }
  updateConfig(e) {
    this.config = e, this.TOUCH_GAIN = e.mouseSensitivity ?? 1.8, this.SCROLL_GAIN = e.scrollSensitivity ?? 3, this.CLICK_DELAY = e.doubleClickTime ?? 250, this.HOLD_TIME = e.holdTime ?? 400, this.DEADZONE = e.movementDeadzone ?? 3;
  }
  // Runs only while there is pending movement to flush, instead of forever.
  ensureFrameLoop() {
    if (this.frameLoopRunning) return;
    this.frameLoopRunning = !0;
    const e = () => {
      const t = this.floatDX > 0 ? Math.floor(this.floatDX) : Math.ceil(this.floatDX), s = this.floatDY > 0 ? Math.floor(this.floatDY) : Math.ceil(this.floatDY);
      (t !== 0 || s !== 0) && (this.floatDX -= t, this.floatDY -= s, this.serviceManager.sendMove(t, s)), Math.abs(this.floatDX) > 1e-4 || Math.abs(this.floatDY) > 1e-4 ? requestAnimationFrame(e) : this.frameLoopRunning = !1;
    };
    requestAnimationFrame(e);
  }
  addMovement(e, t) {
    this.floatDX += e, this.floatDY += t, this.ensureFrameLoop();
  }
  runMomentum(e) {
    const s = () => {
      if (this.isTouchActive) return;
      const i = this.velocityX * 16.6, o = this.velocityY * 16.6;
      if (Math.abs(i) < 0.5 && Math.abs(o) < 0.5) {
        this.velocityX = 0, this.velocityY = 0, e && e();
        return;
      }
      this.addMovement(i * this.TOUCH_GAIN, o * this.TOUCH_GAIN), this.velocityX *= 0.92, this.velocityY *= 0.92, requestAnimationFrame(s);
    };
    requestAnimationFrame(s);
  }
  setupPad(e) {
    let t = 0, s = null, i = null, o = !1, n = !1, a = !1, l = 0, h = 0;
    const d = (p) => {
      p.preventDefault(), this.isTouchActive = !0, this.velocityX = 0, this.velocityY = 0, window.dispatchEvent(new CustomEvent("smartmouse-gyro-suppress", { detail: { ms: 400 } }));
      const f = p.touches[0];
      l = f.clientX, h = f.clientY, o = !1, a = !1, n ? t = 2 : s ? (clearTimeout(s), s = null, t = 2) : t = 1, i = window.setTimeout(() => {
        var v;
        o || t === 1 && (this.serviceManager.sendButton("right", "click"), (v = navigator.vibrate) == null || v.call(navigator, 50), a = !0);
      }, this.HOLD_TIME);
    }, c = (p) => {
      var T;
      p.preventDefault();
      const f = p.touches[0], v = performance.now(), E = v - this.lastTouchTime, b = f.clientX - l, H = f.clientY - h;
      if (o && E > 0) {
        const ee = b / E, Ve = H / E;
        this.velocityX = this.velocityX * 0.4 + ee * 0.6, this.velocityY = this.velocityY * 0.4 + Ve * 0.6;
      }
      !o && (Math.abs(b) > this.DEADZONE || Math.abs(H) > this.DEADZONE) && (o = !0, i && clearTimeout(i), t === 2 && !n && (this.serviceManager.sendButton("left", "down"), n = !0, (T = navigator.vibrate) == null || T.call(navigator, 30))), o && (l = f.clientX, h = f.clientY, this.addMovement(b * this.TOUCH_GAIN, H * this.TOUCH_GAIN)), this.lastTouchTime = v;
    }, u = (p) => {
      p.preventDefault(), this.isTouchActive = !1, i && clearTimeout(i);
      const f = performance.now() - this.lastTouchTime, v = o && f < 50;
      if (t === 1) {
        if (a) {
          t = 0;
          return;
        }
        if (o) {
          t = 0, v && this.runMomentum();
          return;
        }
        s = window.setTimeout(() => {
          this.serviceManager.sendButton("left", "click"), t = 0, s = null;
        }, this.CLICK_DELAY);
      } else t === 2 ? n ? v ? this.runMomentum(() => {
        this.serviceManager.sendButton("left", "up"), n = !1, t = 0;
      }) : (this.serviceManager.sendButton("left", "up"), n = !1, t = 0) : (this.serviceManager.sendButton("left", "click"), setTimeout(() => this.serviceManager.sendButton("left", "click"), 50), t = 0) : t = 0;
    };
    e.addEventListener("touchstart", d, { passive: !1 }), e.addEventListener("touchmove", c, { passive: !1 }), e.addEventListener("touchend", u, { passive: !1 }), e.addEventListener("touchcancel", u, { passive: !1 });
  }
  setupScrollArea(e) {
    let t = !1, s = 0, i = 0, o = !1, n = 0, a = null;
    const l = 60, h = 20;
    let d = !1;
    const c = () => this.config.scrollType !== "wheel", u = (b) => {
      if (this.config.scrollType === "wheel") {
        this.serviceManager.sendScrollWheel(-(this.config.invertScroll ? -b : b));
        return;
      }
      this.serviceManager.sendTouchpadScroll(0, this.config.invertScroll ? -b : b), o = !0, n = performance.now();
    }, p = () => {
      !t || !c() || performance.now() - n >= l && (this.serviceManager.sendTouchpadScroll(0, 0), o = !0, n = performance.now());
    }, f = (b) => {
      b.preventDefault(), t = !0, s = b.touches[0].clientY, i = 0, d = !1, c() && (this.serviceManager.sendTouchpadScroll(0, 0), o = !0, n = performance.now(), a === null && (a = window.setInterval(p, l)));
    }, v = (b) => {
      if (!t) return;
      b.preventDefault();
      const H = b.touches[0].clientY;
      i += s - H, s = H;
      const T = Math.trunc(i * this.SCROLL_GAIN);
      if (T !== 0) {
        i -= T / this.SCROLL_GAIN;
        let ee = T;
        !d && c() && (ee += Math.sign(T) * h, d = !0), u(ee);
      }
    }, E = (b) => {
      t && (b.preventDefault(), t = !1, i = 0, a !== null && (clearInterval(a), a = null), o && c() && this.serviceManager.endTouchpadScroll(), o = !1);
    };
    e.addEventListener("touchstart", f, { passive: !1 }), e.addEventListener("touchmove", v, { passive: !1 }), e.addEventListener("touchend", E, { passive: !1 }), e.addEventListener("touchcancel", E, { passive: !1 });
  }
}
class Je {
  constructor(e, t = {}) {
    this.hass = e, this.config = t;
  }
  _log(e, t) {
    this.config.debugPrint && console.log(`[SmartMouse] ${e}`, t);
  }
  _call(e, t) {
    this.hass && (this.config.device_id && (t.device_id = this.config.device_id), this._log(e, t), this.hass.callService("smartmouse", e, t));
  }
  sendMove(e, t) {
    this._call("move", { x: e, y: t });
  }
  sendMoveAbsolute(e, t) {
    this._call("move_absolute", { x: e, y: t });
  }
  sendButton(e, t) {
    this._call("button", { button: e, mode: t });
  }
  sendScrollWheel(e) {
    this._call("scroll_wheel", { delta: e });
  }
  sendTouchpadScroll(e, t) {
    this._call("touchpad_scroll", { x: e, y: t });
  }
  endTouchpadScroll() {
    this._call("touchpad_scroll", { end: !0 });
  }
  sendKey(e, t) {
    this._call("key_control", { keycode: e, mode: t });
  }
  sendMediaKey(e, t = "send") {
    this._call("media_control", { code: e, mode: t });
  }
  sendText(e) {
    this._call("text_send", { text: e });
  }
}
/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const te = globalThis, ue = te.ShadowRoot && (te.ShadyCSS === void 0 || te.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, pe = Symbol(), xe = /* @__PURE__ */ new WeakMap();
let He = class {
  constructor(e, t, s) {
    if (this._$cssResult$ = !0, s !== pe) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = e, this.t = t;
  }
  get styleSheet() {
    let e = this.o;
    const t = this.t;
    if (ue && e === void 0) {
      const s = t !== void 0 && t.length === 1;
      s && (e = xe.get(t)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), s && xe.set(t, e));
    }
    return e;
  }
  toString() {
    return this.cssText;
  }
};
const Qe = (r) => new He(typeof r == "string" ? r : r + "", void 0, pe), C = (r, ...e) => {
  const t = r.length === 1 ? r[0] : e.reduce((s, i, o) => s + ((n) => {
    if (n._$cssResult$ === !0) return n.cssText;
    if (typeof n == "number") return n;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + n + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(i) + r[o + 1], r[0]);
  return new He(t, r, pe);
}, et = (r, e) => {
  if (ue) r.adoptedStyleSheets = e.map((t) => t instanceof CSSStyleSheet ? t : t.styleSheet);
  else for (const t of e) {
    const s = document.createElement("style"), i = te.litNonce;
    i !== void 0 && s.setAttribute("nonce", i), s.textContent = t.cssText, r.appendChild(s);
  }
}, $e = ue ? (r) => r : (r) => r instanceof CSSStyleSheet ? ((e) => {
  let t = "";
  for (const s of e.cssRules) t += s.cssText;
  return Qe(t);
})(r) : r;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: tt, defineProperty: it, getOwnPropertyDescriptor: st, getOwnPropertyNames: rt, getOwnPropertySymbols: ot, getPrototypeOf: nt } = Object, A = globalThis, Ae = A.trustedTypes, at = Ae ? Ae.emptyScript : "", le = A.reactiveElementPolyfillSupport, z = (r, e) => r, ie = { toAttribute(r, e) {
  switch (e) {
    case Boolean:
      r = r ? at : null;
      break;
    case Object:
    case Array:
      r = r == null ? r : JSON.stringify(r);
  }
  return r;
}, fromAttribute(r, e) {
  let t = r;
  switch (e) {
    case Boolean:
      t = r !== null;
      break;
    case Number:
      t = r === null ? null : Number(r);
      break;
    case Object:
    case Array:
      try {
        t = JSON.parse(r);
      } catch {
        t = null;
      }
  }
  return t;
} }, fe = (r, e) => !tt(r, e), Ce = { attribute: !0, type: String, converter: ie, reflect: !1, useDefault: !1, hasChanged: fe };
Symbol.metadata ?? (Symbol.metadata = Symbol("metadata")), A.litPropertyMetadata ?? (A.litPropertyMetadata = /* @__PURE__ */ new WeakMap());
let I = class extends HTMLElement {
  static addInitializer(e) {
    this._$Ei(), (this.l ?? (this.l = [])).push(e);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(e, t = Ce) {
    if (t.state && (t.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(e) && ((t = Object.create(t)).wrapped = !0), this.elementProperties.set(e, t), !t.noAccessor) {
      const s = Symbol(), i = this.getPropertyDescriptor(e, s, t);
      i !== void 0 && it(this.prototype, e, i);
    }
  }
  static getPropertyDescriptor(e, t, s) {
    const { get: i, set: o } = st(this.prototype, e) ?? { get() {
      return this[t];
    }, set(n) {
      this[t] = n;
    } };
    return { get: i, set(n) {
      const a = i == null ? void 0 : i.call(this);
      o == null || o.call(this, n), this.requestUpdate(e, a, s);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(e) {
    return this.elementProperties.get(e) ?? Ce;
  }
  static _$Ei() {
    if (this.hasOwnProperty(z("elementProperties"))) return;
    const e = nt(this);
    e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(z("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(z("properties"))) {
      const t = this.properties, s = [...rt(t), ...ot(t)];
      for (const i of s) this.createProperty(i, t[i]);
    }
    const e = this[Symbol.metadata];
    if (e !== null) {
      const t = litPropertyMetadata.get(e);
      if (t !== void 0) for (const [s, i] of t) this.elementProperties.set(s, i);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [t, s] of this.elementProperties) {
      const i = this._$Eu(t, s);
      i !== void 0 && this._$Eh.set(i, t);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(e) {
    const t = [];
    if (Array.isArray(e)) {
      const s = new Set(e.flat(1 / 0).reverse());
      for (const i of s) t.unshift($e(i));
    } else e !== void 0 && t.push($e(e));
    return t;
  }
  static _$Eu(e, t) {
    const s = t.attribute;
    return s === !1 ? void 0 : typeof s == "string" ? s : typeof e == "string" ? e.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    var e;
    this._$ES = new Promise((t) => this.enableUpdating = t), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), (e = this.constructor.l) == null || e.forEach((t) => t(this));
  }
  addController(e) {
    var t;
    (this._$EO ?? (this._$EO = /* @__PURE__ */ new Set())).add(e), this.renderRoot !== void 0 && this.isConnected && ((t = e.hostConnected) == null || t.call(e));
  }
  removeController(e) {
    var t;
    (t = this._$EO) == null || t.delete(e);
  }
  _$E_() {
    const e = /* @__PURE__ */ new Map(), t = this.constructor.elementProperties;
    for (const s of t.keys()) this.hasOwnProperty(s) && (e.set(s, this[s]), delete this[s]);
    e.size > 0 && (this._$Ep = e);
  }
  createRenderRoot() {
    const e = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return et(e, this.constructor.elementStyles), e;
  }
  connectedCallback() {
    var e;
    this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this.enableUpdating(!0), (e = this._$EO) == null || e.forEach((t) => {
      var s;
      return (s = t.hostConnected) == null ? void 0 : s.call(t);
    });
  }
  enableUpdating(e) {
  }
  disconnectedCallback() {
    var e;
    (e = this._$EO) == null || e.forEach((t) => {
      var s;
      return (s = t.hostDisconnected) == null ? void 0 : s.call(t);
    });
  }
  attributeChangedCallback(e, t, s) {
    this._$AK(e, s);
  }
  _$ET(e, t) {
    var o;
    const s = this.constructor.elementProperties.get(e), i = this.constructor._$Eu(e, s);
    if (i !== void 0 && s.reflect === !0) {
      const n = (((o = s.converter) == null ? void 0 : o.toAttribute) !== void 0 ? s.converter : ie).toAttribute(t, s.type);
      this._$Em = e, n == null ? this.removeAttribute(i) : this.setAttribute(i, n), this._$Em = null;
    }
  }
  _$AK(e, t) {
    var o, n;
    const s = this.constructor, i = s._$Eh.get(e);
    if (i !== void 0 && this._$Em !== i) {
      const a = s.getPropertyOptions(i), l = typeof a.converter == "function" ? { fromAttribute: a.converter } : ((o = a.converter) == null ? void 0 : o.fromAttribute) !== void 0 ? a.converter : ie;
      this._$Em = i;
      const h = l.fromAttribute(t, a.type);
      this[i] = h ?? ((n = this._$Ej) == null ? void 0 : n.get(i)) ?? h, this._$Em = null;
    }
  }
  requestUpdate(e, t, s, i = !1, o) {
    var n;
    if (e !== void 0) {
      const a = this.constructor;
      if (i === !1 && (o = this[e]), s ?? (s = a.getPropertyOptions(e)), !((s.hasChanged ?? fe)(o, t) || s.useDefault && s.reflect && o === ((n = this._$Ej) == null ? void 0 : n.get(e)) && !this.hasAttribute(a._$Eu(e, s)))) return;
      this.C(e, t, s);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(e, t, { useDefault: s, reflect: i, wrapped: o }, n) {
    s && !(this._$Ej ?? (this._$Ej = /* @__PURE__ */ new Map())).has(e) && (this._$Ej.set(e, n ?? t ?? this[e]), o !== !0 || n !== void 0) || (this._$AL.has(e) || (this.hasUpdated || s || (t = void 0), this._$AL.set(e, t)), i === !0 && this._$Em !== e && (this._$Eq ?? (this._$Eq = /* @__PURE__ */ new Set())).add(e));
  }
  async _$EP() {
    this.isUpdatePending = !0;
    try {
      await this._$ES;
    } catch (t) {
      Promise.reject(t);
    }
    const e = this.scheduleUpdate();
    return e != null && await e, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    var s;
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this._$Ep) {
        for (const [o, n] of this._$Ep) this[o] = n;
        this._$Ep = void 0;
      }
      const i = this.constructor.elementProperties;
      if (i.size > 0) for (const [o, n] of i) {
        const { wrapped: a } = n, l = this[o];
        a !== !0 || this._$AL.has(o) || l === void 0 || this.C(o, void 0, n, l);
      }
    }
    let e = !1;
    const t = this._$AL;
    try {
      e = this.shouldUpdate(t), e ? (this.willUpdate(t), (s = this._$EO) == null || s.forEach((i) => {
        var o;
        return (o = i.hostUpdate) == null ? void 0 : o.call(i);
      }), this.update(t)) : this._$EM();
    } catch (i) {
      throw e = !1, this._$EM(), i;
    }
    e && this._$AE(t);
  }
  willUpdate(e) {
  }
  _$AE(e) {
    var t;
    (t = this._$EO) == null || t.forEach((s) => {
      var i;
      return (i = s.hostUpdated) == null ? void 0 : i.call(s);
    }), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(e)), this.updated(e);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(e) {
    return !0;
  }
  update(e) {
    this._$Eq && (this._$Eq = this._$Eq.forEach((t) => this._$ET(t, this[t]))), this._$EM();
  }
  updated(e) {
  }
  firstUpdated(e) {
  }
};
I.elementStyles = [], I.shadowRootOptions = { mode: "open" }, I[z("elementProperties")] = /* @__PURE__ */ new Map(), I[z("finalized")] = /* @__PURE__ */ new Map(), le == null || le({ ReactiveElement: I }), (A.reactiveElementVersions ?? (A.reactiveElementVersions = [])).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const K = globalThis, Se = (r) => r, se = K.trustedTypes, Te = se ? se.createPolicy("lit-html", { createHTML: (r) => r }) : void 0, Ie = "$lit$", $ = `lit$${Math.random().toFixed(9).slice(2)}$`, Oe = "?" + $, lt = `<${Oe}>`, R = document, q = () => R.createComment(""), j = (r) => r === null || typeof r != "object" && typeof r != "function", ge = Array.isArray, ct = (r) => ge(r) || typeof (r == null ? void 0 : r[Symbol.iterator]) == "function", ce = `[ 	
\f\r]`, F = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, Le = /-->/g, Me = />/g, L = RegExp(`>|${ce}(?:([^\\s"'>=/]+)(${ce}*=${ce}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), ke = /'/g, Pe = /"/g, Ue = /^(?:script|style|textarea|title)$/i, dt = (r) => (e, ...t) => ({ _$litType$: r, strings: e, values: t }), g = dt(1), O = Symbol.for("lit-noChange"), m = Symbol.for("lit-nothing"), Re = /* @__PURE__ */ new WeakMap(), M = R.createTreeWalker(R, 129);
function Ye(r, e) {
  if (!ge(r) || !r.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return Te !== void 0 ? Te.createHTML(e) : e;
}
const ht = (r, e) => {
  const t = r.length - 1, s = [];
  let i, o = e === 2 ? "<svg>" : e === 3 ? "<math>" : "", n = F;
  for (let a = 0; a < t; a++) {
    const l = r[a];
    let h, d, c = -1, u = 0;
    for (; u < l.length && (n.lastIndex = u, d = n.exec(l), d !== null); ) u = n.lastIndex, n === F ? d[1] === "!--" ? n = Le : d[1] !== void 0 ? n = Me : d[2] !== void 0 ? (Ue.test(d[2]) && (i = RegExp("</" + d[2], "g")), n = L) : d[3] !== void 0 && (n = L) : n === L ? d[0] === ">" ? (n = i ?? F, c = -1) : d[1] === void 0 ? c = -2 : (c = n.lastIndex - d[2].length, h = d[1], n = d[3] === void 0 ? L : d[3] === '"' ? Pe : ke) : n === Pe || n === ke ? n = L : n === Le || n === Me ? n = F : (n = L, i = void 0);
    const p = n === L && r[a + 1].startsWith("/>") ? " " : "";
    o += n === F ? l + lt : c >= 0 ? (s.push(h), l.slice(0, c) + Ie + l.slice(c) + $ + p) : l + $ + (c === -2 ? a : p);
  }
  return [Ye(r, o + (r[t] || "<?>") + (e === 2 ? "</svg>" : e === 3 ? "</math>" : "")), s];
};
class G {
  constructor({ strings: e, _$litType$: t }, s) {
    let i;
    this.parts = [];
    let o = 0, n = 0;
    const a = e.length - 1, l = this.parts, [h, d] = ht(e, t);
    if (this.el = G.createElement(h, s), M.currentNode = this.el.content, t === 2 || t === 3) {
      const c = this.el.content.firstChild;
      c.replaceWith(...c.childNodes);
    }
    for (; (i = M.nextNode()) !== null && l.length < a; ) {
      if (i.nodeType === 1) {
        if (i.hasAttributes()) for (const c of i.getAttributeNames()) if (c.endsWith(Ie)) {
          const u = d[n++], p = i.getAttribute(c).split($), f = /([.?@])?(.*)/.exec(u);
          l.push({ type: 1, index: o, name: f[2], strings: p, ctor: f[1] === "." ? pt : f[1] === "?" ? ft : f[1] === "@" ? gt : ne }), i.removeAttribute(c);
        } else c.startsWith($) && (l.push({ type: 6, index: o }), i.removeAttribute(c));
        if (Ue.test(i.tagName)) {
          const c = i.textContent.split($), u = c.length - 1;
          if (u > 0) {
            i.textContent = se ? se.emptyScript : "";
            for (let p = 0; p < u; p++) i.append(c[p], q()), M.nextNode(), l.push({ type: 2, index: ++o });
            i.append(c[u], q());
          }
        }
      } else if (i.nodeType === 8) if (i.data === Oe) l.push({ type: 2, index: o });
      else {
        let c = -1;
        for (; (c = i.data.indexOf($, c + 1)) !== -1; ) l.push({ type: 7, index: o }), c += $.length - 1;
      }
      o++;
    }
  }
  static createElement(e, t) {
    const s = R.createElement("template");
    return s.innerHTML = e, s;
  }
}
function U(r, e, t = r, s) {
  var n, a;
  if (e === O) return e;
  let i = s !== void 0 ? (n = t._$Co) == null ? void 0 : n[s] : t._$Cl;
  const o = j(e) ? void 0 : e._$litDirective$;
  return (i == null ? void 0 : i.constructor) !== o && ((a = i == null ? void 0 : i._$AO) == null || a.call(i, !1), o === void 0 ? i = void 0 : (i = new o(r), i._$AT(r, t, s)), s !== void 0 ? (t._$Co ?? (t._$Co = []))[s] = i : t._$Cl = i), i !== void 0 && (e = U(r, i._$AS(r, e.values), i, s)), e;
}
class ut {
  constructor(e, t) {
    this._$AV = [], this._$AN = void 0, this._$AD = e, this._$AM = t;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(e) {
    const { el: { content: t }, parts: s } = this._$AD, i = ((e == null ? void 0 : e.creationScope) ?? R).importNode(t, !0);
    M.currentNode = i;
    let o = M.nextNode(), n = 0, a = 0, l = s[0];
    for (; l !== void 0; ) {
      if (n === l.index) {
        let h;
        l.type === 2 ? h = new J(o, o.nextSibling, this, e) : l.type === 1 ? h = new l.ctor(o, l.name, l.strings, this, e) : l.type === 6 && (h = new mt(o, this, e)), this._$AV.push(h), l = s[++a];
      }
      n !== (l == null ? void 0 : l.index) && (o = M.nextNode(), n++);
    }
    return M.currentNode = R, i;
  }
  p(e) {
    let t = 0;
    for (const s of this._$AV) s !== void 0 && (s.strings !== void 0 ? (s._$AI(e, s, t), t += s.strings.length - 2) : s._$AI(e[t])), t++;
  }
}
class J {
  get _$AU() {
    var e;
    return ((e = this._$AM) == null ? void 0 : e._$AU) ?? this._$Cv;
  }
  constructor(e, t, s, i) {
    this.type = 2, this._$AH = m, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = s, this.options = i, this._$Cv = (i == null ? void 0 : i.isConnected) ?? !0;
  }
  get parentNode() {
    let e = this._$AA.parentNode;
    const t = this._$AM;
    return t !== void 0 && (e == null ? void 0 : e.nodeType) === 11 && (e = t.parentNode), e;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(e, t = this) {
    e = U(this, e, t), j(e) ? e === m || e == null || e === "" ? (this._$AH !== m && this._$AR(), this._$AH = m) : e !== this._$AH && e !== O && this._(e) : e._$litType$ !== void 0 ? this.$(e) : e.nodeType !== void 0 ? this.T(e) : ct(e) ? this.k(e) : this._(e);
  }
  O(e) {
    return this._$AA.parentNode.insertBefore(e, this._$AB);
  }
  T(e) {
    this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
  }
  _(e) {
    this._$AH !== m && j(this._$AH) ? this._$AA.nextSibling.data = e : this.T(R.createTextNode(e)), this._$AH = e;
  }
  $(e) {
    var o;
    const { values: t, _$litType$: s } = e, i = typeof s == "number" ? this._$AC(e) : (s.el === void 0 && (s.el = G.createElement(Ye(s.h, s.h[0]), this.options)), s);
    if (((o = this._$AH) == null ? void 0 : o._$AD) === i) this._$AH.p(t);
    else {
      const n = new ut(i, this), a = n.u(this.options);
      n.p(t), this.T(a), this._$AH = n;
    }
  }
  _$AC(e) {
    let t = Re.get(e.strings);
    return t === void 0 && Re.set(e.strings, t = new G(e)), t;
  }
  k(e) {
    ge(this._$AH) || (this._$AH = [], this._$AR());
    const t = this._$AH;
    let s, i = 0;
    for (const o of e) i === t.length ? t.push(s = new J(this.O(q()), this.O(q()), this, this.options)) : s = t[i], s._$AI(o), i++;
    i < t.length && (this._$AR(s && s._$AB.nextSibling, i), t.length = i);
  }
  _$AR(e = this._$AA.nextSibling, t) {
    var s;
    for ((s = this._$AP) == null ? void 0 : s.call(this, !1, !0, t); e !== this._$AB; ) {
      const i = Se(e).nextSibling;
      Se(e).remove(), e = i;
    }
  }
  setConnected(e) {
    var t;
    this._$AM === void 0 && (this._$Cv = e, (t = this._$AP) == null || t.call(this, e));
  }
}
class ne {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(e, t, s, i, o) {
    this.type = 1, this._$AH = m, this._$AN = void 0, this.element = e, this.name = t, this._$AM = i, this.options = o, s.length > 2 || s[0] !== "" || s[1] !== "" ? (this._$AH = Array(s.length - 1).fill(new String()), this.strings = s) : this._$AH = m;
  }
  _$AI(e, t = this, s, i) {
    const o = this.strings;
    let n = !1;
    if (o === void 0) e = U(this, e, t, 0), n = !j(e) || e !== this._$AH && e !== O, n && (this._$AH = e);
    else {
      const a = e;
      let l, h;
      for (e = o[0], l = 0; l < o.length - 1; l++) h = U(this, a[s + l], t, l), h === O && (h = this._$AH[l]), n || (n = !j(h) || h !== this._$AH[l]), h === m ? e = m : e !== m && (e += (h ?? "") + o[l + 1]), this._$AH[l] = h;
    }
    n && !i && this.j(e);
  }
  j(e) {
    e === m ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
  }
}
class pt extends ne {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(e) {
    this.element[this.name] = e === m ? void 0 : e;
  }
}
class ft extends ne {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(e) {
    this.element.toggleAttribute(this.name, !!e && e !== m);
  }
}
class gt extends ne {
  constructor(e, t, s, i, o) {
    super(e, t, s, i, o), this.type = 5;
  }
  _$AI(e, t = this) {
    if ((e = U(this, e, t, 0) ?? m) === O) return;
    const s = this._$AH, i = e === m && s !== m || e.capture !== s.capture || e.once !== s.once || e.passive !== s.passive, o = e !== m && (s === m || i);
    i && this.element.removeEventListener(this.name, this, s), o && this.element.addEventListener(this.name, this, e), this._$AH = e;
  }
  handleEvent(e) {
    var t;
    typeof this._$AH == "function" ? this._$AH.call(((t = this.options) == null ? void 0 : t.host) ?? this.element, e) : this._$AH.handleEvent(e);
  }
}
class mt {
  constructor(e, t, s) {
    this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = s;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(e) {
    U(this, e);
  }
}
const de = K.litHtmlPolyfillSupport;
de == null || de(G, J), (K.litHtmlVersions ?? (K.litHtmlVersions = [])).push("3.3.2");
const vt = (r, e, t) => {
  const s = (t == null ? void 0 : t.renderBefore) ?? e;
  let i = s._$litPart$;
  if (i === void 0) {
    const o = (t == null ? void 0 : t.renderBefore) ?? null;
    s._$litPart$ = i = new J(e.insertBefore(q(), o), o, void 0, t ?? {});
  }
  return i._$AI(r), i;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const k = globalThis;
class P extends I {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    var t;
    const e = super.createRenderRoot();
    return (t = this.renderOptions).renderBefore ?? (t.renderBefore = e.firstChild), e;
  }
  update(e) {
    const t = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = vt(t, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    var e;
    super.connectedCallback(), (e = this._$Do) == null || e.setConnected(!0);
  }
  disconnectedCallback() {
    var e;
    super.disconnectedCallback(), (e = this._$Do) == null || e.setConnected(!1);
  }
  render() {
    return O;
  }
}
var De;
P._$litElement$ = !0, P.finalized = !0, (De = k.litElementHydrateSupport) == null || De.call(k, { LitElement: P });
const he = k.litElementPolyfillSupport;
he == null || he({ LitElement: P });
(k.litElementVersions ?? (k.litElementVersions = [])).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Ne = (r) => (e, t) => {
  t !== void 0 ? t.addInitializer(() => {
    customElements.define(r, e);
  }) : customElements.define(r, e);
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const bt = { attribute: !0, type: String, converter: ie, reflect: !1, hasChanged: fe }, yt = (r = bt, e, t) => {
  const { kind: s, metadata: i } = t;
  let o = globalThis.litPropertyMetadata.get(i);
  if (o === void 0 && globalThis.litPropertyMetadata.set(i, o = /* @__PURE__ */ new Map()), s === "setter" && ((r = Object.create(r)).wrapped = !0), o.set(t.name, r), s === "accessor") {
    const { name: n } = t;
    return { set(a) {
      const l = e.get.call(this);
      e.set.call(this, a), this.requestUpdate(n, l, r, !0, a);
    }, init(a) {
      return a !== void 0 && this.C(n, void 0, r, a), a;
    } };
  }
  if (s === "setter") {
    const { name: n } = t;
    return function(a) {
      const l = this[n];
      e.call(this, a), this.requestUpdate(n, l, r, !0, a);
    };
  }
  throw Error("Unsupported decorator location: " + s);
};
function ae(r) {
  return (e, t) => typeof t == "object" ? yt(r, e, t) : ((s, i, o) => {
    const n = i.hasOwnProperty(o);
    return i.constructor.createProperty(o, s), n ? Object.getOwnPropertyDescriptor(i, o) : void 0;
  })(r, e, t);
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function B(r) {
  return ae({ ...r, state: !0, attribute: !1 });
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const _t = (r, e, t) => (t.configurable = !0, t.enumerable = !0, Reflect.decorate && typeof e != "object" && Object.defineProperty(r, e, t), t);
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function x(r, e) {
  return (t, s, i) => {
    const o = (n) => {
      var a;
      return ((a = n.renderRoot) == null ? void 0 : a.querySelector(r)) ?? null;
    };
    return _t(t, s, { get() {
      return o(this);
    } });
  };
}
var Et = Object.defineProperty, wt = (r, e, t, s) => {
  for (var i = void 0, o = r.length - 1, n; o >= 0; o--)
    (n = r[o]) && (i = n(e, t, i) || i);
  return i && Et(e, t, i), i;
};
function Q(r) {
  return (e) => r[e.name] || e.name;
}
class D extends P {
  constructor() {
    super(...arguments), this._config = {};
  }
  set hass(e) {
    this._hass = e, this.serviceManager && (this.serviceManager.hass = e);
  }
  setConfig(e) {
    this._config = e;
  }
  willUpdate(e) {
    e.has("_config") && (this.serviceManager ? this.serviceManager.config = this._config : this.serviceManager = new Je(this._hass, this._config), this.onConfigUpdated(this._config, e.get("_config")));
  }
  // Called whenever _config changes, after serviceManager is up to date.
  // Override to recreate handlers or push live updates as needed.
  onConfigUpdated(e, t) {
  }
}
wt([
  B()
], D.prototype, "_config");
var xt = Object.defineProperty, Xe = (r, e, t, s) => {
  for (var i = void 0, o = r.length - 1, n; o >= 0; o--)
    (n = r[o]) && (i = n(e, t, i) || i);
  return i && xt(e, t, i), i;
};
const $t = Q({
  device_id: "Target Device",
  mouseSensitivity: "Touchpad Sensitivity (Default: 1.8)",
  scrollSensitivity: "Scroll Sensitivity (Default: 3.0)",
  scrollType: "Scroll Type",
  invertScroll: "Invert Scroll Direction"
}), ve = class ve extends D {
  static getConfigForm() {
    return {
      schema: [
        { name: "device_id", selector: { device: {} } },
        { name: "mouseSensitivity", selector: { number: { mode: "box", step: 0.1 } } },
        { name: "scrollSensitivity", selector: { number: { mode: "box", step: 0.1 } } },
        {
          name: "scrollType",
          selector: {
            select: {
              options: [
                { value: "touchpad", label: "High-Resolution (Precision Touchpad)" },
                { value: "wheel", label: "Standard (Mouse Wheel)" }
              ]
            }
          }
        },
        { name: "invertScroll", selector: { boolean: {} } }
      ],
      computeLabel: $t
    };
  }
  static getStubConfig() {
    return { type: "custom:smartmouse-touchpad-card" };
  }
  onConfigUpdated(e) {
    this.touchpadHandler && this.touchpadHandler.updateConfig(e);
  }
  firstUpdated() {
    this.touchpadHandler = new Ze(this.serviceManager, this._config), this.touchpadHandler.setupPad(this.padEl), this.touchpadHandler.setupScrollArea(this.scrollAreaEl);
  }
  render() {
    return g`
      <div class="pad">Touchpad</div>
      <div class="divider"></div>
      <div class="scroll-area">☰</div>
    `;
  }
  getCardSize() {
    return 4;
  }
};
ve.styles = C`
    :host {
      display: flex;
      height: 220px;
      width: 100%;
      border-radius: var(--ha-card-border-radius, 10px);
      overflow: hidden;
      border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, #2b2c2f);
      background: var(--ha-card-background, #1e1f22);
      box-shadow: var(--ha-card-box-shadow);
      color: var(--primary-text-color, #fff);
      user-select: none;
    }
    .pad {
      flex: 1;
      background: var(--dark, #2a2b2e);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      touch-action: none;
    }
    .divider {
      width: 1px;
      background: var(--divider-color, #3a3b3d);
    }
    .scroll-area {
      width: 56px;
      background: var(--dark, #2a2b2e);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      user-select: none;
      touch-action: none;
    }
  `;
let W = ve;
Xe([
  x(".pad")
], W.prototype, "padEl");
Xe([
  x(".scroll-area")
], W.prototype, "scrollAreaEl");
customElements.define("smartmouse-touchpad-card", W);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "smartmouse-touchpad-card",
  name: "SmartMouse Touchpad",
  description: "Touchpad and scroll area for SmartMouse.",
  preview: !0
});
function At(r) {
  if (r.key === "Dead" && (r.code === "Equal" || r.code === "Backquote") || r.key === "´" || r.key === "´´") return 227;
  if (r.code.startsWith("Key")) return r.code.charCodeAt(3) - 65 + 4;
  if (r.code.startsWith("Digit")) {
    const s = parseInt(r.code.slice(-1));
    return s === 0 ? 39 : s + 29;
  }
  const t = {
    Enter: 40,
    Escape: 41,
    Backspace: 42,
    Tab: 43,
    Space: 44,
    Minus: 45,
    Equal: 46,
    BracketLeft: 47,
    BracketRight: 48,
    Backslash: 49,
    Semicolon: 51,
    Quote: 52,
    Backquote: 53,
    Comma: 54,
    Period: 55,
    Slash: 56,
    CapsLock: 57,
    F1: 58,
    F2: 59,
    F3: 60,
    F4: 61,
    F5: 62,
    F6: 63,
    F7: 64,
    F8: 65,
    F9: 66,
    F10: 67,
    F11: 68,
    F12: 69,
    Insert: 73,
    Home: 74,
    PageUp: 75,
    Delete: 76,
    End: 77,
    PageDown: 78,
    ArrowRight: 79,
    ArrowLeft: 80,
    ArrowDown: 81,
    ArrowUp: 82,
    NumpadEnter: 88,
    ControlLeft: 224,
    ShiftLeft: 225,
    AltLeft: 226,
    MetaLeft: 227,
    ControlRight: 228,
    ShiftRight: 229,
    AltRight: 230,
    MetaRight: 231
  };
  return t[r.code] !== void 0 ? t[r.code] : null;
}
var Ct = Object.defineProperty, Be = (r, e, t, s) => {
  for (var i = void 0, o = r.length - 1, n; o >= 0; o--)
    (n = r[o]) && (i = n(e, t, i) || i);
  return i && Ct(e, t, i), i;
};
const St = Q({ device_id: "Target Device", height: "Card Height" }), Tt = 400, be = class be extends D {
  constructor() {
    super(...arguments), this.isLocked = !1, this.lockIntent = !1, this.handlePointerMove = (e) => {
      this.isLocked && this.serviceManager.sendMove(e.movementX || 0, e.movementY || 0);
    }, this.handleKey = (e, t) => {
      if (!this.isLocked || e.key === "Escape" || (e.preventDefault(), e.stopPropagation(), t === "press" && e.repeat)) return;
      const s = At(e);
      s && this.serviceManager.sendKey(s, t);
    }, this.handleKeyDown = (e) => this.handleKey(e, "press"), this.handleKeyUp = (e) => this.handleKey(e, "release"), this.blockScroll = (e) => {
      this.isLocked && e.preventDefault();
    }, this.handlePointerLockChange = () => {
      this.isPointerLocked() && this.lockIntent ? (this.isLocked = !0, this.releaseAllModifiers(), this.overlayEl.textContent = "System Locked. Escape to Exit", this.style.background = "var(--dark, #232427)", this.style.cursor = "none", this.decoyInputEl.focus(), window.addEventListener("keydown", this.handleKeyDown, !0), window.addEventListener("keyup", this.handleKeyUp, !0), window.addEventListener("wheel", this.blockScroll, { passive: !1 }), document.addEventListener("pointermove", this.handlePointerMove, { capture: !0 })) : (this.isLocked = !1, this.lockIntent = !1, this.releaseAllModifiers(), this.overlayEl.innerHTML = "Click to Lock System<br><small style='font-size: 0.7em; opacity: 0.7;'>Exit: Escape</small>", this.style.background = "var(--ha-card-background, #1e1f22)", this.style.cursor = "pointer", this.decoyInputEl.blur(), window.removeEventListener("keydown", this.handleKeyDown, !0), window.removeEventListener("keyup", this.handleKeyUp, !0), window.removeEventListener("wheel", this.blockScroll), document.removeEventListener("pointermove", this.handlePointerMove, { capture: !0 }));
    }, this.handlePointerDown = (e) => {
      if (!this.isLocked)
        this.lockIntent = !0, this.requestPointerLock(), e.preventDefault();
      else {
        const t = { 0: "left", 1: "middle", 2: "right" };
        this.serviceManager.sendButton(t[e.button] || "left", "down");
        try {
          this.releasePointerCapture(e.pointerId);
        } catch {
        }
        e.preventDefault();
      }
    }, this.handlePointerUp = (e) => {
      if (this.isLocked) {
        const t = { 0: "left", 1: "middle", 2: "right" };
        this.serviceManager.sendButton(t[e.button] || "left", "up"), e.preventDefault();
      }
    }, this.handleWheel = (e) => {
      this.isLocked && (e.preventDefault(), this.serviceManager.sendScrollWheel(Math.sign(e.deltaY) * -1));
    }, this.handleContextMenu = (e) => {
      this.isLocked && e.preventDefault();
    };
  }
  static getConfigForm() {
    return {
      schema: [
        { name: "device_id", selector: { device: {} } },
        { name: "height", selector: { number: { mode: "box", min: 100, max: 1e3, unit_of_measurement: "px" } } }
      ],
      computeLabel: St
    };
  }
  static getStubConfig() {
    return { type: "custom:smartmouse-desktop-card" };
  }
  onConfigUpdated(e) {
    this.style.height = `${e.height || Tt}px`;
  }
  // Listeners are wired in connectedCallback (not firstUpdated) so they are
  // re-attached every time HA reconnects the element - e.g. after switching
  // dashboards and coming back, where the same element is reused and
  // firstUpdated would NOT run again, leaving the card dead until a reload.
  connectedCallback() {
    super.connectedCallback(), this.addEventListener("pointerdown", this.handlePointerDown), this.addEventListener("pointerup", this.handlePointerUp), this.addEventListener("wheel", this.handleWheel, { passive: !1 }), this.addEventListener("contextmenu", this.handleContextMenu), document.addEventListener("pointerlockchange", this.handlePointerLockChange);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.removeEventListener("pointerdown", this.handlePointerDown), this.removeEventListener("pointerup", this.handlePointerUp), this.removeEventListener("wheel", this.handleWheel), this.removeEventListener("contextmenu", this.handleContextMenu), document.removeEventListener("pointerlockchange", this.handlePointerLockChange), window.removeEventListener("keydown", this.handleKeyDown, !0), window.removeEventListener("keyup", this.handleKeyUp, !0), window.removeEventListener("wheel", this.blockScroll), document.removeEventListener("pointermove", this.handlePointerMove, { capture: !0 }), this.isLocked = !1, this.lockIntent = !1;
  }
  // In Home Assistant this card lives inside nested shadow roots, where
  // document.pointerLockElement is retargeted and identity checks against
  // `this` are unreliable across browsers. Instead we track our own intent:
  // once WE requested a lock, any active pointer lock means we hold it (only
  // this card ever requests one on the dashboard).
  isPointerLocked() {
    const e = this.getRootNode();
    return document.pointerLockElement != null || e.pointerLockElement != null;
  }
  // Clear any modifier that got stuck (e.g. a keyup lost because focus changed
  // while it was held). Sent on both lock and unlock so a session never starts
  // or ends with Ctrl/Shift/Alt/Win still down on the PC.
  releaseAllModifiers() {
    for (let e = 224; e <= 231; e++)
      this.serviceManager.sendKey(e, "release");
  }
  render() {
    return g`
      <div class="overlay">Click to Lock System<br><small style="font-size: 0.7em; opacity: 0.7;">Exit: Escape</small></div>
      <input class="decoy" type="text">
    `;
  }
  getCardSize() {
    return 4;
  }
};
be.styles = C`
    :host {
      display: flex;
      width: 100%;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      background-color: var(--ha-card-background, #1e1f22);
      border-radius: var(--ha-card-border-radius, 14px);
      border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, #2b2c2f);
      color: var(--primary-text-color, #fff);
      transition: background 0.3s;
      user-select: none;
      overflow: hidden;
    }
    .overlay { text-align: center; pointer-events: none; }
    .decoy { position: absolute; opacity: 0; pointer-events: none; z-index: -1; }
  `;
let V = be;
Be([
  x(".overlay")
], V.prototype, "overlayEl");
Be([
  x(".decoy")
], V.prototype, "decoyInputEl");
customElements.define("smartmouse-desktop-card", V);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "smartmouse-desktop-card",
  name: "SmartMouse Desktop",
  description: "Desktop lock card for mouse and keyboard passthrough.",
  preview: !0
});
class Fe {
  constructor(e, t) {
    this.serviceManager = e, this.config = t, this.gyroRelativeActive = !1, this.gyroAbsoluteActive = !1, this.isCalibrated = !1, this.calibrating = !1, this.firstAbsoluteFrame = !1, this.calibrationStartTime = 0, this.calibrationDuration = 3e3, this.orientation = { x: 0, y: 0, z: 0 }, this.accumX = 0, this.accumY = 0, this.lastRawX = null, this.lastRawY = null, this.lastLoopTime = performance.now(), this.carryX = 0, this.carryY = 0, this.smoothRing = [], this.smoothIndex = 0, this.SMOOTH_UPPER = 75, this.bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 }, this.smoothX = 0, this.smoothY = 0, this.lastReadingTime = performance.now(), this.readingCount = 0, this.measuredFrequency = 0, this._debugSource = "none", this._prevReadX = null, this._minStep = 1 / 0, this.suppressionEndTime = 0, this.sensor = null, this.isListening = !1, this._boundHandler = null, this.calTimer = null, this.originalCalibrateBtnIcon = "", this.updateConfig(t), this._loopInterval = window.setInterval(() => this.processLoop(), 10), this.loadCalibration(), this.config.debug && this.startListening(), this._suppressHandler = (s) => {
      s.detail && typeof s.detail.ms == "number" && this.setGyroSuppression(s.detail.ms);
    }, window.addEventListener("smartmouse-gyro-suppress", this._suppressHandler);
  }
  // Live-updatable so editor tweaks apply without recreating the handler
  // (which would leak the interval/listener).
  updateConfig(e) {
    this.config = e, this.GAIN = e.gyroSensitivity ?? 8;
    const t = Math.max(0, Math.min(1, e.smoothing ?? 0.15));
    this.SMOOTH_WINDOW = Math.max(1, 1 + Math.round(t * 11)), this.TIGHTEN_THRESHOLD = e.gyroTightenThreshold ?? 3, this.SUPPRESSION_OFFSET = e.suppressionOffset ?? 20;
  }
  destroy() {
    var e, t;
    clearInterval(this._loopInterval), window.removeEventListener("smartmouse-gyro-suppress", this._suppressHandler), this.sensor && ((t = (e = this.sensor).stop) == null || t.call(e), this.sensor = null), this._boundHandler && (window.removeEventListener("deviceorientation", this._boundHandler, !0), this._boundHandler = null), this.isListening = !1, this.gyroRelativeActive = !1, this.gyroAbsoluteActive = !1;
  }
  processLoop() {
    if (!this.gyroRelativeActive && !this.gyroAbsoluteActive) return;
    const e = performance.now();
    if (e < this.suppressionEndTime) {
      this.lastRawX = this.orientation.x, this.lastRawY = this.orientation.y, this.accumX = 0, this.accumY = 0, this.lastLoopTime = e;
      return;
    }
    if (this.gyroAbsoluteActive) {
      this.processAbsolute();
      return;
    }
    const t = (e - this.lastLoopTime) / 1e3;
    if (this.lastLoopTime = e, t <= 0 || t > 0.5) {
      this.accumX = 0, this.accumY = 0;
      return;
    }
    let s = this.accumX, i = this.accumY;
    this.accumX = 0, this.accumY = 0;
    const o = Math.hypot(s, i) / t;
    if (this.TIGHTEN_THRESHOLD > 0 && o < this.TIGHTEN_THRESHOLD) {
      const c = o / this.TIGHTEN_THRESHOLD;
      s *= c, i *= c;
    }
    const n = this.tieredSmooth(s, i, o), a = n.x * this.GAIN * -10 + this.carryX, l = n.y * this.GAIN * -10 + this.carryY, h = Math.trunc(a), d = Math.trunc(l);
    this.carryX = a - h, this.carryY = l - d, (h !== 0 || d !== 0) && this.serviceManager.sendMove(h, d);
  }
  // Accumulate raw angular movement as sensor readings arrive, regardless of
  // their rate. Called from both the modern and legacy sensor callbacks, so a
  // 60Hz and a 120Hz sensor deliver the same total motion to the fixed-rate loop.
  accumulateRelative() {
    if (!this.gyroRelativeActive) return;
    if (this.lastRawX === null || this.lastRawY === null) {
      this.lastRawX = this.orientation.x, this.lastRawY = this.orientation.y;
      return;
    }
    let e = this.orientation.x - this.lastRawX, t = this.orientation.y - this.lastRawY;
    e > 180 && (e -= 360), e < -180 && (e += 360), this.accumX += e, this.accumY += t, this.lastRawX = this.orientation.x, this.lastRawY = this.orientation.y;
  }
  // Jibb Smart's tiered smoothing (the technique Steam Input uses): split each
  // frame's motion into a "direct" part that passes through immediately and a
  // "soft" part that goes through a fixed-length moving average. The faster the
  // motion, the larger the direct part - so quick flicks stay responsive while
  // slow motion is smoothed. The fixed-N ring initialised to zero preserves the
  // total movement (sum/N spreads a spike across N frames without losing it).
  tieredSmooth(e, t, s) {
    const i = this.TIGHTEN_THRESHOLD, o = this.SMOOTH_UPPER;
    let n = o > i ? (s - i) / (o - i) : 1;
    n = Math.max(0, Math.min(1, n));
    const a = e * (1 - n), l = t * (1 - n), h = this.SMOOTH_WINDOW;
    this.smoothRing.length !== h && (this.smoothRing = Array.from({ length: h }, () => ({ x: 0, y: 0 })), this.smoothIndex = 0), this.smoothRing[this.smoothIndex] = { x: a, y: l }, this.smoothIndex = (this.smoothIndex + 1) % h;
    let d = 0, c = 0;
    for (const u of this.smoothRing)
      d += u.x, c += u.y;
    return { x: e * n + d / h, y: t * n + c / h };
  }
  resetRelativeState() {
    this.accumX = 0, this.accumY = 0, this.carryX = 0, this.carryY = 0, this.lastRawX = null, this.lastRawY = null, this.smoothRing = [], this.smoothIndex = 0, this.lastLoopTime = performance.now();
  }
  processAbsolute() {
    if (!this.isCalibrated || this.calibrating) return;
    const e = 32767, t = this.mapCircular(this.orientation.x, this.bounds.minX, this.bounds.maxX, e), s = this.mapLinear(this.orientation.y, this.bounds.minY, this.bounds.maxY, e), i = e - t, o = e - s;
    this.firstAbsoluteFrame ? (this.smoothX = i, this.smoothY = o, this.firstAbsoluteFrame = !1) : (this.smoothX = this.smoothX * 0.7 + i * 0.3, this.smoothY = this.smoothY * 0.7 + o * 0.3), this.serviceManager.sendMoveAbsolute(Math.round(this.smoothX), Math.round(this.smoothY));
  }
  mapLinear(e, t, s, i) {
    if (s === t) return i / 2;
    const n = (Math.max(t, Math.min(s, e)) - t) / (s - t);
    return Math.round(n * i);
  }
  mapCircular(e, t, s, i) {
    const o = (e % 360 + 360) % 360, n = (t % 360 + 360) % 360, l = ((s % 360 + 360) % 360 - n + 360) % 360;
    if (l <= 0.1) return i / 2;
    const h = (o - n + 360) % 360;
    if (h <= l)
      return Math.round(h / l * i);
    {
      const d = 360 - h, c = h - l;
      return d < c ? 0 : i;
    }
  }
  recenter() {
    var s;
    const e = (this.bounds.maxX - this.bounds.minX + 360) % 360, t = this.bounds.maxY - this.bounds.minY;
    this.bounds.minX = (this.orientation.x - e / 2 + 360) % 360, this.bounds.maxX = (this.orientation.x + e / 2 + 360) % 360, this.bounds.minY = this.orientation.y - t / 2, this.bounds.maxY = this.orientation.y + t / 2, this.saveCalibration(), (s = navigator.vibrate) == null || s.call(navigator, [30, 30]), this.debugElem && this.updateDebug("Recentered");
  }
  setGyroSuppression(e) {
    this.suppressionEndTime = performance.now() + e + this.SUPPRESSION_OFFSET;
  }
  startListening() {
    if (!this.isListening) {
      if (this.isListening = !0, this.readingCount = 0, this.lastReadingTime = performance.now(), window.RelativeOrientationSensor)
        try {
          this.sensor = new window.RelativeOrientationSensor({ frequency: 120, referenceFrame: "device" }), this.sensor.addEventListener("reading", () => this.handleSensorReading()), this.sensor.addEventListener("error", () => {
            this.sensor = null, this.startLegacyListener();
          }), this.sensor.start(), this.updateDebug("Modern API (Warte auf Daten)");
          return;
        } catch {
        }
      this.startLegacyListener();
    }
  }
  startLegacyListener() {
    this.isListening && (this.readingCount = 0, this.lastReadingTime = performance.now(), this._boundHandler || (this._boundHandler = this.handleLegacyOrientation.bind(this), window.addEventListener("deviceorientation", this._boundHandler, !0), this.updateDebug("Legacy API (Warte auf Daten)")));
  }
  stopListening() {
    this.config.debug || (this.isListening = !1, this.sensor && (this.sensor.stop(), this.sensor = null), this._boundHandler && (window.removeEventListener("deviceorientation", this._boundHandler, !0), this._boundHandler = null));
  }
  measureFrequency() {
    const e = performance.now();
    if (this.readingCount++, this.readingCount >= 100) {
      const t = e - this.lastReadingTime;
      this.measuredFrequency = this.readingCount / t * 1e3, this.readingCount = 0, this.lastReadingTime = e;
    }
  }
  handleSensorReading() {
    this.measureFrequency();
    const e = this.sensor.quaternion, t = e[3], s = e[0], i = e[1], o = e[2], n = 2 * (t * o + s * i), a = 1 - 2 * (i * i + o * o);
    let l = (Math.atan2(n, a) * (180 / Math.PI) + 360) % 360;
    const h = 2 * (t * s + i * o), d = 1 - 2 * (s * s + i * i), c = Math.atan2(h, d) * (180 / Math.PI), u = 2 * (t * i - o * s);
    let p = Math.abs(u) >= 1 ? Math.sign(u) * Math.PI / 2 * (180 / Math.PI) : Math.asin(u) * (180 / Math.PI);
    this.orientation = { x: l, y: c, z: p }, this._debugSource = "Modern API", this.trackResolution(), this.accumulateRelative(), this.calibrating && this.updateCalibrationBounds(), this.updateDebug("Modern API");
  }
  handleLegacyOrientation(e) {
    this.measureFrequency(), this.orientation = { x: e.alpha || 0, y: e.beta || 0, z: e.gamma || 0 }, this._debugSource = "Legacy API", this.trackResolution(), this.accumulateRelative(), this.calibrating && this.updateCalibrationBounds(), this.updateDebug("Legacy API", e);
  }
  // Track the smallest non-zero change in yaw between readings as an estimate
  // of the sensor's angular resolution.
  trackResolution() {
    if (this._prevReadX !== null) {
      let e = Math.abs(this.orientation.x - this._prevReadX);
      e > 180 && (e = 360 - e), e > 1e-4 && e < this._minStep && (this._minStep = e);
    }
    this._prevReadX = this.orientation.x;
  }
  // Start reading the sensor without activating cursor control (for the debug card).
  startMonitoring() {
    this.startListening();
  }
  getDebugInfo() {
    return {
      listening: this.isListening,
      source: this._debugSource,
      frequency: this.measuredFrequency,
      orientation: { x: this.orientation.x, y: this.orientation.y, z: this.orientation.z },
      resolution: this._minStep === 1 / 0 ? 0 : this._minStep,
      relativeActive: this.gyroRelativeActive,
      absoluteActive: this.gyroAbsoluteActive
    };
  }
  updateDebug(e, t = null) {
    this.debugElem && (this.debugElem.textContent = `Source: ${e}
Freq: ${this.measuredFrequency.toFixed(1)}Hz
X/Yaw: ${this.orientation.x.toFixed(2)}`);
  }
  async toggleGyroRelative() {
    if (this.gyroRelativeActive) {
      this.gyroRelativeActive = !1;
      return;
    }
    this.gyroRelativeActive = !0, this.resetRelativeState(), this.startListening();
  }
  async toggleGyroAbsolute() {
    if (this.gyroAbsoluteActive) {
      this.gyroAbsoluteActive = !1;
      return;
    }
    this.gyroAbsoluteActive = !0, this.firstAbsoluteFrame = !0, this.startListening();
  }
  // Remaining calibration methods mapped 1:1 from JS...
  _getStorageKey() {
    return `smartmouse_gyro_bounds_${this.config.device_id || "default"}`;
  }
  saveCalibration() {
    localStorage.setItem(this._getStorageKey(), JSON.stringify(this.bounds)), this.isCalibrated = !0;
  }
  loadCalibration() {
    const e = localStorage.getItem(this._getStorageKey());
    e && (this.bounds = JSON.parse(e), this.isCalibrated = !0);
  }
  startCalibration(e) {
    this.calibrating = !0, this.isCalibrated = !1, this.calibrateBtnElem = e, e && (this.originalCalibrateBtnIcon = e.innerHTML, e.innerHTML = "0%", e.style.background = "var(--error-color, #e74c3c)"), this.bounds.minX = this.orientation.x, this.bounds.maxX = this.orientation.x, this.bounds.minY = this.orientation.y, this.bounds.maxY = this.orientation.y, this.startListening(), this.calibrationStartTime = performance.now(), this.calTimer = window.setTimeout(() => this.finishCalibration(), this.calibrationDuration), this.debugElem && this.updateDebug("Calibrating...");
  }
  updateCalibrationBounds() {
    const e = performance.now() - this.calibrationStartTime, t = Math.min(100, Math.floor(e / this.calibrationDuration * 100));
    this.calibrateBtnElem && (this.calibrateBtnElem.textContent = `${t}%`), this.bounds.minY = Math.min(this.bounds.minY, this.orientation.y), this.bounds.maxY = Math.max(this.bounds.maxY, this.orientation.y);
    let s = this.orientation.x - this.bounds.minX;
    s > 180 && (s -= 360), s < -180 && (s += 360), s < 0 && (this.bounds.minX = this.orientation.x);
    let i = this.orientation.x - this.bounds.maxX;
    i > 180 && (i -= 360), i < -180 && (i += 360), i > 0 && (this.bounds.maxX = this.orientation.x);
  }
  finishCalibration() {
    var e;
    if (this.calibrating) {
      if (this.calTimer && clearTimeout(this.calTimer), this.calibrating = !1, this.saveCalibration(), this.calibrateBtnElem) {
        this.calibrateBtnElem.style.background = "var(--success-color, #2ecc71)";
        const t = this.config, s = !t.hideText, i = !t.hideIcon;
        i && s ? this.calibrateBtnElem.innerHTML = '<ha-icon icon="mdi:border-radius" style="margin-bottom: 4px; pointer-events: none;"></ha-icon>Calibrated!' : i ? this.calibrateBtnElem.innerHTML = '<ha-icon icon="mdi:border-radius" style="pointer-events: none;"></ha-icon>' : this.calibrateBtnElem.innerHTML = "Calibrated!", setTimeout(() => {
          this.calibrateBtnElem && (this.calibrateBtnElem.innerHTML = this.originalCalibrateBtnIcon || "Absolute", this.calibrateBtnElem.style.background = this.gyroAbsoluteActive ? "var(--primary-color, #666)" : "var(--dark, #2b2c2f)");
        }, 1e3);
      }
      (e = navigator.vibrate) == null || e.call(navigator, [100]), this.debugElem && this.updateDebug("Calibration Finished");
    }
  }
}
var Lt = Object.defineProperty, ze = (r, e, t, s) => {
  for (var i = void 0, o = r.length - 1, n; o >= 0; o--)
    (n = r[o]) && (i = n(e, t, i) || i);
  return i && Lt(e, t, i), i;
};
const Mt = Q({
  device_id: "Target Device",
  gyroMode: "Gyro Mode",
  buttonText: "Custom Button Text (Optional)",
  buttonIcon: "Custom Button Icon (Optional)",
  hideText: "Hide Button Text",
  hideIcon: "Hide Button Icon",
  gyroSensitivity: "Sensitivity (Default: 8)",
  smoothing: "Smoothing (0 = off, 1 = max)",
  gyroTightenThreshold: "Jitter Suppression (deg/s, Default: 3)",
  height: "Button Height (optional)"
}), ye = class ye extends D {
  constructor() {
    super(...arguments), this.pressTimer = null, this.isLongPress = !1, this.cancelPress = () => {
      this.pressTimer && (clearTimeout(this.pressTimer), this.pressTimer = null);
    }, this.handleAbsPointerDown = (e) => {
      this.gyroHandler.calibrating || (e.preventDefault(), this.isLongPress = !1, this.pressTimer = window.setTimeout(() => {
        var t;
        this.isLongPress = !0, this.gyroHandler.calibrating || (this.gyroHandler.startCalibration(this.btnEl), (t = navigator.vibrate) == null || t.call(navigator, [50]));
      }, 600));
    }, this.handleAbsPointerUp = (e) => {
      e.preventDefault(), this.cancelPress(), !this.isLongPress && (this.gyroHandler.calibrating || (this.gyroHandler.isCalibrated ? this.gyroHandler.toggleGyroAbsolute().then(() => {
        this.btnEl && (this.btnEl.style.background = this.gyroHandler.gyroAbsoluteActive ? "var(--primary-color, #666)" : "var(--dark, #2b2c2f)");
      }) : this.gyroHandler.startCalibration(this.btnEl)));
    }, this.handleRelClick = () => {
      this.gyroHandler.toggleGyroRelative().then(() => {
        this.btnEl && (this.btnEl.style.background = this.gyroHandler.gyroRelativeActive ? "var(--primary-color, #666)" : "var(--dark, #2b2c2f)");
      });
    };
  }
  static getConfigForm() {
    return {
      schema: [
        { name: "device_id", selector: { device: {} } },
        {
          name: "gyroMode",
          selector: {
            select: {
              options: [
                { value: "relative", label: "Relative (Standard Air Mouse)" },
                { value: "absolute", label: "Absolute (Laser Pointer)" }
              ]
            }
          }
        },
        { name: "buttonText", selector: { text: {} } },
        { name: "buttonIcon", selector: { icon: {} } },
        { name: "hideText", selector: { boolean: {} } },
        { name: "hideIcon", selector: { boolean: {} } },
        { name: "gyroSensitivity", selector: { number: { mode: "box", min: 1, max: 30, step: 0.5 } } },
        { name: "smoothing", selector: { number: { mode: "slider", min: 0, max: 1, step: 0.05 } } },
        { name: "gyroTightenThreshold", selector: { number: { mode: "box", min: 0, max: 20, step: 0.5, unit_of_measurement: "deg/s" } } },
        { name: "height", selector: { number: { mode: "box", min: 30, max: 400, unit_of_measurement: "px" } } }
      ],
      computeLabel: Mt
    };
  }
  static getStubConfig() {
    return { type: "custom:smartmouse-gyro-card", gyroMode: "relative" };
  }
  // Only recreate the handler when device_id/gyroMode actually change; tuning
  // values (sensitivity/smoothing/tighten) are pushed live via updateConfig so
  // editing them doesn't spin up (and leak) a second interval/listener.
  onConfigUpdated(e, t) {
    var i;
    !this.gyroHandler || !t || t.device_id !== e.device_id || t.gyroMode !== e.gyroMode ? ((i = this.gyroHandler) == null || i.destroy(), this.gyroHandler = new Fe(this.serviceManager, e)) : this.gyroHandler.updateConfig(e);
  }
  disconnectedCallback() {
    var e;
    super.disconnectedCallback(), (e = this.gyroHandler) == null || e.destroy();
  }
  updated() {
    if (this.debugEl && (this.gyroHandler.debugElem = this.debugEl), this.btnEl) {
      const e = this._config.height;
      this.btnEl.style.height = e ? `${e}px` : "", this.btnEl.style.minHeight = e ? `${e}px` : "";
    }
    this.btnEl && !this.gyroHandler.calibrating && this.syncButtonContent(this.btnEl, this._config.gyroMode === "absolute");
  }
  // The gyro button's inner markup (icon+text) is set imperatively rather than
  // via Lit bindings, because GyroHandler also writes to it directly during
  // calibration (innerHTML/style) - mixing the two would corrupt Lit's
  // internal tracking of that node's children.
  syncButtonContent(e, t) {
    const s = !this._config.hideText, i = !this._config.hideIcon, o = s ? this._config.buttonText || (t ? "Absolute" : "Relative") : "", n = this._config.buttonIcon || (t ? "mdi:bullseye" : "mdi:ray-start-arrow"), l = i ? `<ha-icon icon="${n}" style="margin-bottom: ${s && i ? "4px" : "0px"}; pointer-events: none;"></ha-icon>` : "";
    e.innerHTML = i || s ? `${l}${o}` : this._config.buttonText || (t ? "Absolute" : "Relative");
  }
  render() {
    const e = this._config.gyroMode === "absolute";
    return g`
      ${e ? g`<button
            class="gyro-btn"
            @pointerdown=${this.handleAbsPointerDown}
            @pointerup=${this.handleAbsPointerUp}
            @pointercancel=${this.cancelPress}
            @pointerleave=${this.cancelPress}
          ></button>` : g`<button class="gyro-btn" @click=${this.handleRelClick}></button>`}
      ${this._config.debug ? g`<div class="debug">Initializing Sensors...</div>` : ""}
    `;
  }
  getCardSize() {
    return 1;
  }
};
ye.styles = C`
    :host { display: flex; flex-direction: column; gap: 8px; }
    .gyro-btn {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 48px;
      padding: 12px; border-radius: var(--ha-card-border-radius, 8px); background: var(--dark, #2b2c2f);
      color: var(--primary-text-color, #fff); border: none; cursor: pointer; touch-action: manipulation;
    }
    .debug {
      padding: 8px; background: rgba(0,0,0,0.2); border-radius: 4px;
      font-family: monospace; font-size: 11px; white-space: pre-wrap;
    }
  `;
let Z = ye;
ze([
  x(".gyro-btn")
], Z.prototype, "btnEl");
ze([
  x(".debug")
], Z.prototype, "debugEl");
customElements.define("smartmouse-gyro-card", Z);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "smartmouse-gyro-card",
  name: "SmartMouse Gyro",
  description: "Gyroscope controls (Air Mouse) for SmartMouse.",
  preview: !0
});
const _ = {
  ENTER: 40,
  BACKSPACE: 42,
  RIGHT: 79,
  LEFT: 80,
  DOWN: 81,
  UP: 82
}, y = "​", Ke = "smartmouse-live-input-debug", w = (r) => {
  const e = {
    value: r.value,
    selectionStart: r.selectionStart ?? r.value.length,
    selectionEnd: r.selectionEnd ?? r.value.length
  };
  r.dispatchEvent(new CustomEvent(Ke, { detail: e, bubbles: !0 }));
}, qe = (r) => r.getRootNode().activeElement === r;
function je(r, e, t, s) {
  const i = Math.max(0, Math.min(t, s, r.length, e.length));
  let o = 0;
  for (; o < i && r[o] === e[o]; ) o++;
  const n = Math.max(0, Math.min(r.length - t, e.length - s));
  let a = 0;
  for (; a < n && r[r.length - 1 - a] === e[e.length - 1 - a]; ) a++;
  const l = r.length - o - a, h = e.slice(o, e.length - a);
  return { prefix: o, suffix: a, removed: l, added: h };
}
function Ge(r, e) {
  return (t) => {
    const s = t - e.pos;
    if (s === 0) return;
    const i = s > 0 ? _.RIGHT : _.LEFT;
    for (let o = 0; o < Math.abs(s); o++) r.sendKey(i, "send");
    e.pos = t;
  };
}
function We(r, e, t, s, i) {
  const o = r.selectionStart ?? r.value.length, n = i === "ArrowLeft" ? Math.max(0, o - 1) : Math.min(r.value.length, o + 1);
  n !== o && e.sendKey(i === "ArrowLeft" ? _.LEFT : _.RIGHT, "send"), t.pos = n;
  try {
    r.setSelectionRange(n, n);
  } catch {
  }
  w(r), setTimeout(s, 0);
}
function kt(r, e) {
  r.type = "password", r.setAttribute("autocomplete", "off"), r.setAttribute("autocorrect", "off"), r.setAttribute("autocapitalize", "none"), r.spellcheck = !1;
  const t = y + y;
  let s = t;
  const i = { pos: 1 }, o = Ge(e, i), n = () => {
    r.value = t, s = t, i.pos = 1;
    try {
      r.setSelectionRange(1, 1);
    } catch {
    }
    w(r);
  };
  n();
  const a = () => setTimeout(n, 20), l = () => {
    let d = r.value, c = r.selectionStart ?? d.length;
    if (c <= 0 && (d = y + d, s = y + s, i.pos += 1, c = 1), c >= d.length && (d = d + y, s = s + y), d !== r.value) {
      r.value = d;
      try {
        r.setSelectionRange(c, c);
      } catch {
      }
      w(r);
    }
  };
  r.addEventListener("focus", () => {
    try {
      r.setSelectionRange(1, 1);
    } catch {
    }
  }), r.addEventListener("input", () => {
    w(r);
    const d = r.value, c = r.selectionStart ?? d.length, { prefix: u, removed: p, added: f } = je(s, d, i.pos, c);
    o(u + p);
    for (let v = 0; v < p; v++) e.sendKey(_.BACKSPACE, "send");
    i.pos = u, f && (e.sendText(f), i.pos = u + f.length), o(c), s = d, a();
  }), r.addEventListener("blur", n);
  const h = () => {
    if (r.value !== s) return;
    const d = r.selectionStart ?? r.value.length;
    d !== i.pos && o(d), w(r), setTimeout(l, 0);
  };
  document.addEventListener("selectionchange", () => {
    qe(r) && h();
  }), r.addEventListener("click", h), r.addEventListener("keydown", (d) => {
    d.stopPropagation(), d.key === "Enter" ? (d.preventDefault(), e.sendKey(_.ENTER, "send"), a()) : d.key === "ArrowLeft" || d.key === "ArrowRight" ? (d.preventDefault(), We(r, e, i, l, d.key)) : d.key === "ArrowUp" ? (d.preventDefault(), e.sendKey(_.UP, "send")) : d.key === "ArrowDown" && (d.preventDefault(), e.sendKey(_.DOWN, "send"));
  });
}
function Pt(r, e, t = 4e3) {
  r.type = "text", r.setAttribute("data-1p-ignore", "true"), r.setAttribute("data-bwignore", "true"), r.setAttribute("data-lpignore", "true"), r.setAttribute("data-form-type", "other"), r.enterKeyHint = "enter";
  let s = y + y;
  const i = { pos: 1 }, o = Ge(e, i);
  let n = null;
  const a = () => {
    r.value = y + y, s = y + y, i.pos = 1;
    try {
      r.setSelectionRange(1, 1);
    } catch {
    }
    w(r);
  };
  a();
  const l = () => {
    n && clearTimeout(n), n = window.setTimeout(a, t);
  }, h = () => {
    let c = r.value, u = r.selectionStart ?? c.length;
    if (u <= 0 && (c = y + c, s = y + s, i.pos += 1, u = 1), u >= c.length && (c = c + y, s = s + y), c !== r.value) {
      r.value = c;
      try {
        r.setSelectionRange(u, u);
      } catch {
      }
      w(r);
    }
  };
  r.addEventListener("input", () => {
    l(), w(r);
    const c = r.value, u = r.selectionStart ?? c.length, { prefix: p, removed: f, added: v } = je(s, c, i.pos, u);
    o(p + f);
    for (let E = 0; E < f; E++) e.sendKey(_.BACKSPACE, "send");
    i.pos = p, v && (e.sendText(v), i.pos = p + v.length), o(u), s = c, setTimeout(h, 0);
  });
  const d = () => {
    if (r.value !== s) return;
    const c = r.selectionStart ?? r.value.length;
    c !== i.pos && (o(c), l()), w(r), setTimeout(h, 0);
  };
  document.addEventListener("selectionchange", () => {
    qe(r) && d();
  }), r.addEventListener("click", d), r.addEventListener("keydown", (c) => {
    c.stopPropagation(), c.key === "Enter" ? (c.preventDefault(), e.sendKey(_.ENTER, "send"), a()) : (c.key === "ArrowLeft" || c.key === "ArrowRight") && (c.preventDefault(), We(r, e, i, h, c.key));
  }), r.addEventListener("blur", a);
}
var Rt = Object.defineProperty, me = (r, e, t, s) => {
  for (var i = void 0, o = r.length - 1, n; o >= 0; o--)
    (n = r[o]) && (i = n(e, t, i) || i);
  return i && Rt(e, t, i), i;
};
const Dt = Q({
  device_id: "Target Device",
  inputType: "Input Mode",
  predictiveIdleSeconds: "Predictive: Clear After Idle (s)",
  debugVisible: "Debug: Show Raw Text"
}), Ht = 4, It = { " ": "·", "	": "→", "\n": "¶", "\r": "", "​": "_" }, Ot = "|";
function Ut(r) {
  const e = Array.from(r.value).map((i) => It[i] ?? i), t = Math.min(r.selectionStart, r.selectionEnd), s = Math.max(r.selectionStart, r.selectionEnd);
  return t === s ? e.splice(t, 0, Ot) : (e.splice(s, 0, "]"), e.splice(t, 0, "[")), e.join("");
}
const _e = class _e extends D {
  constructor() {
    super(...arguments), this.handleBufferedKeydown = (e) => {
      if (e.stopPropagation(), e.key === "Enter") {
        e.preventDefault();
        const t = e.target;
        t.value ? (this.serviceManager.sendText(t.value), t.value = "") : this.serviceManager.sendKey(40, "send");
      }
    };
  }
  static getConfigForm() {
    return {
      schema: [
        { name: "device_id", selector: { device: {} } },
        {
          name: "inputType",
          selector: {
            select: {
              options: [
                { value: "buffered", label: "Buffered (Press Enter to send)" },
                { value: "live", label: "Live (Sends as you type)" },
                { value: "predictive", label: "Predictive (keeps autocorrect/prediction)" }
              ]
            }
          }
        },
        { name: "predictiveIdleSeconds", selector: { number: { mode: "box", min: 1, max: 60, step: 1, unit_of_measurement: "s" } } },
        { name: "debugVisible", selector: { boolean: {} } }
      ],
      computeLabel: Dt
    };
  }
  static getStubConfig() {
    return { type: "custom:smartmouse-input-card", inputType: "buffered" };
  }
  // Wire the shared capture onto whichever input element is currently
  // rendered, once per element (Lit recreates it when inputType changes).
  updated() {
    const e = this.liveInputEl || this.predictiveInputEl;
    if (e && e !== this.attachedInput && this.serviceManager)
      if (this.attachedInput = e, e.addEventListener(Ke, (t) => {
        this.debugReadoutEl && (this.debugReadoutEl.textContent = Ut(t.detail));
      }), this.liveInputEl) kt(e, this.serviceManager);
      else {
        const t = this._config.predictiveIdleSeconds ?? Ht;
        Pt(e, this.serviceManager, t * 1e3);
      }
  }
  renderDebugReadout() {
    return this._config.debugVisible ? g`<div class="debug-readout"></div>` : "";
  }
  render() {
    return this._config.inputType === "live" ? g`
        <div class="wrapper">
          <div class="input-row">
            <input
              class="live-input"
              type="password"
              data-1p-ignore="true"
              data-bwignore="true"
              data-lpignore="true"
              data-form-type="other"
            >
            <ha-icon icon="mdi:keyboard"></ha-icon>
          </div>
          ${this.renderDebugReadout()}
        </div>
      ` : this._config.inputType === "predictive" ? g`
        <div class="wrapper">
          <div class="input-row">
            <input class="predictive-input" type="text">
            <ha-icon icon="mdi:keyboard"></ha-icon>
          </div>
          ${this.renderDebugReadout()}
        </div>
      ` : g`
      <input
        class="buffered-input"
        type="text"
        placeholder="Type to send..."
        @keydown=${this.handleBufferedKeydown}
      >
    `;
  }
};
_e.styles = C`
    :host { display: flex; gap: 8px; }
    .wrapper { display: flex; flex-direction: column; gap: 6px; width: 100%; margin: 0; padding: 0; }
    .input-row { position: relative; width: 100%; }
    .live-input, .predictive-input {
      width: 100%; padding: 12px; border-radius: var(--ha-card-border-radius, 8px); box-sizing: border-box;
      background: var(--dark, #2a2b2e); border: 0px;
      color: transparent; font-size: 14px; text-align: center;
    }
    ha-icon {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none;
    }
    .debug-readout {
      font-family: monospace; font-size: 11px; text-align: left;
      white-space: pre-wrap; word-break: break-all;
      padding: 4px 8px; border-radius: 4px;
      background: rgba(0, 0, 0, 0.15); color: var(--secondary-text-color, #aaa);
    }
    .buffered-input {
      flex: 1; padding: 12px; border-radius: var(--ha-card-border-radius, 8px); box-sizing: border-box;
      background: var(--dark, #2a2b2e); border: 0px;
      color: var(--primary-text-color, #fff); font-size: 14px; outline: none;
    }
  `;
let Y = _e;
me([
  x(".live-input")
], Y.prototype, "liveInputEl");
me([
  x(".predictive-input")
], Y.prototype, "predictiveInputEl");
me([
  x(".debug-readout")
], Y.prototype, "debugReadoutEl");
customElements.define("smartmouse-input-card", Y);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "smartmouse-input-card",
  name: "SmartMouse Input",
  description: "Text input buffers for SmartMouse.",
  preview: !0
});
var Yt = Object.defineProperty, Nt = (r, e, t, s) => {
  for (var i = void 0, o = r.length - 1, n; o >= 0; o--)
    (n = r[o]) && (i = n(e, t, i) || i);
  return i && Yt(e, t, i), i;
};
const Xt = Q({ device_id: "Target Device" }), Bt = [
  { label: "Ctrl", code: 224, toggle: !0 },
  { label: "Shift", code: 225, toggle: !0 },
  { label: "Alt", code: 226, toggle: !0 },
  { label: "Win", code: 227, toggle: !0 },
  { label: "ESC", code: 41, toggle: !1 }
], Ee = class Ee extends D {
  constructor() {
    super(...arguments), this.modifierState = { ctrl: !1, shift: !1, alt: !1, win: !1 };
  }
  static getConfigForm() {
    return {
      schema: [
        { name: "device_id", selector: { device: {} } }
      ],
      computeLabel: Xt
    };
  }
  static getStubConfig() {
    return { type: "custom:smartmouse-modifier-card" };
  }
  handleClick(e) {
    var t;
    if (e.toggle) {
      const s = e.label.toLowerCase(), i = !this.modifierState[s];
      this.modifierState = { ...this.modifierState, [s]: i }, this.serviceManager.sendKey(e.code, i ? "press" : "release");
    } else
      this.serviceManager.sendKey(e.code, "send");
    (t = navigator.vibrate) == null || t.call(navigator, [30]);
  }
  render() {
    return g`
      <div class="grid">
        ${Bt.map((e) => g`
          <button
            class=${e.toggle && this.modifierState[e.label.toLowerCase()] ? "active" : ""}
            @click=${() => this.handleClick(e)}
          >${e.label}</button>
        `)}
      </div>
    `;
  }
};
Ee.styles = C`
    .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
    button {
      display: flex; align-items: center; justify-content: center;
      padding: 12px 4px; border-radius: var(--ha-card-border-radius, 8px);
      background: var(--dark, #2b2c2f); color: var(--primary-text-color, #fff);
      border: none; cursor: pointer; font-size: 14px; font-weight: 600; touch-action: manipulation;
    }
    button.active { background: var(--primary-color, #666); }
  `;
let re = Ee;
Nt([
  B()
], re.prototype, "modifierState");
customElements.define("smartmouse-modifier-card", re);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "smartmouse-modifier-card",
  name: "SmartMouse Modifiers",
  description: "Toggleable modifier keys for SmartMouse.",
  preview: !0
});
var Ft = Object.defineProperty, zt = (r, e, t, s) => {
  for (var i = void 0, o = r.length - 1, n; o >= 0; o--)
    (n = r[o]) && (i = n(e, t, i) || i);
  return i && Ft(e, t, i), i;
};
const we = class we extends D {
  // No options: this card monitors the phone's own sensor, so it isn't tied to
  // a device. An empty schema keeps the visual editor clean.
  static getConfigForm() {
    return { schema: [] };
  }
  static getStubConfig() {
    return { type: "custom:smartmouse-debug-card" };
  }
  firstUpdated() {
    this.monitor = new Fe(this.serviceManager, { ...this._config, debug: !0 }), this.monitor.startMonitoring(), this.pollTimer = window.setInterval(() => {
      var e;
      this.info = (e = this.monitor) == null ? void 0 : e.getDebugInfo();
    }, 150);
  }
  disconnectedCallback() {
    var e;
    super.disconnectedCallback(), this.pollTimer && clearInterval(this.pollTimer), (e = this.monitor) == null || e.destroy();
  }
  freqLevel(e) {
    return e <= 0 ? "waiting" : e >= 60 ? "good" : e >= 30 ? "fair" : "poor";
  }
  resLevel(e) {
    return e <= 0 ? "waiting" : e <= 0.1 ? "good" : e <= 0.5 ? "fair" : "poor";
  }
  resolutionText(e) {
    return e.resolution <= 0 ? "—" : e.resolution < 1e-3 ? "<0.001° (continuous)" : `${e.resolution.toFixed(3)}°`;
  }
  verdict(e) {
    if (!e.listening || e.frequency <= 0)
      return { level: "waiting", text: "Waiting for sensor data — move the device. (Some browsers need motion-sensor permission.)" };
    const t = this.freqLevel(e.frequency), s = this.resLevel(e.resolution), i = ["poor", "fair", "good"], o = i[Math.min(i.indexOf(t), i.indexOf(s))];
    return { level: o, text: `${o === "good" ? "Good" : o === "fair" ? "Usable" : "Poor"} — refresh rate ${t === "good" ? "smooth" : t === "fair" ? "okay" : "low"}, resolution ${s === "good" ? "fine" : s === "fair" ? "okay" : "coarse"}.` };
  }
  render() {
    const e = this.info, t = e ? this.verdict(e) : { level: "waiting", text: "Starting…" }, s = (i, o = 2) => e ? i.toFixed(o) : "—";
    return g`
      <div class="title">Gyro Debug</div>
      <table>
        <tr><td>Source</td><td>${(e == null ? void 0 : e.source) ?? "—"}</td></tr>
        <tr><td>Refresh rate</td><td class=${e ? this.freqLevel(e.frequency) : ""}>${e ? s(e.frequency, 1) : "—"} Hz</td></tr>
        <tr><td>Resolution</td><td class=${e ? this.resLevel(e.resolution) : ""}>${e ? this.resolutionText(e) : "—"}</td></tr>
        <tr><td>Yaw (X)</td><td>${e ? s(e.orientation.x) : "—"}°</td></tr>
        <tr><td>Pitch (Y)</td><td>${e ? s(e.orientation.y) : "—"}°</td></tr>
        <tr><td>Roll (Z)</td><td>${e ? s(e.orientation.z) : "—"}°</td></tr>
      </table>
      <div class="verdict ${t.level}">${t.text}</div>
    `;
  }
  getCardSize() {
    return 3;
  }
};
we.styles = C`
    :host {
      display: block;
      padding: 12px 14px;
      background: var(--ha-card-background, var(--card-background-color, #1e1f22));
      border-radius: var(--ha-card-border-radius, 12px);
      border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--divider-color, #2b2c2f));
      color: var(--primary-text-color, #fff);
    }
    .title { font-weight: 600; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    td { padding: 4px 0; }
    td:first-child { color: var(--secondary-text-color, #aaa); }
    td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
    .verdict {
      margin-top: 10px; padding: 8px 10px; border-radius: 8px; font-size: 13px;
      background: rgba(127, 127, 127, 0.12);
    }
    .good { color: var(--success-color, #2ecc71); }
    .fair { color: var(--warning-color, #f1c40f); }
    .poor { color: var(--error-color, #e74c3c); }
    .waiting { color: var(--secondary-text-color, #aaa); }
    .verdict.good { background: color-mix(in srgb, var(--success-color, #2ecc71) 12%, transparent); }
    .verdict.fair { background: color-mix(in srgb, var(--warning-color, #f1c40f) 14%, transparent); }
    .verdict.poor { background: color-mix(in srgb, var(--error-color, #e74c3c) 12%, transparent); }
  `;
let oe = we;
zt([
  B()
], oe.prototype, "info");
customElements.define("smartmouse-debug-card", oe);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "smartmouse-debug-card",
  name: "SmartMouse Debug",
  description: "Live gyro data, refresh rate, resolution and a quality verdict.",
  preview: !0
});
var Kt = Object.defineProperty, qt = Object.getOwnPropertyDescriptor, S = (r, e, t, s) => {
  for (var i = s > 1 ? void 0 : s ? qt(e, t) : e, o = r.length - 1, n; o >= 0; o--)
    (n = r[o]) && (i = (s ? n(e, t, i) : n(i)) || i);
  return s && i && Kt(e, t, i), i;
};
let N = class extends P {
  async setConfig(r) {
    this._config = r, await this._createCard();
  }
  async _createCard() {
    var e, t;
    if (!((t = (e = this._config) == null ? void 0 : e.card) != null && t.type)) {
      this._cardElement = void 0;
      return;
    }
    const r = await window.loadCardHelpers();
    r && (this._cardElement = r.createCardElement(this._config.card), this._cardElement.hass = this.hass);
  }
  updated(r) {
    super.updated(r), r.has("hass") && this._cardElement && (this._cardElement.hass = this.hass);
  }
  static getConfigElement() {
    return document.createElement("container-card-editor");
  }
  static getStubConfig() {
    return {
      type: "custom:container-card",
      padding: "16px",
      card: {}
    };
  }
  render() {
    if (!this._config) return g``;
    const r = this._config.padding !== void 0 ? this._config.padding : "16px";
    return g`
      <ha-card>
        <div class="card-content" style="padding: ${r};">
          ${this._cardElement ? this._cardElement : g`<div style="color: var(--error-color, #e74c3c);">No valid card type selected. Please configure a sub-card.</div>`}
        </div>
      </ha-card>
    `;
  }
};
N.styles = C`
    .card-content {
      display: flex;
      flex-direction: column;
    }
  `;
S([
  ae({ attribute: !1 })
], N.prototype, "hass", 2);
S([
  B()
], N.prototype, "_config", 2);
S([
  B()
], N.prototype, "_cardElement", 2);
N = S([
  Ne("container-card")
], N);
let X = class extends P {
  setConfig(r) {
    this._config = r;
  }
  _paddingChanged(r) {
    if (!this._config || !this.hass) return;
    const e = r.target.value;
    this._config.padding !== e && this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: { ...this._config, padding: e } },
      bubbles: !0,
      composed: !0
    }));
  }
  _handleCardPicked(r) {
    r.stopPropagation(), this._config && this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: { ...this._config, card: r.detail.config } },
      bubbles: !0,
      composed: !0
    }));
  }
  _clearCard() {
    this._config && this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: { ...this._config, card: {} } },
      bubbles: !0,
      composed: !0
    }));
  }
  _cardConfigChanged(r) {
    r.stopPropagation(), !(!this._config || !this.hass) && this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: { ...this._config, card: r.detail.config } },
      bubbles: !0,
      composed: !0
    }));
  }
  render() {
    var r;
    return this._config ? g`
      <div class="card-config">
        <div class="option">
          <label>Padding (e.g. 16px)</label>
          <input 
            type="text" 
            .value=${this._config.padding !== void 0 ? this._config.padding : "16px"}
            @input=${this._paddingChanged}
          >
        </div>
        
        ${(r = this._config.card) != null && r.type ? g`
          <div class="option">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label>Card Configuration</label>
              <button class="change-btn" @click=${this._clearCard}>Change Card</button>
            </div>
            <hui-card-element-editor
              .hass=${this.hass}
              .lovelace=${this.lovelace}
              .value=${this._config.card}
              @config-changed=${this._cardConfigChanged}
            ></hui-card-element-editor>
          </div>
        ` : g`
          <div class="option">
            <label>Select Sub-Card</label>
            <hui-card-picker
              .hass=${this.hass}
              .lovelace=${this.lovelace}
              @config-changed=${this._handleCardPicked}
            ></hui-card-picker>
          </div>
        `}
      </div>
    ` : g``;
  }
};
X.styles = C`
    .card-config { display: flex; flex-direction: column; gap: 12px; }
    .option { display: flex; flex-direction: column; gap: 4px; }
    label { font-size: 14px; font-weight: 500; color: var(--primary-text-color, #fff); margin: 0; }
    input { padding: 8px; border-radius: 4px; background: var(--card-background-color, #2a2b2e); color: var(--primary-text-color, #fff); border: 1px solid var(--divider-color, #3a3b3d); outline: none; }
    .change-btn { background: var(--primary-color, #03a9f4); color: var(--text-primary-color, #fff); border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px; font-weight: 500; }
  `;
S([
  ae({ attribute: !1 })
], X.prototype, "hass", 2);
S([
  ae({ attribute: !1 })
], X.prototype, "lovelace", 2);
S([
  B()
], X.prototype, "_config", 2);
X = S([
  Ne("container-card-editor")
], X);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "container-card",
  name: "Container",
  description: "A general purpose styled visual background wrapper for Home Assistant cards.",
  preview: !0
});
