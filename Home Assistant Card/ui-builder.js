export class UIBuilder {
  constructor(config) {
    this.config = config;
  }

  createRoot() {
    const root = document.createElement("div");
    Object.assign(root.style, {
      background: "#1e1f22",
      borderRadius: "14px",
      border: "1px solid #2b2c2f",
      color: "#fff",
      userSelect: "none",
      touchAction: "none",
      padding: "10px",
      fontFamily: "Inter, sans-serif",
      boxSizing: "border-box",
    });
    return root;
  }

  createButton(text, handler, fontSize = "13px") {
    const btn = document.createElement("button");
    btn.textContent = text;

    Object.assign(btn.style, {
      padding: "10px 6px",
      borderRadius: "10px",
      background: "#2b2c2f",
      color: "#fff",
      border: "1px solid #323337",
      fontSize: fontSize,
      cursor: "pointer",
      transition: "background 0.15s",
    });

    btn.addEventListener("pointerdown", () => {
      btn.style.background = "#3a3b3f";
    });
    btn.addEventListener("pointerup", () => {
      btn.style.background = "#2b2c2f";
    });

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
      background: "#1b1c1f",
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
      root.style.background = "#232427";
    });

    root.addEventListener("mouseleave", () => {
      isActive = false;
      overlay.textContent = "Hover to control";
      root.style.background = "#1b1c1f";
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
      expandBtn.textContent = expanded ? "▼" : "▲"; // ▲⮝˄ ▼⮟˅
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
      borderRadius: "10px",
      overflow: "hidden",
    });

    const pad = document.createElement("div");
    Object.assign(pad.style, {
      flex: "1",
      background: "#2a2b2e",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "15px",
    });
    pad.textContent = "Touchpad";

    const divider = document.createElement("div");
    Object.assign(divider.style, {
      width: "1px",
      background: "#3a3b3d",
    });

    const scrollArea = document.createElement("div");
    Object.assign(scrollArea.style, {
      width: "56px",
      background: "#2a2b2e",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "18px",
      userSelect: "none",
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

    const expandBtn = this.createButton("▲");
    const gyroRelBtn = this.createButton("↝", () => gyroHandler.toggleGyroRelative());
    const gyroAbsBtn = this.createButton("☉", () => gyroHandler.toggleGyroAbsolute());
    const calibrateBtn = this.createButton("⛶");
    const volDownBtn = this.createButton("-");
    const volUpBtn = this.createButton("+");

    gyroHandler.gyroRelBtn = gyroRelBtn;
    gyroHandler.gyroAbsBtn = gyroAbsBtn;

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
      if (gyroHandler.isCalibrated) {
        gyroHandler.isCalibrated = false;
        calibrateBtn.textContent = "☑";
        calibrateBtn.style.background = "#2b2c2f";
        navigator.vibrate?.(50);
        return;
      }
      gyroHandler.startCalibration(calibrateBtn);
    });

    // TEXT INPUT + SEND -------------------------------------------------------
    const textRow = document.createElement("div");
    Object.assign(textRow.style, {
      display: "flex",
      gap: "6px",
      alignItems: "center",
    });

    const liveWrapper = document.createElement("div");
    Object.assign(liveWrapper.style, {
      position: "relative",
      width: "15%",
    });

    const liveInput = document.createElement("input");
    liveInput.type = "text";
    Object.assign(liveInput.style, {
      width: "100%",
      padding: "10px",
      borderRadius: "10px",
      background: "#2a2b2e",
      border: "1px solid #323337",
      color: "transparent",
      fontSize: "14px",
      position: "relative",
      paddingInline: "0",
    });

    const liveInputOverlay = document.createElement("div");
    liveInputOverlay.textContent = "⌨";
    Object.assign(liveInputOverlay.style, {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      pointerEvents: "none",
      fontSize: "14px",
      zIndex: "1",
    });

    liveWrapper.appendChild(liveInput);
    liveWrapper.appendChild(liveInputOverlay);

    let processingInput = false;

    liveInput.addEventListener("beforeinput", (e) => {
      e.stopPropagation();
      
      // Handle backspace
      if (e.inputType === "deleteContentBackward") {
        e.preventDefault();
        touchpadHandler.serviceManager.sendKey(42, "send");
        return;
      }
      
      // Handle regular character input
      if (e.data && e.data.length === 1) {
        e.preventDefault();
        processingInput = true;
        
        // Try to get HID code for the character
        const hidCode = this.getCharacterHIDCode(e.data);
        if (hidCode) {
          const mods = hidCode.mods || [];
          mods.forEach((m) => touchpadHandler.serviceManager.sendKey(m, "press"));
          touchpadHandler.serviceManager.sendKey(hidCode.code, "send");
          mods.forEach((m) => touchpadHandler.serviceManager.sendKey(m, "release"));
        } else {
          // Fallback to text send for special characters
          touchpadHandler.serviceManager.sendText(e.data);
        }
        
        setTimeout(() => { processingInput = false; }, 10);
      }
    });

    liveInput.addEventListener("keydown", (e) => {
      if (processingInput) return;
      
      // Only handle special keys (Enter, arrows, etc.)
      const specialKeys = ["Enter", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", 
                          "Home", "End", "PageUp", "PageDown", "Delete", "Tab"];
      
      if (specialKeys.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        
        const code = this.getHIDKeycodeFromEvent(e);
        if (code) {
          touchpadHandler.serviceManager.sendKey(code, "send");
        }
      }
    });

    // Fallback for mobile keyboards that don't send keydown events properly
    liveInput.addEventListener("input", (e) => {
      e.stopPropagation();
      const text = liveInput.value;
      if (text) {
        touchpadHandler.serviceManager.sendText(text);
        liveInput.value = "";
      }
    });

    const textInput = document.createElement("input");
    textInput.type = "text";
    textInput.placeholder = "Enter text...";
    Object.assign(textInput.style, {
      flex: "1",
      padding: "10px",
      borderRadius: "10px",
      background: "#2a2b2e",
      border: "1px solid #323337",
      color: "#fff",
      fontSize: "14px",
    });

    textInput.addEventListener("keydown", (e) => e.stopPropagation());
    textInput.addEventListener("keyup", (e) => e.stopPropagation());

    const sendTextBtn = this.createButton("→", () => {
      const text = textInput.value;
      if (text) {
        touchpadHandler.serviceManager.sendText(text);
        textInput.value = "";
      }
      else
        touchpadHandler.serviceManager.sendButton("40", "send");
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
        b.style.background = modifierState[key] ? "#3a3b3f" : "#2b2c2f";
        touchpadHandler.serviceManager.sendKey(code, modifierState[key] ? "press" : "release");
      });
      modifierRow.appendChild(b);
    });

    const escBtn = this.createButton("ESC", () => {
      touchpadHandler.serviceManager.sendKey(41, "send");
      navigator.vibrate?.(30);
    });
    modifierRow.appendChild(escBtn);

    expandedArea.appendChild(modifierRow);
    root.appendChild(expandedArea);

    touchpadHandler.setupPad(pad);
    touchpadHandler.setupScrollArea(scrollArea);
  }

  getCharacterHIDCode(char) {
    // Lowercase letters
    if (/[a-z]/.test(char)) {
      return { code: 4 + (char.charCodeAt(0) - 97), mods: [] };
    }
    
    // Uppercase letters
    if (/[A-Z]/.test(char)) {
      return { code: 4 + (char.charCodeAt(0) - 65), mods: [0xE1] };
    }
    
    // Numbers
    if (/[1-9]/.test(char)) {
      return { code: 30 + (char.charCodeAt(0) - 49), mods: [] };
    }
    if (char === "0") {
      return { code: 39, mods: [] };
    }
    
    // German special characters
    const germanChars = {
      "ß": { code: 0x2D, mods: [] },
      "ü": { code: 0x2F, mods: [] },
      "ö": { code: 0x33, mods: [] },
      "ä": { code: 0x34, mods: [] },
      "Ü": { code: 0x2F, mods: [0xE1] },
      "Ö": { code: 0x33, mods: [0xE1] },
      "Ä": { code: 0x34, mods: [0xE1] },
    };
    
    if (germanChars[char]) return germanChars[char];
    
    // Common symbols (without shift)
    const symbolMap = {
      " ": { code: 44, mods: [] },
      "-": { code: 45, mods: [] },
      "=": { code: 46, mods: [] },
      "[": { code: 47, mods: [] },
      "]": { code: 48, mods: [] },
      "\\": { code: 49, mods: [] },
      ";": { code: 51, mods: [] },
      "'": { code: 52, mods: [] },
      "`": { code: 53, mods: [] },
      ",": { code: 54, mods: [] },
      ".": { code: 55, mods: [] },
      "/": { code: 56, mods: [] },
    };
    
    // Common symbols (with shift)
    const shiftSymbolMap = {
      "!": { code: 30, mods: [0xE1] },
      "@": { code: 31, mods: [0xE1] },
      "#": { code: 32, mods: [0xE1] },
      "$": { code: 33, mods: [0xE1] },
      "%": { code: 34, mods: [0xE1] },
      "^": { code: 35, mods: [0xE1] },
      "&": { code: 36, mods: [0xE1] },
      "*": { code: 37, mods: [0xE1] },
      "(": { code: 38, mods: [0xE1] },
      ")": { code: 39, mods: [0xE1] },
      "_": { code: 45, mods: [0xE1] },
      "+": { code: 46, mods: [0xE1] },
      "{": { code: 47, mods: [0xE1] },
      "}": { code: 48, mods: [0xE1] },
      "|": { code: 49, mods: [0xE1] },
      ":": { code: 51, mods: [0xE1] },
      '"': { code: 52, mods: [0xE1] },
      "~": { code: 53, mods: [0xE1] },
      "<": { code: 54, mods: [0xE1] },
      ">": { code: 55, mods: [0xE1] },
      "?": { code: 56, mods: [0xE1] },
    };
    
    if (symbolMap[char]) return symbolMap[char];
    if (shiftSymbolMap[char]) return shiftSymbolMap[char];
    
    // Return null for characters we can't map (will use text send instead)
    return null;
  }

  getHIDKeycodeFromEvent(e) {
    const k = e.key;
    if (k.length === 1) {
      if (/[a-z]/.test(k)) return 4 + (k.charCodeAt(0) - 97);
      if (/[A-Z]/.test(k)) return 4 + (k.charCodeAt(0) - 65);
      if (/[1-9]/.test(k)) return 30 + (k.charCodeAt(0) - 49);
      if (k === "0") return 39;
    }

    const map = {
      Enter: 40, Escape: 41, Backspace: 42, Tab: 43, " ": 44,
      "-": 45, "=": 46, "[": 47, "]": 48, "\\": 49, ";": 51, "'": 52,
      "`": 53, ",": 54, ".": 55, "/": 56,
      Delete: 76, Home: 74, End: 77, PageUp: 75, PageDown: 78,
      ArrowRight: 0x4F, ArrowLeft: 0x50, ArrowDown: 0x51, ArrowUp: 0x52,
      "!": 30, "@": 31, "#": 32, "$": 33, "%": 34, "^": 35, "&": 36, "*": 37,
      "(": 38, ")": 39, "_": 45, "+": 46, "{": 47, "}": 48, "|": 49,
      ":": 51, '"': 52, "~": 53, "<": 54, ">": 55, "?": 56
    };
    return map[k] || null;
  }

  getHIDKeycode(key, code) {
    return this.getHIDKeycodeFromEvent({ key, code });
  }
}