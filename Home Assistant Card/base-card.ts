import { ServiceManager } from './service-manager';
import { HomeAssistant } from './types';
import { LitElement, html, css, PropertyValues } from 'lit';
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

// Shared card base: handles hass wiring and ServiceManager lifecycle.
// Lit's own reactive diffing replaces the old "wipe shadow DOM and rebuild"
// hack - subclasses just implement render() as usual and decide for
// themselves (in willUpdate/onConfigUpdated) whether a config change is
// significant enough to recreate a handler (e.g. GyroHandler, TouchpadHandler).
export abstract class SmartMouseCardBase extends LitElement {
  @state() protected _config: any = {};
  protected serviceManager!: ServiceManager;
  private _hass?: HomeAssistant;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    if (this.serviceManager) this.serviceManager.hass = hass;
  }

  setConfig(config: any) {
    this._config = config;
  }

  willUpdate(changedProps: PropertyValues) {
    if (changedProps.has('_config')) {
      if (!this.serviceManager) {
        this.serviceManager = new ServiceManager(this._hass, this._config);
      } else {
        this.serviceManager.config = this._config;
      }
      this.onConfigUpdated(this._config, changedProps.get('_config'));
    }
  }

  // Called whenever _config changes, after serviceManager is up to date.
  // Override to recreate handlers or push live updates as needed.
  protected onConfigUpdated(_config: any, _oldConfig: any) {}
}
