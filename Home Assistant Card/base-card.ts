import { ServiceManager } from './service-manager';
import { HomeAssistant } from './types';
import { LitElement, PropertyValues } from 'lit';
import { state } from 'lit/decorators.js';

// Every card's getConfigForm() returns a computeLabel alongside its schema -
// this just wraps a plain name->label map into the function shape HA expects,
// falling back to the raw field name for anything unmapped (e.g. device_id,
// which HA already labels sensibly on its own).
export function computeLabelFactory(labels: Record<string, string>) {
  return (schema: { name: string }) => labels[schema.name] || schema.name;
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
