#ifndef INDEX_HTML_H
#define INDEX_HTML_H

// The control-page logic lives in the shared TS bundle (smartmouse_bundle.h,
// served at /smartmouse.js). This file is just the shell: CSS, skeleton, theme
// toggle, and the server-injected config. Do not re-embed page logic here.
const char* INDEX_HTML = R"rawliteral(
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <title>SmartMouse Controller</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <meta charset="UTF-8">

  <style>
    /* Theme Variables */
    :root[data-theme="dark"] {
      --bg-color: #121212;
      --card-bg: #1e1f22;
      --border-color: #2b2c2f;
      --text-color: #ffffff;
      --text-muted: #aaaaaa;
      --btn-dark: #2b2c2f;
      --btn-light: #3a3b3f;
      --trackpad-bg: #2a2b2e;
      --primary: #666666;
      --error: #e74c3c;
      --success: #2ecc71;
      --divider: #3a3b3d;
      --box-shadow: 0px 4px 10px rgba(0,0,0,0.5);
    }

    :root[data-theme="light"] {
      --bg-color: #e9ecef;
      --card-bg: #ffffff;
      --border-color: transparent;
      --text-color: #212529;
      --text-muted: #6c757d;
      --btn-dark: #ffffff;
      --btn-light: #f0f0f0;
      --trackpad-bg: #f8f9fa;
      --primary: #0d6efd;
      --error: #dc3545;
      --success: #198754;
      --divider: transparent;
      --box-shadow: 0px 4px 10px rgba(0,0,0,0.1);
    }

    body {
      font-family: 'Inter', system-ui, sans-serif;
      text-align: center;
      margin: 0;
      padding: 10px;
      background-color: var(--bg-color);
      color: var(--text-color);
      transition: background-color 0.3s, color 0.3s;
      user-select: none;
      -webkit-user-select: none;
      height: 100vh;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      overflow: hidden;
    }

    #header-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding: 0 5px;
    }

    #status-header h1 {
      font-size: 18px;
      margin: 0;
      display: flex;
      align-items: center;
    }
    /* The name + connection dot doubles as a restart button (wired in JS). */
    #status-header:active {
      opacity: 0.7;
    }

    #setup-link {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 14px;
      margin-right: 15px;
      font-weight: 500;
    }

    .status-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-left: 8px;
      transition: background-color 0.3s;
    }
    .status-dot.connected { background-color: #4a4; }
    .status-dot.disconnected { background-color: #a44; }
    .status-dot.connecting { background-color: #aa4; }

    #theme-toggle {
      background: var(--btn-dark);
      color: var(--text-color);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      padding: 5px 12px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }
    #theme-toggle:active {
      background: var(--btn-light);
    }

    #pc-power-btn {
      background: var(--error);
      color: #fff;
      border: none;
      border-radius: 20px;
      padding: 5px 12px;
      font-size: 14px;
      cursor: pointer;
      transition: opacity 0.2s;
      margin-right: 15px;
      font-weight: bold;
    }
    #pc-power-btn:active {
      opacity: 0.8;
    }

    #root {
      width: 100%;
      box-sizing: border-box;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
  </style>
</head>
<body>
  <div id="header-container">
    <div id="status-header">
      <h1>SmartMouse <span id="ws-status-dot" class="status-dot disconnected"></span></h1>
    </div>
    <div style="display: flex; align-items: center;">
      <button id="pc-power-btn" style="display: none;">PC Power</button>
      <a href="/wifi" id="setup-link">Setup</a>
      <button id="theme-toggle">☀️/🌙</button>
    </div>
  </div>

  <div id="root">
    <h1>Loading HID Controller...</h1>
  </div>

<script>
  // Injected server-side by handleRoot() (SmartMouse.ino). Read by the bundle.
  window.SMARTMOUSE_CONFIG = { authToken: "%AUTH_TOKEN%", pcPowerEnabled: %PCPWR_ENABLED% };

  // Theme management (kept inline so the shell themes before the bundle loads).
  const themeToggle = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('smartmouse_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeToggle.addEventListener('click', () => {
      const root = document.documentElement;
      const isDark = root.getAttribute('data-theme') === 'dark';
      const newTheme = isDark ? 'light' : 'dark';
      root.setAttribute('data-theme', newTheme);
      localStorage.setItem('smartmouse_theme', newTheme);
  });
</script>
<script src="/smartmouse.js"></script>
</body>
</html>
)rawliteral";

#endif
