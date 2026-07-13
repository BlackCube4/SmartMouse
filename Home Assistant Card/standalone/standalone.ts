import { GyroHandler } from '../gyro-handler';
import { TouchpadHandler } from '../touchpad-handler';
import { WsServiceManager, WsStatus, TelemetryFrame } from '../ws-service-manager';
import { SmartMouseConfig } from '../types';
import { UIBuilder } from './ui-builder';

// Injected by index_html.h (server-side %AUTH_TOKEN% / %PCPWR_ENABLED%).
interface StandaloneConfig {
  authToken?: string;
  pcPowerEnabled?: boolean;
}

declare global {
  interface Window {
    SMARTMOUSE_CONFIG?: StandaloneConfig;
  }
}

function boot() {
  const injected = window.SMARTMOUSE_CONFIG || {};
  const pcPowerEnabled = !!injected.pcPowerEnabled;

  const config: SmartMouseConfig = {
    type: 'standalone',
    mouseSensitivity: 1.8,
    scrollSensitivity: 3.0,
    gyroSensitivity: 8.0,
    smoothing: 0.15,
    suppressionOffset: 20,
    doubleClickTime: 250,
    holdTime: 400,
    movementDeadzone: 3,
    debug: false,
  };

  const setStatus = (status: WsStatus) => {
    const dot = document.getElementById('ws-status-dot');
    if (dot) dot.className = 'status-dot ' + status;
  };

  const pcPowerBtn = document.getElementById('pc-power-btn');
  const onTelemetry = (t: TelemetryFrame) => {
    // Legacy events the UI listens for: pc status + capability gating.
    document.dispatchEvent(new CustomEvent('telemetry', { detail: { pcStat: t.pcState } }));
    document.dispatchEvent(new CustomEvent('pc-power-cap', { detail: !!(t.caps & 0x01) }));

    if (pcPowerBtn) {
      if (t.pcState === 1) { pcPowerBtn.style.background = 'var(--success)'; pcPowerBtn.innerText = 'PC: ON'; }
      else if (t.pcState === 0) { pcPowerBtn.style.background = 'var(--error)'; pcPowerBtn.innerText = 'PC: OFF'; }
      else { pcPowerBtn.style.background = 'var(--primary)'; pcPowerBtn.innerText = 'PC: SLEEP'; }
    }
  };

  const serviceManager = new WsServiceManager(config, {
    authToken: injected.authToken,
    onStatus: setStatus,
    onTelemetry,
  });

  const gyroHandler = new GyroHandler(serviceManager, config);
  const touchpadHandler = new TouchpadHandler(serviceManager, config);

  if (pcPowerEnabled && pcPowerBtn) {
    pcPowerBtn.style.display = 'inline-block';
    pcPowerBtn.addEventListener('click', () => serviceManager.sendPCPower(0x01));
  }

  const ui = new UIBuilder(config, pcPowerEnabled);
  const rootElement = document.getElementById('root');
  if (!rootElement) return;
  rootElement.innerHTML = '';

  const isMobile = window.matchMedia('only screen and (max-width: 760px)').matches;
  if (isMobile) {
    ui.setupMobileLayout(rootElement, serviceManager, touchpadHandler, gyroHandler);
    const statusDot = document.getElementById('ws-status-dot');
    if (statusDot) {
      statusDot.style.cursor = 'pointer';
      statusDot.addEventListener('touchstart', () => serviceManager.sendReset());
    }
  } else {
    ui.setupDesktopLayout(rootElement, serviceManager);
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
