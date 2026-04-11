#include <WiFi.h>
#include <WebSocketsServer.h>
#include <USB.h>
#include <USBHIDConsumerControl.h>
#include "USBHIDKeyboardUTF8.h"
#include "USBHIDMouse.h"
#include "USBHIDTouchpad.h"
#include <WebServer.h>
#include <Adafruit_NeoPixel.h>
#include <Preferences.h>
#include <DNSServer.h>
#include "index_html.h"

USBHIDKeyboardUTF8 keyboard;
USBHIDMouse mouse;
USBHIDConsumerControl media;
USBHIDTouchpad touchpad;

const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const bool  test     = false;

Preferences preferences;
bool isAPMode = false;
DNSServer dnsServer;
IPAddress last_web_ip; // Stores the IP of the last client to load the web interface

// Power Management
unsigned long lastActivityTime = 0;
bool isPowerSaving = false;
const unsigned long SLEEP_TIMEOUT = 20 * 60 * 1000; // 20 minutes

// Telemetry Timing
unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL = 10000; // 10 seconds

// Thermal Management
bool thermalThrottled = false;
const float TEMP_LIMIT_HIGH = 80.0; // Celsius - Start throttling
const float TEMP_LIMIT_LOW  = 60.0; // Celsius - Resume high performance

// Security
const char* secret_key = "CHANGE_ME_SECRET"; // Set this to match your HA config
bool client_authenticated = false;         // Simple flag to gatekeep HID commands

WebSocketsServer wsServer(81);
WebServer server(80);

// Pin 48 is the addressable WS2812 RGB LED.
#define RGB_LED_PIN 48

// Update the HTML with a scanner and better CSS
const char* WIFI_CONFIG_HTML = R"rawliteral(
<!DOCTYPE html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1">
<title>KeyMouse WiFi Config</title>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { font-family: sans-serif; background: #121212; color: #eee; text-align: center; padding: 20px; margin: 0; overscroll-behavior: none; }
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
    <button type="submit">Save & Restart</button>
  </form>
  <a href="http://192.168.4.1" target="_blank" style="font-weight:bold; font-size: 1em;">Open Controller</a>
</div>
<div class="tip">
  <b>Important:</b> To use the Gyro/Mouse, do not use this "Log In" window. <br><br>
  Tap the ⋮ menu and select <b>"Use network as is"</b> or <b>"Open in Chrome"</b>, 
  then go to: <code style="background:#000; padding:2px 4px;">http://192.168.4.1</code>
</div>
<script>
function scan() {
  fetch('/scan').then(r => r.json()).then(data => {
    let s = document.getElementById('s'); s.innerHTML = '';
    data.forEach(n => { let o = document.createElement('option'); o.value = n; o.text = n; s.appendChild(o); });
  });
}
</script></body></html>)rawliteral";

// Initialize the NeoPixel object: 1 pixel on pin 48
Adafruit_NeoPixel statusLED(1, RGB_LED_PIN, NEO_GRB + NEO_KHZ800);

void wakeUp() {
  if (thermalThrottled) {
    Serial.println("Wakeup blocked: Device is too hot!");
    return;
  }
  
  if (!isPowerSaving) return;
  setCpuFrequencyMhz(240);
  if (!isAPMode) WiFi.setSleep(false);
  isPowerSaving = false;
  Serial.println("System: Waking up to High Performance mode.");
}

void enterPowerSaving() {
  if (isPowerSaving) return;
  if (!isAPMode) WiFi.setSleep(true);   // Enable modem sleep to save radio power
  setCpuFrequencyMhz(80); // Drop clock speed to reduce thermal output
  isPowerSaving = true;
  Serial.println("System: Entering Power Saving (Inactivity).");
}

// NEW: Function to handle HTTP requests for the web page
void handleRoot() {
  wakeUp();
  lastActivityTime = millis();
  last_web_ip = server.client().remoteIP(); // Trust this IP for WebSocket commands
  server.send(200, "text/html", INDEX_HTML);
}

void handleWifiConfig() {
  server.send(200, "text/html", WIFI_CONFIG_HTML);
}

void handleScan() {
  int n = WiFi.scanNetworks();
  String json = "[";
  for (int i = 0; i < n; ++i) {
    json += "\"" + WiFi.SSID(i) + "\"";
    if (i < n - 1) json += ",";
  }
  json += "]";
  server.send(200, "application/json", json);
}

void handleCaptive() {
  server.sendHeader("Location", "/wifi", true);
  server.send(302, "text/plain", "");
}

void handleSaveConfig() {
  String nSSID = server.arg("ssid");
  String nPass = server.arg("pass");
  
  if (nSSID.length() > 0) {
    preferences.begin("wifi", false);
    preferences.putString("ssid", nSSID);
    preferences.putString("pass", nPass);
    preferences.end();
    server.send(200, "text/plain", "Credentials saved. Rebooting...");
    delay(2000);
    ESP.restart();
  } else {
    server.send(400, "text/plain", "SSID required");
  }
}

void onWebSocketEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length) {
  if (type == WStype_BIN || type == WStype_TEXT) {
    wakeUp();
    lastActivityTime = millis();
  }

  if (type == WStype_DISCONNECTED) {
    client_authenticated = false;
    lastActivityTime = millis(); // Reset timer on disconnect
    return;
  }

  if (length < 1 || type != WStype_BIN) return;

  uint8_t cmd = payload[0];

  // Handle Authentication (Opcode 0xFF)
  if (cmd == 0xFF) {
    if (strcmp((const char*)&payload[1], secret_key) == 0) {
      client_authenticated = true;
      Serial.println("Client Authenticated.");
    } else {
      wsServer.disconnect(num);
    }
    return;
  }

  // Ignore everything else until auth is done
  // BYPASS: If in AP mode (protected by AP password) or if client matches the web requester's IP
  if (isAPMode || wsServer.remoteIP(num) == last_web_ip) {
    client_authenticated = true;
  }

  if (!client_authenticated) return;

  switch (cmd) {
    // ---------------------------------------
    // 0x01 → RELATIVE MOUSE MOVE (16-bit)
    // 0x01 | int16 dx | int16 dy
    // ---------------------------------------
    case 0x01: {
      int16_t dx = payload[1] | (payload[2] << 8);
      int16_t dy = payload[3] | (payload[4] << 8);
      mouse.move(dx, dy);
      break;
    }

    // ---------------------------------------
    // 0x02 → ABSOLUTE MOUSE MOVE
    // 0x02 | int16 x | int16 y
    // ---------------------------------------
    case 0x02: {
      int16_t x = payload[1] | (payload[2] << 8);
      int16_t y = payload[3] | (payload[4] << 8);
      mouse.moveTo(x, y);
      break;
    }

    // ---------------------------------------
    // KEYBOARD
    // 0x11 → key down
    // 0x12 → key up
    // 0x13 → key send
    // payload: opcode | uint16 keycode (HID usage code)
    // ---------------------------------------
    case 0x11: {
      uint8_t key = payload[1];  // HID codes are 8-bit
      keyboard.pressRaw(key);
      break;
    }
    case 0x12: {
      uint8_t key = payload[1];  // HID codes are 8-bit
      keyboard.releaseRaw(key);
      break;
    }
    case 0x13: {
      uint8_t key = payload[1];  // HID codes are 8-bit
      keyboard.pressRaw(key);
      keyboard.releaseRaw(key);
      break;
    }

    // ---------------------------------------
    // MOUSE BUTTON
    // 0x21 → mouse down
    // 0x22 → mouse up
    // 0x23 → mouse click
    // payload: opcode | uint8 button
    // ---------------------------------------
    case 0x21:
      mouse.press(payload[1]);
      break;

    case 0x22:
      mouse.release(payload[1]);
      break;

    case 0x23:
      mouse.click(payload[1]);
      break;

    // ---------------------------------------
    // MEDIA KEYS
    // 0x31 → down
    // 0x32 → up
    // 0x33 → send
    // payload: opcode | uint16 consumer_code
    // ---------------------------------------
    case 0x31: {
      uint16_t code = payload[1] | (payload[2] << 8);
      media.press(code);
      break;
    }
    case 0x32: {
      media.release();
      break;
    }
    case 0x33: {
      uint16_t code = payload[1] | (payload[2] << 8);
      media.press(code);
      media.release();
      break;
    }

    // ---------------------------------------
    // TEXT SEND (string)
    // 0x41 | raw utf8 text…
    // ---------------------------------------
    case 0x41: {
      keyboard.write((const char*)&payload[1]);
      break;
    }

    // ---------------------------------------
    // SCROLLING
    // 0x51 → low res scroll (int16 steps)
    // 0x52 → high res scroll (int16 steps)
    // 0x52 → high res scroll end ()
    // payload: opcode | int16 value
    // ---------------------------------------
    case 0x51: {
      int16_t steps = payload[1] | (payload[2] << 8);
      mouse.move(0, 0, steps);
      break;
    }
    case 0x52: {
      int16_t steps = payload[1] | (payload[2] << 8);
      touchpad.scroll(0, steps);
      break;
    }
    case 0x53: {
      touchpad.scrollEnd();
      break;
    }
    case 0xFE: {
      Serial.println("System: Reset command received. Rebooting...");
      delay(500); // Give time for Serial to print
      ESP.restart();
      break;
    }
    default: {
      // if (Serial.availableForWrite() > 32) {
      //   Serial.printf("Unknown command: 0x%02X\n", cmd);
      // }
      break;
    }
  }
}

void setup() {
  Serial.begin(115200);
  setCpuFrequencyMhz(240); // Maximize processing speed

  // Properly turn off the addressable RGB LED
  statusLED.begin();
  statusLED.setPixelColor(0, statusLED.Color(0, 0, 0)); // Set color to Black/Off
  statusLED.show();

  // USB/HID Setup - already exists
  USB.begin();
  keyboard.begin(KeyboardLayout_de_DE);
  mouse.begin();
  media.begin();
  touchpad.begin();

  // WiFi Connection with AP Fallback
  preferences.begin("wifi", false);
  String storedSSID = preferences.getString("ssid", ssid);
  String storedPass = preferences.getString("pass", password);
  preferences.end();

  WiFi.begin(storedSSID.c_str(), storedPass.c_str());
  Serial.print("Connecting to WiFi");
  
  unsigned long startAttemptTime = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 10000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\nWiFi Failed. Starting Access Point: KeyMouse-Setup");
    WiFi.mode(WIFI_AP);
    WiFi.softAP("KeyMouse-Setup", "KeyMouse123"); // Set your AP password here
    isAPMode = true;
    dnsServer.start(53, "*", WiFi.softAPIP()); // Redirect all DNS to local IP
    Serial.print("AP IP Address: ");
    Serial.println(WiFi.softAPIP());
  } else {
    Serial.println("\nWiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    WiFi.setSleep(false); // CRITICAL: Prevents WiFi latency spikes
  }

  lastTelemetryTime = millis();
  lastActivityTime = millis();

  // NEW: Initialize Web Server
  server.on("/", HTTP_GET, handleRoot); // Handle the root path to serve the HTML
  server.on("/wifi", HTTP_GET, handleWifiConfig);
  server.on("/save", HTTP_POST, handleSaveConfig);
  server.on("/scan", HTTP_GET, handleScan);
  server.onNotFound(handleCaptive); // Capture portal redirect
  server.begin(); // Start the HTTP server on port 80

  // WebSocket setup - already exists
  wsServer.onEvent(onWebSocketEvent);
  wsServer.begin();

  if (test)
  {
    delay(3000);
    Serial.println("\n=== TESTING ALL FUNCTIONS ===\n");
    delay(2000);
    
    // ---------------------------------------
    // TEST 1: Absolute Mouse Movement
    // ---------------------------------------
    Serial.println("TEST 1: Absolute Mouse - Jump to corners");
    Serial.println("  Top-left");
    mouse.moveTo(1, 1);
    delay(1000);
    
    Serial.println("  Bottom-right");
    mouse.moveTo(32700, 32700);
    delay(1000);
    
    Serial.println("  Center");
    mouse.moveTo(16383, 16383);
    delay(2000);

    // ---------------------------------------
    // TEST 2: Relative Mouse Movement (16-bit)
    // ---------------------------------------
    Serial.println("TEST 2: Relative Mouse - Moving in circle");
    for (int i = 0; i < 36; i++) {
      float angle = i * 10.0 * 0.0174533;
      int16_t dx = cos(angle) * 50;
      int16_t dy = sin(angle) * 50;
      mouse.move(dx, dy);
      delay(20);
    }
    delay(1000);
    
    // ---------------------------------------
    // TEST 3: Mouse Scrolling
    // ---------------------------------------
    Serial.println("TEST 3: Mouse - Scroll down");
    for (int i = 0; i < 5; i++) {
      mouse.move(0, 0, -2);  // Scroll down
      delay(100);
    }
    delay(500);
    
    Serial.println("TEST 7b: Mouse - Scroll up");
    for (int i = 0; i < 5; i++) {
      mouse.move(0, 0, 2);  // Scroll up
      delay(100);
    }
    delay(1000);
    
    // ---------------------------------------
    // TEST 4: Touchpad Two-Finger Scroll
    // ---------------------------------------
    Serial.println("TEST 4: Touchpad - Two-finger scroll down");
    for (int i = 0; i < 30; i++) {
      touchpad.scroll(0, 25);
      delay(8);
    }
    touchpad.scrollEnd(); 
    delay(2000);
    
    Serial.println("TEST 4b: Touchpad - Two-finger scroll up");
    for (int i = 0; i < 30; i++) {
      touchpad.scroll(0, -25);
      delay(8);
    }
    touchpad.scrollEnd(); 
    delay(2000);
    
    // ---------------------------------------
    // TEST 5: Keyboard - Type text
    // ---------------------------------------
    Serial.println("TEST 5: Keyboard - Type 'Hello'");
    keyboard.write("ABCxyz123äöü,.-+#!?$%&/(){}[]=ß<>*:;|");
    delay(1000);

    // ---------------------------------------
    // TEST 6: Media Keys (Volume)
    // ---------------------------------------
    Serial.println("TEST 6b: Media Keys - Volume Down");
    media.press(0xEA);  // Volume Down
    delay(100);
    media.release();
    delay(2000);
    
    Serial.println("TEST 6: Media Keys - Volume Up");
    media.press(0xE9);  // Volume Up
    delay(100);
    media.release();
    delay(1000);
    
    Serial.println("\n=== ALL TESTS COMPLETE ===\n");
    delay(5000);
  }
}

void loop() {
  server.handleClient();
  if (isAPMode) dnsServer.processNextRequest();
  wsServer.loop();

  // Periodic Telemetry and Thermal Check (Every 10 seconds)
  if (millis() - lastTelemetryTime > TELEMETRY_INTERVAL) {
    lastTelemetryTime = millis();
    
    float currentTemp = temperatureRead();
    int8_t rssi = (int8_t)WiFi.RSSI();

    // Thermal Logic
    if (!thermalThrottled && currentTemp > TEMP_LIMIT_HIGH) {
      thermalThrottled = true;
      Serial.printf("CRITICAL: Temperature %.2fC exceeded limit! Throttling...\n", currentTemp);
      enterPowerSaving();
    } else if (thermalThrottled && currentTemp < TEMP_LIMIT_LOW) {
      thermalThrottled = false;
      Serial.printf("INFO: Temperature %.2fC normalized. Thermal lock released.\n", currentTemp);
    }

    // Send Telemetry to Home Assistant (Opcode 0xF0 | float temp | int8 rssi)
    if (client_authenticated) {
      uint8_t telePacket[7];
      telePacket[0] = 0xF0;
      memcpy(&telePacket[1], &currentTemp, 4);
      telePacket[5] = (uint8_t)rssi;
      telePacket[6] = isPowerSaving ? 1 : 0;
      wsServer.broadcastBIN(telePacket, 7);
    }
  }

  // Check for inactivity timeout
  if (!isPowerSaving && (millis() - lastActivityTime > SLEEP_TIMEOUT)) {
    enterPowerSaving();
  }

  delay(0);
}