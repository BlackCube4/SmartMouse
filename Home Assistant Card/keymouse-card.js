import { TouchpadHandler } from './touchpad-handler.js';
import { GyroHandler } from './gyro-handler.js';
import { UIBuilder } from './ui-builder.js';
import { ServiceManager } from './service-manager.js';

class KeyMouseCard extends HTMLElement {
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

    // Update connection indicator based on the binary_sensor status
    if (this.uiBuilder && hass) {
      // Attempt to find the status entity (naming convention from binary_sensor.py)
      const entityId = Object.keys(hass.states).find(id => id.startsWith("binary_sensor.") && id.endsWith("_status"));
      const isConnected = entityId ? hass.states[entityId].state === "on" : false;
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

customElements.define("keymouse-card", KeyMouseCard);

/*
type: custom:keymouse-card
# --- SENSITIVITY ---
padSensitivity: 1.8        # Touchpad speed multiplier (Default: 1.8)
scrollSensitivity: 3.0     # Scroll bar speed multiplier (Default: 3.0)
gyroSensitivity: 1.2       # Gyro Relative speed multiplier (Default: 1.0)

# --- SMOOTHING ---
smoothing: 0.15            # 0.0 = Raw/Fast, 1.0 = Max Lag/Smooth (Default: 0.2)

# --- TOUCH TIMING (Advanced) ---
click_time: 200            # Max ms for a tap to register as a click (Default: 200)
double_click_time: 300     # Max ms between taps for a double-click (Default: 300)
hold_time: 500             # Time to hold before triggering Right Click (Default: 500)

# --- DEBUGGING ---
debug: true                # Set to true to show the sensor data overlay & console logs
*/
