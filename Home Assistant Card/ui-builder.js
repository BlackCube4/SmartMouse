/**
 * UIBuilder Class
 * ----------------
 * Responsible for constructing the DOM elements for the custom card.
 * It handles CSS styling (using Home Assistant variables), layout structure,
 * and binding event listeners to the ServiceManager and GyroHandler.
 */
export class UIBuilder {
  constructor(config) {
    this.config = config;
    this.statusIndicator = null;
    this.statusWrap = null;
  }

  /**
   * Creates the main container for the card.
   * Applies standard Home Assistant card styling (backgrounds, borders, shadows)
   * to ensure it blends in with the dashboard theme.
   */
  createRoot() {
    const root = document.createElement("div");
    Object.assign(root.style, {
      background: "var(--ha-card-background, var(--card-background-color, #1e1f22))",
      borderRadius: "var(--ha-card-border-radius, 14px)",
      border: "var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, #2b2c2f)",
      color: "var(--primary-text-color, #fff)",
      userSelect: "none",
      padding: "10px",
      fontFamily: "var(--paper-font-body1_-_font-family, Inter, sans-serif)",
      boxSizing: "border-box",
      boxShadow: "var(--ha-card-box-shadow)"
    });

    // --- CONNECTION INDICATOR ---
    const statusWrap = document.createElement("div");
    Object.assign(statusWrap.style, {
      position: "absolute",
      top: "10px",
      right: "10px",
      display: "flex",
      alignItems: "center",
      gap: "5px",
      zIndex: "20",
      cursor: "pointer",
      padding: "5px",
      borderRadius: "50%",
      webkitTapHighlightColor: "transparent"
    });

    this.statusIndicator = document.createElement("div");
    Object.assign(this.statusIndicator.style, {
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      background: "var(--error-color, #e74c3c)",
      transition: "background 0.3s"
    });

    statusWrap.appendChild(this.statusIndicator);
    this.statusWrap = statusWrap;
    root.appendChild(statusWrap);

    return root;
  }

  //Button
  /**
   * specific button creator that handles both Text and MDI Icons.
   * @param {string} textOrIcon - Display text OR an icon string starting with "mdi:"
   * @param {function} handler - Click event handler
   * @param {string} fontSize - CSS font size (controls text size)
   */
  createButton(textOrIcon, handler, fontSize = "14px") {
    const btn = document.createElement("button");

    Object.assign(btn.style, {
      // Layout
      display: "flex",              // distinct center alignment for icons vs text
      alignItems: "center",
      justifyContent: "center",
      padding: "10px 6px",
      
      // Visuals
      borderRadius: "var(--ha-card-border-radius, 10px)",
      background: "var(--dark, #2b2c2f)",
      color: "var(--primary-text-color, #fff)",
      border: "var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, #2b2c2f)",
      fontSize: fontSize,
      cursor: "pointer",
      transition: "background 0.15s",
      
      // --- FIXES (Selection & Highlights) ---
      outline: "none",                        // No desktop blue focus ring
      webkitTapHighlightColor: "transparent", // No mobile tap highlight box
      userSelect: "none",                     // No text selection
      touchAction: "manipulation",            // Improves touch response
      overflow: "hidden"                      // Clips content to rounded corners
    });

    // --- ICON SIZE FIX ---
    // User requested fixed 18px size for icons, independent of text fontSize
    btn.style.setProperty("--mdc-icon-size", "18px");

    // --- ICON LOGIC ---
    if (textOrIcon.startsWith("mdi:")) {
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", textOrIcon);
      // Ensure the icon doesn't intercept pointer events intended for the button
      icon.style.pointerEvents = "none"; 
      btn.appendChild(icon);
    } else {
      btn.textContent = textOrIcon;
    }

    // Interaction Styles
    const setBg = (color) => { btn.style.background = color; };
    
    btn.addEventListener("pointerdown", () => setBg("var(--light, #3a3b3f)"));
    btn.addEventListener("pointerup", () => setBg("var(--dark, #2b2c2f)"));
    btn.addEventListener("pointerleave", () => setBg("var(--dark, #2b2c2f)")); // Safety release

    if (handler) btn.addEventListener("click", handler);
    return btn;
  }

  updateConnectionState(isConnected) {
    if (this.statusIndicator) {
      this.statusIndicator.style.background = isConnected 
        ? "var(--success-color, #4caf50)" 
        : "var(--error-color, #e74c3c)";
    }
  }

  /**
   * Performs a hardware reset via the service manager and recenters sensors locally.
   */
  _performReset(serviceManager, gyroHandler) {
    // Directly trigger the Home Assistant button entity for hardware reset
    if (serviceManager.hass) {
      serviceManager.hass.callService("button", "press", {
        entity_id: "button.keymouse_restart"
      });
    }
    
    if (serviceManager.reset) serviceManager.reset(); // Still clear modifiers via websocket
    if (gyroHandler) gyroHandler.recenter();
    navigator.vibrate?.(50);
  }

  setupDesktopLayout(root, serviceManager, gyroHandler) {
    Object.assign(root.style, {
      height: "400px",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      position: "relative",
      backgroundColor: "var(--ha-card-background, #1e1f22)",
      transition: "background 0.3s",
      overflow: "hidden" // Keep everything contained
    });

    // Bind Reset to Indicator (preventing lock trigger)
    this.statusWrap.addEventListener("pointerdown", (e) => {
      e.stopPropagation(); 
      this._performReset(serviceManager, gyroHandler);
    });

    const decoyInput = document.createElement("input");
    decoyInput.type = "text";
    Object.assign(decoyInput.style, { position: "absolute", opacity: 0, pointerEvents: "none", zIndex: -1 });
    root.appendChild(decoyInput);

    const overlay = document.createElement("div");
    overlay.innerHTML = "Click to Lock System<br><small style='font-size: 0.7em; opacity: 0.7;'>Exit: Escape</small>";
    Object.assign(overlay.style, { textAlign: "center", pointerEvents: "none", userSelect: "none" });
    root.appendChild(overlay);

    let isLocked = false;

    // --- KEYBOARD & ESC BLOCKING ---
    const handleKey = (e, mode) => {
      if (!isLocked) return;
      
      // Allow Escape to propagate so the browser handles the native pointer unlock
      if (e.key === 'Escape') return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (mode === "press" && e.repeat) return;

      // --- DEBUGGING ---
      if (this.config.debug) {
        console.log(`KeyMouse Debug | Key: "${e.key}", Code: "${e.code}"`);
      }

      let hidCode = this.getHIDKeycode(e.key, e.code);
      
      // Capture all states of the '´' dead key to ensure it works every time
      const isDeadKey = e.key === "Dead" && (e.code === "Equal" || e.code === "Backquote");
      const isComposedKey = e.key === "´" || e.key === "´´";
      
      if (isDeadKey || isComposedKey) {
        hidCode = 227;
      }

      if (!hidCode && e.code.startsWith('Key')) hidCode = e.code.charCodeAt(3) - 65 + 4;
      if (!hidCode && e.code.startsWith('Digit')) {
        const d = parseInt(e.code.slice(-1));
        hidCode = d === 0 ? 39 : d + 29;
      }

      const symbolMap = {
        Space: 44, Minus: 45, Equal: 46, BracketLeft: 47, BracketRight: 48,
        Backslash: 49, Semicolon: 51, Quote: 52, Backquote: 53, Comma: 54, 
        Period: 55, Slash: 56, CapsLock: 41, Tab: 43, Escape: 41
      };
      if (!hidCode) hidCode = symbolMap[e.code];

      const modMap = { 
        ControlLeft: 224, ShiftLeft: 225, AltLeft: 226, MetaLeft: 227, 
        ControlRight: 228, ShiftRight: 229, AltRight: 230 
      };
      if (!hidCode) hidCode = modMap[e.code];

      if (hidCode) serviceManager.sendKey(hidCode, mode);
    };

    const onKeyDown = (e) => handleKey(e, "press");
    const onKeyUp = (e) => handleKey(e, "release");
    
    // --- MOUSE BINDING ---
    const onPointerMove = (e) => {
      if (isLocked && document.pointerLockElement) {
        serviceManager.sendMove(e.movementX || 0, e.movementY || 0);
      }
    };

    const blockScroll = (e) => { if (isLocked) e.preventDefault(); };

    // --- LOCK STATE MANAGEMENT ---
    const syncLockState = () => {
      if (document.pointerLockElement === root || document.pointerLockElement !== null) {
        isLocked = true;
        overlay.textContent = "System Locked. Escape to Exit";
        root.style.background = "var(--dark, #232427)";
        root.style.cursor = "none";
        decoyInput.focus();
        
        window.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("keyup", onKeyUp, true);
        window.addEventListener("wheel", blockScroll, { passive: false });
        document.addEventListener("pointermove", onPointerMove, { capture: true });
      } else {
        isLocked = false;
        overlay.innerHTML = "Click to Lock System<br><small style='font-size: 0.7em; opacity: 0.7;'>Exit: Escape</small>";
        root.style.background = "var(--ha-card-background, #1e1f22)";
        root.style.cursor = "pointer";
        decoyInput.blur();
        
        window.removeEventListener("keydown", onKeyDown, true);
        window.removeEventListener("keyup", onKeyUp, true);
        window.removeEventListener("wheel", blockScroll);
        document.removeEventListener("pointermove", onPointerMove, { capture: true });
      }
    };

    document.addEventListener("pointerlockchange", syncLockState);

    root.addEventListener("pointerdown", (e) => {
      if (!isLocked) {
        root.requestPointerLock();
        e.preventDefault();
      } else {
        // Standard MouseEvent.button: 0=Left, 1=Middle, 2=Right
        const btnMap = { 0: "left", 1: "middle", 2: "right" };
        const btnName = btnMap[e.button] || "left";
        
        if (this.config.debug) {
          console.log(`KeyMouse Debug | Mouse Button: ${e.button} (${btnName}) Mode: down`);
        }

        serviceManager.sendButton(btnName, "down");

        // RELEASE POINTER CAPTURE: This is the fix. 
        // It prevents the browser from "stealing" the pointer deltas during a drag.
        try { root.releasePointerCapture(e.pointerId); } catch(err) {}

        e.preventDefault();
      }
    });

    root.addEventListener("pointerup", (e) => {
      if (isLocked) {
        const btnMap = { 0: "left", 1: "middle", 2: "right" };
        
        if (this.config.debug) {
          console.log(`KeyMouse Debug | Mouse Button: ${e.button} (${btnMap[e.button]}) Mode: up`);
        }

        serviceManager.sendButton(btnMap[e.button] || "left", "up");
        e.preventDefault();
      }
    });

    // Prevent middle-click "autoscroll" icon from appearing
    root.addEventListener("auxclick", (e) => { if (isLocked) e.preventDefault(); });

    root.addEventListener("wheel", (e) => {
      if (isLocked) {
        e.preventDefault();
        serviceManager.sendScrollWheel(Math.sign(e.deltaY) * -1);
      }
    }, { passive: false });

    root.addEventListener("contextmenu", (e) => { if (isLocked) e.preventDefault(); });
  }

  setupMobileLayout(root, touchpadHandler, gyroHandler) {
    let expanded = false;

    const updateLayout = () => {
      expandedArea.style.display = expanded ? "flex" : "none";
      
      // FIX: Manually update icon by creating a new element.
      expandBtn.innerHTML = "";
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", expanded ? "mdi:chevron-down" : "mdi:chevron-up"); //▼▲
      icon.style.pointerEvents = "none";
      expandBtn.appendChild(icon);
    };

    Object.assign(root.style, {
      display: "flex",
      flexDirection: "column",
    });

    // TRACKPAD + SCROLLBAR ----------------------------------------------------
    const topArea = document.createElement("div");
    Object.assign(topArea.style, {
      display: "flex",
      height: "220px",
      width: "100%",
      borderRadius: "var(--ha-card-border-radius, 10px)",
      overflow: "hidden",
      border: "var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, #2b2c2f)",
    });

    const pad = document.createElement("div");
    Object.assign(pad.style, {
      flex: "1",
      background: "var(--dark, #2a2b2e)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "15px",
      touchAction: "none", 
    });
    pad.textContent = "Touchpad";

    const divider = document.createElement("div");
    Object.assign(divider.style, {
      width: "1px",
      background: "var(--divider-color, #3a3b3d)",
    });

    const scrollArea = document.createElement("div");
    Object.assign(scrollArea.style, {
      width: "56px",
      background: "var(--dark, #2a2b2e)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "18px",
      userSelect: "none",
      touchAction: "none",
    });
    scrollArea.textContent = "☰";

    topArea.appendChild(pad);
    topArea.appendChild(divider);
    topArea.appendChild(scrollArea);
    root.appendChild(topArea);

    // BUTTON ROW --------------------------------------------------------------
    const buttonRow1 = document.createElement("div");
    Object.assign(buttonRow1.style, {
      display: "grid",
      gridTemplateColumns: "repeat(6, 1fr)",
      gap: "6px",
      marginTop: "10px",
    });

    const expandBtn = this.createButton("mdi:chevron-up"); 

    // Bind Reset to Indicator for mobile
    this.statusWrap.addEventListener("touchstart", (e) => {
      this._performReset(touchpadHandler.serviceManager, gyroHandler);
    });
    
    const gyroRelBtn = this.createButton("mdi:ray-start-arrow", () => { //↝
        gyroHandler.toggleGyroRelative().then(() => {
            if (gyroHandler.gyroRelativeActive) {
                gyroRelBtn.style.background = "var(--primary-color, #666)";
                gyroRelBtn.style.color = "var(--text-primary-color, #fff)";
            } else {
                gyroRelBtn.style.background = "var(--dark, #2b2c2f)";
                gyroRelBtn.style.color = "var(--primary-text-color, #fff)";
            }
        });
    });
    
    const gyroAbsBtn = this.createButton("mdi:bullseye", () => { //☉
        gyroHandler.toggleGyroAbsolute().then(() => {
            if (gyroHandler.gyroAbsoluteActive) {
                gyroAbsBtn.style.background = "var(--primary-color, #666)";
                gyroAbsBtn.style.color = "var(--text-primary-color, #fff)";
            } else {
                gyroAbsBtn.style.background = "var(--dark, #2b2c2f)";
                gyroAbsBtn.style.color = "var(--primary-text-color, #fff)";
            }
        });
    });

    const calibrateBtn = this.createButton("mdi:border-radius", () => {
        if (gyroHandler.calibrating) {
            gyroHandler.finishCalibration();
        } else if (gyroHandler.gyroAbsoluteActive) {
            // Quick Recenter if absolute is active
            gyroHandler.recenter();
        } else {
            gyroHandler.startCalibration(calibrateBtn);
        }
    }); 
    const volDownBtn = this.createButton("mdi:volume-minus"); //-
    const volUpBtn = this.createButton("mdi:volume-plus"); //+

    gyroHandler.gyroRelBtn = gyroRelBtn;
    gyroHandler.gyroAbsBtn = gyroAbsBtn;

    if (gyroHandler.isCalibrated) {
      calibrateBtn.style.background = "var(--dark, #2b2c2f)";
    }

    const volHandler = (btn, code) => {
      btn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        touchpadHandler.serviceManager.sendMediaKey(code, "press");
      });
      btn.addEventListener("touchend", (e) => {
        e.preventDefault();
        touchpadHandler.serviceManager.sendMediaKey(code, "release");
      });
      btn.addEventListener("touchcancel", (e) => {
        e.preventDefault();
        touchpadHandler.serviceManager.sendMediaKey(code, "release");
      });
    };

    volHandler(volDownBtn, 0xEA);
    volHandler(volUpBtn, 0xE9);

    buttonRow1.append(expandBtn, gyroRelBtn, gyroAbsBtn, calibrateBtn, volDownBtn, volUpBtn);
    root.appendChild(buttonRow1);

    // EXPANDED AREA -----------------------------------------------------------
    const expandedArea = document.createElement("div");
    Object.assign(expandedArea.style, {
      display: "none",
      flexDirection: "column",
      gap: "10px",
      marginTop: "10px",
    });

    expandBtn.addEventListener("click", () => {
      expanded = !expanded;
      updateLayout();
    });

    // TEXT INPUT + SEND -------------------------------------------------------
    const textRow = document.createElement("div");
    Object.assign(textRow.style, {
      display: "flex",
      gap: "6px",
      alignItems: "center",
    });

    // --- LIVE INPUT WRAPPER ---
    const liveWrapper = document.createElement("div");
    Object.assign(liveWrapper.style, {
      position: "relative",
      width: "15%",
    });

    const ANCHOR = " "; 
    
    // We track the last known value to detect diffs
    this.lastInputValue = ANCHOR;

    const liveInput = document.createElement("input");
    liveInput.type = "password"; 
    liveInput.autocomplete = "off";
    liveInput.autocorrect = "off";
    liveInput.autocapitalize = "off";
    liveInput.spellcheck = false;
    liveInput.value = ANCHOR;

    Object.assign(liveInput.style, {
      width: "100%",
      padding: "10px",
      borderRadius: "var(--ha-card-border-radius, 10px)",
      background: "var(--dark, #2a2b2e)",
      border: "var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, #2b2c2f)",
      color: "transparent", 
      fontSize: "14px",
      position: "relative",
      paddingInline: "0",
      textAlign: "center"
    });

    const liveInputOverlay = document.createElement("div"); //⌨
    Object.assign(liveInputOverlay.style, {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      pointerEvents: "none",
      zIndex: "1",
      color: "var(--primary-text-color, #fff)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    });
    
    const kbIcon = document.createElement("ha-icon");
    kbIcon.setAttribute("icon", "mdi:keyboard");
    kbIcon.style.setProperty("--mdc-icon-size", "18px"); // Match buttons
    liveInputOverlay.appendChild(kbIcon);

    liveWrapper.appendChild(liveInput);
    liveWrapper.appendChild(liveInputOverlay);

    // --- LIVE INPUT LOGIC (ROBUST DELTA) ---
    const ensureCursorAtEnd = () => {
      try {
        const len = liveInput.value.length;
        liveInput.setSelectionRange(len, len);
      } catch(e){}
    };

    liveInput.addEventListener("focus", ensureCursorAtEnd);
    liveInput.addEventListener("click", ensureCursorAtEnd);
    liveInput.addEventListener("touchend", ensureCursorAtEnd);

    liveInput.addEventListener("input", (e) => {
      const val = liveInput.value;
      const prev = this.lastInputValue;
      
      // Calculate pure length difference
      const diff = val.length - prev.length;
      
      // 1. Handle Reset (User or Code cleared it)
      if (val.length < ANCHOR.length) {
         touchpadHandler.serviceManager.sendKey(42, "send"); // Backspace
         // Async reset to prevent fighting
         setTimeout(() => {
             liveInput.value = ANCHOR;
             this.lastInputValue = ANCHOR;
             ensureCursorAtEnd();
         }, 0);
         return;
      }

      // 2. Handle Sending Logic based on diff
      if (diff > 0) {
          // Added characters (Typing)
          const added = val.slice(prev.length);
          if (added) {
            touchpadHandler.serviceManager.sendText(added);
          }
      } else if (diff < 0) {
          // Removed characters (Backspace)
          const absDiff = Math.abs(diff);
          for(let i=0; i<absDiff; i++) {
            touchpadHandler.serviceManager.sendKey(42, "send");
          }
      }

      // 3. Update History Optimistically
      this.lastInputValue = val;

      // 4. Anchor Maintenance (The Fix)
      // If text is getting too long...
      if (val.length > 30) {
          setTimeout(() => {
              liveInput.value = ANCHOR;
              this.lastInputValue = ANCHOR;
              ensureCursorAtEnd();
          }, 0);
      }
    });
    
    // Clear buffer on blur
    liveInput.addEventListener("blur", () => {
        liveInput.value = ANCHOR;
        this.lastInputValue = ANCHOR;
    });

    liveInput.addEventListener("keydown", (e) => {
      const specialKeys = ["Enter", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", 
                            "Home", "End", "PageUp", "PageDown", "Delete", "Tab"];
      
      if (specialKeys.includes(e.key)) {
        e.preventDefault();
        const code = this.getHIDKeycodeFromEvent(e);
        if (code) {
          touchpadHandler.serviceManager.sendKey(code, "send");
        }
      }
    });

    // --- STANDARD TEXT INPUT ---
    const textInput = document.createElement("input");
    textInput.type = "text";
    textInput.placeholder = "Enter text...";
    Object.assign(textInput.style, {
      flex: "1",
      padding: "10px",
      borderRadius: "var(--ha-card-border-radius, 10px)",
      background: "var(--dark, #2a2b2e)",
      border: "var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, #2b2c2f)",
      color: "var(--primary-text-color, #fff)",
      fontSize: "14px",
    });

    textInput.addEventListener("keydown", (e) => e.stopPropagation());
    textInput.addEventListener("keyup", (e) => e.stopPropagation());

    // --- SEND BUTTON ---
    const sendTextBtn = this.createButton("mdi:arrow-right-thin", () => { //→
      const text = textInput.value;
      if (text) {
        touchpadHandler.serviceManager.sendText(text);
        textInput.value = "";
      } else {
        touchpadHandler.serviceManager.sendKey(40, "send");
      }
    });
    Object.assign(sendTextBtn.style, {
      width: "15%",
    });

    textRow.append(liveWrapper, textInput, sendTextBtn);
    expandedArea.appendChild(textRow);

    // MODIFIER KEYS -----------------------------------------------------------
    const modifierRow = document.createElement("div");
    Object.assign(modifierRow.style, {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "8px",
    });

    const modifierState = { ctrl: false, alt: false, shift: false };

    [
      ["Ctrl", 0xE0],
      ["Alt", 0xE2],
      ["Shift", 0xE1],
    ].forEach(([label, code]) => {
      const b = this.createButton(label, () => {
        const key = label.toLowerCase();
        modifierState[key] = !modifierState[key];
        
        if (modifierState[key]) {
            b.style.background = "var(--primary-color, #3a3b3f)";
            b.style.color = "var(--text-primary-color, #fff)";
        } else {
            b.style.background = "var(--dark, #2b2c2f)";
            b.style.color = "var(--primary-text-color, #fff)";
        }
        
        touchpadHandler.serviceManager.sendKey(code, modifierState[key] ? "press" : "release");
      }, "14px");
      modifierRow.appendChild(b);
    });

    const escBtn = this.createButton("ESC", () => {
      touchpadHandler.serviceManager.sendKey(41, "send");
      navigator.vibrate?.(30);
    }, "14px");
    modifierRow.appendChild(escBtn);

    expandedArea.appendChild(modifierRow);

    // --- DEBUG DISPLAY (CONDITIONAL) ---
    // Only created if config.debug is true
    if (this.config.debug) {
        const debugRow = document.createElement("div");
        Object.assign(debugRow.style, {
            marginTop: "10px",
            padding: "8px",
            background: "#00000044",
            borderRadius: "4px",
            fontFamily: "monospace",
            fontSize: "11px",     // Slightly larger
            lineHeight: "1.4",    // Better readability
            color: "#aaa",
            whiteSpace: "pre-wrap" // Allow wrapping/newlines
        });
        debugRow.textContent = "Waiting for sensor data...";
        
        // Connect to Gyro Handler
        gyroHandler.debugElem = debugRow; 
        
        expandedArea.appendChild(debugRow);
    }
    // ---------------------

    root.appendChild(expandedArea);

    touchpadHandler.setupPad(pad);
    touchpadHandler.setupScrollArea(scrollArea);
  }

  getHIDKeycodeFromEvent(e) {
    const k = e.key;
    const map = {
      Enter: 40, Escape: 41, Backspace: 42, Tab: 43,
      Delete: 76, Home: 74, End: 77, PageUp: 75, PageDown: 78,
      ArrowRight: 0x4F, ArrowLeft: 0x50, ArrowDown: 0x51, ArrowUp: 0x52
    };
    return map[k] || null;
  }
    
  getHIDKeycode(key, code) {
    return this.getHIDKeycodeFromEvent({ key, code });
  }
}