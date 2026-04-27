import { TouchpadHandler } from './touchpad-handler.js';
import { GyroHandler } from './gyro-handler.js';
import { UIBuilder } from './ui-builder.js';
import { ServiceManager } from './service-manager.js';

class SmartMouseCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.rendered = false;
    this._config = {};
    this._hass = null;
  }

  setConfig(config) {
    this._config = config || {};
  }

  set hass(hass) {
    this._hass = hass;
    if (this.serviceManager) {
      this.serviceManager.hass = hass;
    }

    // Update connection indicator based on whether the device entities are available
    if (this.uiBuilder && hass) {
      // We use the restart button's availability to determine connection status
      const entityId = Object.keys(hass.states).find(id => id.startsWith("button.") && id.endsWith("_restart"));
      const isConnected = entityId ? hass.states[entityId].state !== "unavailable" : false;
      this.uiBuilder.updateConnectionState(isConnected);
    }
  }

  connectedCallback() {
    if (this.rendered) return;
    this.rendered = true;

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    // Initialize managers with config
    this.serviceManager = new ServiceManager(this._hass, this._config);
    this.gyroHandler = new GyroHandler(this.serviceManager, this._config);
    this.touchpadHandler = new TouchpadHandler(this.serviceManager, this.gyroHandler, this._config);
    this.uiBuilder = new UIBuilder(this._config);

    this.gyroHandler.touchpadHandler = this.touchpadHandler;
    
    const root = this.uiBuilder.createRoot();

    if (isMobile) {
      this.uiBuilder.setupMobileLayout(root, this.touchpadHandler, this.gyroHandler);
    } else {
      this.uiBuilder.setupDesktopLayout(root, this.serviceManager);
    }

    this.shadowRoot.appendChild(root);
  }

  getCardSize() {
    return 4;
  }
}

customElements.define("smartmouse-card", SmartMouseCard);

/*
type: custom:smartmouse-card
# --- SENSITIVITY ---
mouseSensitivity: 1.8      # Touchpad speed multiplier (Default: 1.8)
scrollSensitivity: 3.0     # Scroll bar speed multiplier (Default: 3.0)
gyroSensitivity: 8.0       # Gyro Relative speed multiplier (Default: 8.0)

# --- SMOOTHING ---
smoothing: 0.15            # 0.0 = Raw/Fast, 1.0 = Max Lag/Smooth (Default: 0.15)
suppression_offset: 20     # Ms to ignore gyro after a click to prevent jitter (Default: 20)

# --- TOUCH TIMING (Advanced) ---
double_click_time: 250     # Max ms between taps for a double-click (Default: 250)
hold_time: 400             # Time to hold before triggering Right Click (Default: 400)
movement_deadzone: 3       # Deadzone in px before a tap becomes a move/drag (Default: 3)

# --- DEBUGGING ---
debug: true                # Set to true to show the sensor data overlay & console logs
*/
