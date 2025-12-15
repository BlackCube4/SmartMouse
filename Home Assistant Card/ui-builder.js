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

  setupDesktopLayout(root, serviceManager) {
    Object.assign(root.style, {
      height: "400px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "crosshair",
    });

    const overlay = document.createElement("div");
    overlay.textContent = "Hover to control";
    Object.assign(overlay.style, {
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "18px",
      opacity: "0.5",
    });
    root.appendChild(overlay);

    let isActive = false;

    const handleMouseMove = (e) => {
      if (!isActive) return;
      const dx = e.movementX;
      const dy = e.movementY;
      if (dx || dy) serviceManager.sendMove(dx, dy);
    };

    const btnMap = { 0: "left", 1: "middle", 2: "right" };

    root.addEventListener("mouseenter", () => {
      isActive = true;
      overlay.textContent = "Controlling (ESC to release)";
      root.style.background = "var(--dark, #232427)";
    });

    root.addEventListener("mouseleave", () => {
      isActive = false;
      overlay.textContent = "Hover to control";
      root.style.background = "var(--ha-card-background, var(--card-background-color, #1e1f22))";
    });

    root.addEventListener("mousemove", handleMouseMove);
    root.addEventListener("mousedown", (e) => {
      if (!isActive) return;
      e.preventDefault();
      serviceManager.sendButton(btnMap[e.button] || "left", "down");
    });
    root.addEventListener("mouseup", (e) => {
      if (!isActive) return;
      e.preventDefault();
      serviceManager.sendButton(btnMap[e.button] || "left", "up");
    });
    root.addEventListener("wheel", (e) => {
      if (!isActive) return;
      e.preventDefault();
      serviceManager.sendScrollWheel(Math.sign(e.deltaY) * -1);
    }, { passive: false });

    root.tabIndex = 0;
    root.addEventListener("keydown", (e) => {
      if (!isActive) return;
      e.preventDefault();
      const key = this.getHIDKeycode(e.key, e.code);
      if (key) serviceManager.sendKey(key, "press");
    });
    root.addEventListener("keyup", (e) => {
      if (!isActive) return;
      e.preventDefault();
      const key = this.getHIDKeycode(e.key, e.code);
      if (key) serviceManager.sendKey(key, "release");
    });
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

    const expandBtn = this.createButton("mdi:chevron-up"); //▲
    
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

    const calibrateBtn = this.createButton("mdi:border-radius"); //⛶
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

    calibrateBtn.addEventListener("click", () => {
      if (gyroHandler.calibrating) return gyroHandler.finishCalibration();
      gyroHandler.startCalibration(calibrateBtn);
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