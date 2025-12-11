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
  }

  connectedCallback() {
    if (this.rendered) return;
    this.rendered = true;

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    // Initialize managers
    this.serviceManager = new ServiceManager(this._hass);
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