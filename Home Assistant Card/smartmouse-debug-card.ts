import { GyroHandler, GyroDebugInfo } from './gyro-handler';
import { SmartMouseCardBase } from './base-card';
import { html, css } from 'lit';
import { state } from 'lit/decorators.js';

type Level = 'good' | 'fair' | 'poor' | 'waiting';

// Read-only diagnostics card: shows the phone's gyro data, its measured refresh
// rate and angular resolution, plus a plain-language verdict. It monitors the
// browser's orientation sensor passively (never moves the cursor).
class SmartMouseDebugCard extends SmartMouseCardBase {
  @state() private info?: GyroDebugInfo;
  private monitor?: GyroHandler;
  private pollTimer?: number;

  // No options: this card monitors the phone's own sensor, so it isn't tied to
  // a device. An empty schema keeps the visual editor clean.
  static getConfigForm() {
    return { schema: [] };
  }
  static getStubConfig() { return { type: 'custom:smartmouse-debug-card' }; }

  protected firstUpdated() {
    // debug:true makes GyroHandler start listening immediately; we never toggle
    // relative/absolute, so it never sends any movement.
    this.monitor = new GyroHandler(this.serviceManager, { ...this._config, debug: true });
    this.monitor.startMonitoring();
    this.pollTimer = window.setInterval(() => {
      this.info = this.monitor?.getDebugInfo();
    }, 150);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.monitor?.destroy();
  }

  private freqLevel(hz: number): Level {
    if (hz <= 0) return 'waiting';
    if (hz >= 60) return 'good';
    if (hz >= 30) return 'fair';
    return 'poor';
  }

  private resLevel(deg: number): Level {
    if (deg <= 0) return 'waiting';
    if (deg <= 0.1) return 'good';
    if (deg <= 0.5) return 'fair';
    return 'poor';
  }

  private resolutionText(info: GyroDebugInfo): string {
    if (info.resolution <= 0) return '—';
    if (info.resolution < 0.001) return '<0.001° (continuous)';
    return `${info.resolution.toFixed(3)}°`;
  }

  private verdict(info: GyroDebugInfo): { level: Level; text: string } {
    if (!info.listening || info.frequency <= 0) {
      return { level: 'waiting', text: 'Waiting for sensor data — move the device. (Some browsers need motion-sensor permission.)' };
    }
    const f = this.freqLevel(info.frequency);
    const r = this.resLevel(info.resolution);
    const order: Level[] = ['poor', 'fair', 'good'];
    const overall = order[Math.min(order.indexOf(f), order.indexOf(r))] as Level;
    const label = overall === 'good' ? 'Good' : overall === 'fair' ? 'Usable' : 'Poor';
    const fWord = f === 'good' ? 'smooth' : f === 'fair' ? 'okay' : 'low';
    const rWord = r === 'good' ? 'fine' : r === 'fair' ? 'okay' : 'coarse';
    return { level: overall, text: `${label} — refresh rate ${fWord}, resolution ${rWord}.` };
  }

  protected render() {
    const info = this.info;
    const v = info ? this.verdict(info) : { level: 'waiting' as Level, text: 'Starting…' };
    const fmt = (n: number, d = 2) => (info ? n.toFixed(d) : '—');
    return html`
      <div class="title">Gyro Debug</div>
      <table>
        <tr><td>Source</td><td>${info?.source ?? '—'}</td></tr>
        <tr><td>Refresh rate</td><td class=${info ? this.freqLevel(info.frequency) : ''}>${info ? fmt(info.frequency, 1) : '—'} Hz</td></tr>
        <tr><td>Resolution</td><td class=${info ? this.resLevel(info.resolution) : ''}>${info ? this.resolutionText(info) : '—'}</td></tr>
        <tr><td>Yaw (X)</td><td>${info ? fmt(info.orientation.x) : '—'}°</td></tr>
        <tr><td>Pitch (Y)</td><td>${info ? fmt(info.orientation.y) : '—'}°</td></tr>
        <tr><td>Roll (Z)</td><td>${info ? fmt(info.orientation.z) : '—'}°</td></tr>
      </table>
      <div class="verdict ${v.level}">${v.text}</div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      padding: 12px 14px;
      background: var(--ha-card-background, var(--card-background-color, #1e1f22));
      border-radius: var(--ha-card-border-radius, 12px);
      border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--divider-color, #2b2c2f));
      color: var(--primary-text-color, #fff);
    }
    .title { font-weight: 600; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    td { padding: 4px 0; }
    td:first-child { color: var(--secondary-text-color, #aaa); }
    td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
    .verdict {
      margin-top: 10px; padding: 8px 10px; border-radius: 8px; font-size: 13px;
      background: rgba(127, 127, 127, 0.12);
    }
    .good { color: var(--success-color, #2ecc71); }
    .fair { color: var(--warning-color, #f1c40f); }
    .poor { color: var(--error-color, #e74c3c); }
    .waiting { color: var(--secondary-text-color, #aaa); }
    .verdict.good { background: color-mix(in srgb, var(--success-color, #2ecc71) 12%, transparent); }
    .verdict.fair { background: color-mix(in srgb, var(--warning-color, #f1c40f) 14%, transparent); }
    .verdict.poor { background: color-mix(in srgb, var(--error-color, #e74c3c) 12%, transparent); }
  `;

  getCardSize() { return 3; }
}

customElements.define('smartmouse-debug-card', SmartMouseDebugCard);

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'smartmouse-debug-card',
  name: 'SmartMouse Debug',
  description: 'Live gyro data, refresh rate, resolution and a quality verdict.',
  preview: true,
});
