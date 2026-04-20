#ifndef WIFI_CONFIG_HTML_H
#define WIFI_CONFIG_HTML_H

const char* WIFI_CONFIG_HTML = R"rawliteral(
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>KeyMouse WiFi Config</title>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html { background: #121212; min-height: 100vh; }
  body { font-family: sans-serif; background: #121212; color: #eee; text-align: center; padding: 20px; margin: 0; overscroll-behavior: none; min-height: 100vh; }
  .card { background: #1e1f22; border: 1px solid #2b2c2f; padding: 20px; border-radius: 14px; display: block; width: calc(100% - 40px); max-width: 320px; text-align: left; margin: 20px auto; }
  input, select { width: 100%; padding: 12px; margin: 10px 0; border-radius: 8px; border: 1px solid #333; background: #2a2b2e; color: #fff; font-size: 16px; }
  button { width: 100%; padding: 12px; border-radius: 8px; border: none; background: #4a4; color: #fff; font-weight: bold; cursor: pointer; margin-top: 10px; }
  a { color: #4a9eff; text-decoration: none; font-size: 0.9em; display: block; text-align: center; margin-top: 15px; }
  .tip { font-size: 0.8em; color: #888; margin-top: 20px; line-height: 1.4; padding: 0 10px; }
</style></head><body onload="scan()">
<div class="card">
  <h2 style="text-align:center">WiFi Setup</h2>
  <form action="/save" method="POST">
    <label>Available Networks:</label>
    <select id="s" onchange="document.getElementById('ssid').value=this.value"><option>Scanning...</option></select>
    <label>SSID:</label><input id="ssid" name="ssid" type="text" required placeholder="Network Name">
    <label>Password:</label><input name="pass" type="password" placeholder="Password">
    <div style="display:flex; align-items:center; gap:10px; margin:10px 0;">
      <input type="checkbox" name="pcpwr" id="pcpwr" style="width:auto; margin:0;" %PCPWR_CHECKED%> <label for="pcpwr">Enable PC Power Control</label>
    </div>
    <button type="submit">Save & Restart</button>
  </form>
  <a href="/" target="_blank" style="font-weight:bold; font-size: 1em;">Open Controller</a>
</div>
<div class="tip">
  <b>Important:</b> To use the Gyro/Mouse, do not use this "Log In" window. <br><br>
  Tap the ⋮ menu and select <b>"Use network as is"</b> or <b>"Open in Chrome"</b>, 
  then go to: <code id="ip-display" style="background:#000; padding:2px 4px;">http://192.168.4.1</code>
</div>
<script>
document.getElementById('ip-display').innerText = 'http://' + window.location.hostname + '/';
function scan() {
  fetch('/scan').then(r => r.json()).then(data => {
    let s = document.getElementById('s'); s.innerHTML = '';
    data.forEach(n => { let o = document.createElement('option'); o.value = n; o.text = n; s.appendChild(o); });
    if (data.length > 0) {
      document.getElementById('ssid').value = data[0];
    }
  });
}
</script></body></html>)rawliteral";

#endif