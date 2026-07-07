import { ServiceManager } from './service-manager';
import { HomeAssistant } from './types';
import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';

// Shared editor base: renders the "Target Device" selector every card needs,
// subclasses add their own fields via renderExtraOptions().
export abstract class SmartMouseCardEditorBase extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() protected _config: any;

  setConfig(config: any) {
    this._config = config;
  }

  protected _valueChanged(ev: any, key: string) {
    if (!this._config) return;
    const target = ev.target as any;
    let value = target.type === 'checkbox' ? target.checked : (ev.detail?.value !== undefined ? ev.detail.value : target.value);
    if (target.type === 'number' && value !== '') {
      value = parseFloat(value);
    }
    if (this._config[key] === value) return;
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: { ...this._config, [key]: value } },
      bubbles: true, composed: true
    }));
  }

  protected renderExtraOptions() {
    return html``;
  }

  protected render() {
    if (!this._config) return html``;
    return html`
      <div class="card-config">
        <div class="option">
          <label>Target Device</label>
          <ha-selector
            .hass=${this.hass}
            .selector=${{ device: {} }}
            .value=${this._config.device_id || ''}
            @value-changed=${(e: any) => this._valueChanged(e, 'device_id')}
          ></ha-selector>
        </div>
        ${this.renderExtraOptions()}
      </div>
    `;
  }

  static styles = css`
    .card-config { display: flex; flex-direction: column; gap: 12px; }
    .option { display: flex; flex-direction: column; gap: 4px; }
    label { font-size: 14px; font-weight: 500; color: var(--primary-text-color, #fff); margin: 0; }
    input, select { padding: 8px; border-radius: 4px; background: var(--card-background-color, #2a2b2e); color: var(--primary-text-color, #fff); border: 1px solid var(--divider-color, #3a3b3d); outline: none; }
  `;
}

// Shared card base: handles the shadow root, hass wiring, and the
// "reset shadow DOM and rebuild" dance when a config key that affects
// layout changes. Subclasses implement buildCard() instead of connectedCallback().
export abstract class SmartMouseCardBase extends HTMLElement {
  protected _hass?: HomeAssistant;
  protected _config: any = {};
  protected serviceManager!: ServiceManager;
  protected rendered = false;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  // Config keys that require a full rebuild of the card when they change.
  // Defaults to device_id; override to add more.
  protected reconnectKeys(): string[] {
    return ['device_id'];
  }

  // Called on every setConfig, even when no rebuild happens.
  // Override to push live config updates into handlers without a rebuild.
  protected onConfigUpdated(_config: any) {}

  setConfig(config: any) {
    const oldConfig = this._config;
    this._config = config;
    this.onConfigUpdated(config);

    const needsRebuild = this.reconnectKeys().some(key => oldConfig?.[key] !== config[key]);
    if (this.rendered && needsRebuild) {
      if (this.shadowRoot) this.shadowRoot.innerHTML = '';
      this.rendered = false;
      this.connectedCallback();
    }
  }

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    if (this.serviceManager) this.serviceManager.hass = hass;
  }

  connectedCallback() {
    if (this.rendered) return;
    this.rendered = true;
    this.serviceManager = new ServiceManager(this._hass, this._config);
    this.buildCard();
  }

  protected abstract buildCard(): void;
}
