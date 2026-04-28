import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('container-card')
export class ContainerCard extends LitElement {
  @property({ attribute: false }) public hass!: any;
  @state() private _config!: any;
  @state() private _cardElement?: any;

  public async setConfig(config: any): Promise<void> {
    this._config = config;
    await this._createCard();
  }

  private async _createCard() {
    if (!this._config?.card?.type) {
        this._cardElement = undefined;
        return;
    }
    const helpers = await (window as any).loadCardHelpers();
    if (helpers) {
      this._cardElement = helpers.createCardElement(this._config.card);
      this._cardElement.hass = this.hass;
    }
  }

  protected updated(changedProps: Map<string, any>) {
    super.updated(changedProps);
    if (changedProps.has('hass') && this._cardElement) {
      this._cardElement.hass = this.hass;
    }
  }

  public static getConfigElement() {
    return document.createElement('container-card-editor');
  }

  public static getStubConfig() {
    return { 
      type: "custom:container-card", 
      padding: "16px",
      card: {} 
    };
  }

  protected render(): TemplateResult {
    if (!this._config) return html``;

    const padding = this._config.padding !== undefined ? this._config.padding : "16px";

    return html`
      <ha-card>
        <div class="card-content" style="padding: ${padding};">
          ${this._cardElement 
            ? this._cardElement 
            : html`<div style="color: var(--error-color, #e74c3c);">No valid card type selected. Please configure a sub-card.</div>`
          }
        </div>
      </ha-card>
    `;
  }

  static styles = css`
    .card-content {
      display: flex;
      flex-direction: column;
    }
  `;
}

@customElement('container-card-editor')
export class ContainerCardEditor extends LitElement {
  @property({ attribute: false }) public hass!: any;
  @property({ attribute: false }) public lovelace?: any;
  @state() private _config!: any;

  public setConfig(config: any) {
    this._config = config;
  }

  private _paddingChanged(ev: any) {
    if (!this._config || !this.hass) return;
    const value = ev.target.value;
    if (this._config.padding === value) return;
    
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: { ...this._config, padding: value } },
      bubbles: true,
      composed: true
    }));
  }

  private _handleCardPicked(ev: any) {
    ev.stopPropagation();
    if (!this._config) return;
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: { ...this._config, card: ev.detail.config } },
      bubbles: true,
      composed: true
    }));
  }

  private _clearCard() {
    if (!this._config) return;
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: { ...this._config, card: {} } },
      bubbles: true,
      composed: true
    }));
  }

  private _cardConfigChanged(ev: any) {
    ev.stopPropagation();
    if (!this._config || !this.hass) return;
    
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: { ...this._config, card: ev.detail.config } },
      bubbles: true,
      composed: true
    }));
  }

  protected render(): TemplateResult {
    if (!this._config) return html``;

    return html`
      <div class="card-config">
        <div class="option">
          <label>Padding (e.g. 16px)</label>
          <input 
            type="text" 
            .value=${this._config.padding !== undefined ? this._config.padding : '16px'}
            @input=${this._paddingChanged}
          >
        </div>
        
        ${!this._config.card?.type ? html`
          <div class="option">
            <label>Select Sub-Card</label>
            <hui-card-picker
              .hass=${this.hass}
              .lovelace=${this.lovelace}
              @config-changed=${this._handleCardPicked}
            ></hui-card-picker>
          </div>
        ` : html`
          <div class="option">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label>Card Configuration</label>
              <button class="change-btn" @click=${this._clearCard}>Change Card</button>
            </div>
            <hui-card-element-editor
              .hass=${this.hass}
              .lovelace=${this.lovelace}
              .value=${this._config.card}
              @config-changed=${this._cardConfigChanged}
            ></hui-card-element-editor>
          </div>
        `}
      </div>
    `;
  }

  static styles = css`
    .card-config { display: flex; flex-direction: column; gap: 12px; }
    .option { display: flex; flex-direction: column; gap: 4px; }
    label { font-size: 14px; font-weight: 500; color: var(--primary-text-color, #fff); margin: 0; }
    input { padding: 8px; border-radius: 4px; background: var(--card-background-color, #2a2b2e); color: var(--primary-text-color, #fff); border: 1px solid var(--divider-color, #3a3b3d); outline: none; }
    .change-btn { background: var(--primary-color, #03a9f4); color: var(--text-primary-color, #fff); border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px; font-weight: 500; }
  `;
}

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "container-card",
  name: "Container",
  description: "A general purpose styled visual background wrapper for Home Assistant cards.",
  preview: true
});