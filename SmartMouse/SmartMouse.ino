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
#include <ESPmDNS.h>
#include <NetBIOS.h>
#include <ArduinoOTA.h>
#include <ETH.h>
#include "index_html.h"
#include "wifi_config_html.h"
#include "test_sequence.h"

USBHIDKeyboardUTF8 keyboard;
USBHIDMouse mouse;
USBHIDConsumerControl media;
USBHIDTouchpad touchpad;

// PC Power GPIOs
#define PIN_POWER_SW   7
#define PIN_POWER_STAT 8
// Pin 48 is the addressable WS2812 RGB LED (fixed onboard trace on most
// ESP32-S3 dev boards, not a free choice like the pins above).
#define RGB_LED_PIN 48

// Optional W5500 Ethernet module (SPI). Only used if a module actually
// responds during the boot-time probe - safe to leave unwired on WiFi-only
// devices. See PROTOCOL.md / README for wiring notes.
#define PIN_ETH_RST  1
#define PIN_ETH_MISO 2
#define PIN_ETH_SCK  4
#define PIN_ETH_CS   5
#define PIN_ETH_INT  6
#define PIN_ETH_MOSI 12

// --- COMPILE-TIME DEFAULTS ---
const bool  ENABLE_TEST_MODE = false; // Set to true to run the test sequence on startup
const bool  DEFAULT_PC_POWER_ENABLED = false; // Default capability before first setup
const char* DEFAULT_SECRET   = "CHANGE_ME_SECRET";

Preferences preferences;
bool isAPMode = false;
bool usingEthernet = false;
volatile bool ethGotIP = false;
DNSServer dnsServer;

void onEthGotIP(arduino_event_id_t event) {
  ethGotIP = true;
}

// Power Management
unsigned long lastActivityTime = 0;
bool isPowerSaving = false;
const unsigned long SLEEP_TIMEOUT = 1 * 60 * 1000; // 1 minute

// Telemetry Timing
unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL = 1000;  // 1 second (allows correct sleep LED duty cycle detection)

// Thermal Management
bool thermalThrottled = false;
const float TEMP_LIMIT_HIGH = 80.0; // Celsius - Start throttling
const float TEMP_LIMIT_LOW  = 60.0; // Celsius - Resume high performance

// Security
const char* secret_key = DEFAULT_SECRET;
#define MAX_WS_CLIENTS 16
bool client_authenticated[MAX_WS_CLIENTS] = {false};   // Track authentication per-client
bool pcPowerEnabled = false;               // Capability flag

WebSocketsServer wsServer(81);
WebServer server(80);

// PC Power State Tracking
volatile uint32_t pulseHighTime = 0;
volatile uint32_t pulseTotalTime = 0;
volatile uint32_t lastRise = 0;
volatile uint32_t lastFall = 0;
float lastDutyCycle = 0; 

void IRAM_ATTR powerStatISR() {
  uint32_t now = micros();
  if (digitalRead(PIN_POWER_STAT) == LOW) { // Optocoupler pulls to GND when PC LED is ON
    pulseTotalTime = now - lastRise;
    lastRise = now;
  } else {
    pulseHighTime = now - lastRise;
    lastFall = now;
  }
}

uint8_t getPowerState() {
  // 0: Off, 1: On, 2: Energy Saving
  if (lastDutyCycle < 5.0) return 0;
  if (lastDutyCycle > 95.0) return 1;
  return 2;
}

void pulsePowerSwitch(int durationMs) {
  digitalWrite(PIN_POWER_SW, HIGH);
  delay(durationMs);
  digitalWrite(PIN_POWER_SW, LOW);
}

void measureDutyCycle() {
  // Briefly disable interrupts to safely read volatile variables
  noInterrupts();
  uint32_t snapshotHigh = pulseHighTime;
  uint32_t snapshotTotal = pulseTotalTime;
  uint32_t snapRise = lastRise;
  uint32_t snapFall = lastFall;
  interrupts();

  uint32_t now = micros();

  // Handle static DC signals (no edges detected for > 500ms)
  if ((now - snapRise > 500000) && (now - snapFall > 500000)) {
    lastDutyCycle = (digitalRead(PIN_POWER_STAT) == LOW) ? 100.0 : 0.0;
  } else if (snapshotTotal > 0) {
    lastDutyCycle = (float)snapshotHigh / (float)snapshotTotal * 100.0;
  }
}

// Initialize the NeoPixel object: 1 pixel on pin 48
Adafruit_NeoPixel statusLED(1, RGB_LED_PIN, NEO_GRB + NEO_KHZ800);

void wakeUp() {
  if (thermalThrottled) {
    Serial.println("Wakeup blocked: Device is too hot!");
    return;
  }
  
  if (!isPowerSaving) return;
  setCpuFrequencyMhz(240);
  if (!isAPMode && !usingEthernet) WiFi.setSleep(false);
  isPowerSaving = false;
  Serial.println("System: Waking up to High Performance mode.");
}

void enterPowerSaving() {
  if (isPowerSaving) return;
  if (!isAPMode && !usingEthernet) WiFi.setSleep(true);   // Enable modem sleep to save radio power
  setCpuFrequencyMhz(80); // Drop clock speed to reduce thermal output
  isPowerSaving = true;
  Serial.println("System: Entering Power Saving (Inactivity).");
}

// NEW: Function to handle HTTP requests for the web page
void handleRoot() {
  wakeUp();
  String html = String(INDEX_HTML);
  html.replace("%PCPWR_ENABLED%", pcPowerEnabled ? "true" : "false");
  html.replace("%AUTH_TOKEN%", secret_key);
  server.send(200, "text/html", html);
}

void handleWifiConfig() {
  String html = String(WIFI_CONFIG_HTML);
  if (pcPowerEnabled) {
    html.replace("%PCPWR_CHECKED%", "checked");
  } else {
    html.replace("%PCPWR_CHECKED%", "");
  }
  server.send(200, "text/html", html);
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
  String nPCPower = server.arg("pcpwr"); // "on" or empty
  
  if (nSSID.length() > 0) {
    preferences.begin("wifi", false);
    preferences.putString("ssid", nSSID);
    preferences.putString("pass", nPass);
    preferences.putBool("pc_pwr", nPCPower == "on");
    preferences.end();
    server.send(200, "text/plain", "Credentials saved. Rebooting...");
    delay(2000);
    ESP.restart();
  } else {
    server.send(400, "text/plain", "SSID required");
  }
}

// ---------------------------------------
// 0x01-0x05 → MOUSE
// ---------------------------------------
void handleMouseCmd(uint8_t cmd, uint8_t* payload) {
  switch (cmd) {
    case 0x01: { // Relative move: opcode | int16 dx | int16 dy
      int16_t dx = payload[1] | (payload[2] << 8);
      int16_t dy = payload[3] | (payload[4] << 8);
      mouse.move(dx, dy);
      break;
    }
    case 0x02: { // Absolute move: opcode | int16 x | int16 y
      int16_t x = payload[1] | (payload[2] << 8);
      int16_t y = payload[3] | (payload[4] << 8);
      mouse.moveTo(x, y);
      break;
    }
    case 0x03:
      mouse.press(payload[1]);
      break;
    case 0x04:
      mouse.release(payload[1]);
      break;
    case 0x05:
      mouse.click(payload[1]);
      break;
  }
}

// ---------------------------------------
// 0x11-0x13, 0x31 → KEYBOARD
// ---------------------------------------
void handleKeyboardCmd(uint8_t cmd, uint8_t* payload) {
  switch (cmd) {
    case 0x11: // Key down: opcode | uint8 keycode
      keyboard.pressRaw(payload[1]);
      break;
    case 0x12: // Key up: opcode | uint8 keycode
      keyboard.releaseRaw(payload[1]);
      break;
    case 0x13: // Key send: opcode | uint8 keycode
      keyboard.pressRaw(payload[1]);
      keyboard.releaseRaw(payload[1]);
      break;
    case 0x31: // Text send: opcode | raw utf8 text...
      keyboard.write((const char*)&payload[1]);
      break;
  }
}

// ---------------------------------------
// 0x21-0x23 → MEDIA KEYS
// ---------------------------------------
void handleMediaCmd(uint8_t cmd, uint8_t* payload) {
  switch (cmd) {
    case 0x21: { // Down: opcode | uint16 consumer_code
      uint16_t code = payload[1] | (payload[2] << 8);
      media.press(code);
      break;
    }
    case 0x22: // Up
      media.release();
      break;
    case 0x23: { // Send: opcode | uint16 consumer_code
      uint16_t code = payload[1] | (payload[2] << 8);
      media.press(code);
      media.release();
      break;
    }
  }
}

// ---------------------------------------
// 0x41-0x44, 0x4F → TOUCHPAD / SCROLL
// ---------------------------------------
void handleTouchpadCmd(uint8_t cmd, uint8_t* payload) {
  switch (cmd) {
    case 0x41: { // Low-res scroll: opcode | int8 steps
      int8_t steps = payload[1];
      mouse.move(0, 0, steps);
      break;
    }
    case 0x42: { // High-res scroll: opcode | int16 dx | int16 dy
      int16_t dx = payload[1] | (payload[2] << 8);
      int16_t dy = payload[3] | (payload[4] << 8);
      touchpad.scroll(dx, dy);
      break;
    }
    case 0x43: { // High-res zoom: opcode | int16 steps
      int16_t steps = payload[1] | (payload[2] << 8);
      touchpad.zoom(steps);
      break;
    }
    case 0x44: { // 5-finger gesture: opcode | mask (1) | [x (2) | y (2)] * 5
      USBHIDTouchpad::FingerData fingers[5];
      uint8_t mask = payload[1];
      for (int i = 0; i < 5; i++) {
        fingers[i].active = (mask >> i) & 0x01;
        uint8_t base = 2 + (i * 4);
        fingers[i].x = payload[base] | (payload[base + 1] << 8);
        fingers[i].y = payload[base + 2] | (payload[base + 3] << 8);
      }
      touchpad.updateFingers(fingers);
      break;
    }
    case 0x4F: // Lift fingers (end of gesture)
      touchpad.liftFingers();
      break;
  }
}

// ---------------------------------------
// 0xA0 → PC POWER CONTROL
// ---------------------------------------
void handlePCPowerCmd(uint8_t* payload) {
  if (!pcPowerEnabled) return;
  uint8_t pcCmd = payload[1];
  if (pcCmd == 0x01) { // Toggle
    pulsePowerSwitch(200); // Standard single press
  }
  else if (pcCmd == 0x02) { // Hard Off
    pulsePowerSwitch(3500);
  }
  else if (pcCmd == 0x03) { // Power On
    measureDutyCycle();
    if (lastDutyCycle < 95.0) {
      pulsePowerSwitch(100);
    }
  }
  else if (pcCmd == 0x04) { // Power Off
    measureDutyCycle();
    if (lastDutyCycle > 95.0) {
      pulsePowerSwitch(100);
      delay(1000);
      measureDutyCycle();
      if (lastDutyCycle > 95.0) {
        pulsePowerSwitch(100);
      }
    }
  }
}

void onWebSocketEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length) {
  if (type == WStype_BIN || type == WStype_TEXT) {
    wakeUp();
  }

  if (type == WStype_DISCONNECTED) {
    if (num < MAX_WS_CLIENTS) client_authenticated[num] = false;
    return;
  }

  if (type == WStype_CONNECTED) {
    // Auto-authenticate if in AP mode (secured by WiFi password)
    if (isAPMode) {
      if (num < MAX_WS_CLIENTS) client_authenticated[num] = true;
    }
    return;
  }

  if (length < 1 || type != WStype_BIN) return;

  uint8_t cmd = payload[0];

  // Only update activity time for actual HID input commands (0x01 to 0x4F)
  if (cmd >= 0x01 && cmd <= 0x4F) {
    lastActivityTime = millis();
  }

  // Handle Authentication (Opcode 0xFF)
  if (cmd == 0xFF) {
    if (strcmp((const char*)&payload[1], secret_key) == 0) {
      if (num < MAX_WS_CLIENTS) client_authenticated[num] = true;
      Serial.printf("Client %u Authenticated.\n", num);
    } else {
      wsServer.disconnect(num);
    }
    return;
  }

  if (num >= MAX_WS_CLIENTS || !client_authenticated[num]) return;

  switch (cmd) {
    case 0x01: case 0x02: case 0x03: case 0x04: case 0x05:
      handleMouseCmd(cmd, payload);
      break;

    case 0x11: case 0x12: case 0x13: case 0x31:
      handleKeyboardCmd(cmd, payload);
      break;

    case 0x21: case 0x22: case 0x23:
      handleMediaCmd(cmd, payload);
      break;

    case 0x41: case 0x42: case 0x43: case 0x44: case 0x4F:
      handleTouchpadCmd(cmd, payload);
      break;

    case 0xA0: // PC POWER CONTROL
      handlePCPowerCmd(payload);
      break;

    case 0xFE: // Reboot ESP32-S3
      Serial.println("System: Reset command received. Rebooting...");
      delay(500); // Give time for Serial to print
      ESP.restart();
      break;

    default: {
      if (Serial.availableForWrite() > 32) {
        Serial.printf("Unknown command: 0x%02X\n", cmd);
      }
      break;
    }
  }
}

void setup() {
  Serial.begin(115200);
  setCpuFrequencyMhz(240); // Maximize processing speed

  preferences.begin("wifi", true);
  pcPowerEnabled = preferences.getBool("pc_pwr", DEFAULT_PC_POWER_ENABLED);
  preferences.end();

  // Setup Power Pins
  if (pcPowerEnabled) {
    pinMode(PIN_POWER_SW, OUTPUT);
    digitalWrite(PIN_POWER_SW, LOW);
    pinMode(PIN_POWER_STAT, INPUT_PULLUP); // Optocoupler connects to GND, so pull UP by default
    attachInterrupt(digitalPinToInterrupt(PIN_POWER_STAT), powerStatISR, CHANGE);
  }

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

  // Ethernet Probe (W5500 over SPI). If no module is wired up, this fails
  // fast and we fall through to WiFi below - safe to leave unwired.
  WiFi.onEvent(onEthGotIP, ARDUINO_EVENT_ETH_GOT_IP);
  // Signature matches arduino-esp32's official W5500 example; verify against
  // your installed core's ETH.h if this fails to compile.
  ETH.begin(ETH_PHY_W5500, 1, PIN_ETH_CS, PIN_ETH_INT, PIN_ETH_RST, SPI3_HOST, PIN_ETH_SCK, PIN_ETH_MISO, PIN_ETH_MOSI);
  ETH.setHostname("smartmouse");

  Serial.print("Probing for Ethernet (W5500)");
  unsigned long ethStartTime = millis();
  while (!ethGotIP && millis() - ethStartTime < 5000) {
    delay(200);
    Serial.print(".");
  }
  usingEthernet = ethGotIP;

  if (usingEthernet) {
    Serial.println("\nEthernet Connected!");
    Serial.print("IP Address: ");
    Serial.println(ETH.localIP());
  } else {
    // WiFi Connection with AP Fallback
    preferences.begin("wifi", false);
    String storedSSID = preferences.getString("ssid", "");
    String storedPass = preferences.getString("pass", "");
    preferences.end();

    WiFi.mode(WIFI_STA); // Force Station mode to ensure DHCP hostname registers correctly
    WiFi.setHostname("smartmouse");
    WiFi.begin(storedSSID.c_str(), storedPass.c_str());
    Serial.print("Connecting to WiFi");

    unsigned long startAttemptTime = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 10000) {
      delay(500);
      Serial.print(".");
    }

    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("\nWiFi Failed. Starting Access Point: SmartMouse-Setup");
      WiFi.mode(WIFI_AP);
      WiFi.softAP("SmartMouse-Setup", "SmartMouse123"); // Set your AP password here
      isAPMode = true;
      dnsServer.start(53, "*", WiFi.softAPIP()); // Redirect all DNS to local IP
      Serial.print("AP IP Address: ");
      Serial.println(WiFi.softAPIP());
    } else {
      Serial.println("\nWiFi Connected!");
      Serial.print("IP Address: ");
      Serial.println(WiFi.localIP());
      Serial.print("Configuration Portal: http://");
      Serial.print(WiFi.localIP()); Serial.println("/wifi");
      WiFi.setSleep(false); // CRITICAL: Prevents WiFi latency spikes
    }
  }

  // Initialize Name Resolvers AFTER getting an IP address, over whichever
  // interface (WiFi or Ethernet) came up - skipped in AP mode.
  if (!isAPMode) {
    if (MDNS.begin("smartmouse")) {
      MDNS.setInstanceName("smartmouse");
      Serial.println("MDNS responder started: smartmouse.local");
      MDNS.addService("http", "tcp", 80);
      MDNS.addServiceTxt("http", "tcp", "board", "ESP32-S3");
      MDNS.addService("ws", "tcp", 81);
      MDNS.addServiceTxt("ws", "tcp", "type", "hid");
    } else {
      Serial.println("Error setting up MDNS responder!");
    }
    NBNS.begin("smartmouse"); // Add NetBIOS for fallback legacy support
  }

  lastTelemetryTime = millis();
  lastActivityTime = millis();

  // Setup OTA
  ArduinoOTA.setHostname("smartmouse");
  ArduinoOTA.setPassword(secret_key); // Require the SmartMouse secret key for OTA updates
  ArduinoOTA.onStart([]() { Serial.println("OTA Update Started"); });
  ArduinoOTA.onEnd([]() { Serial.println("\nOTA Update Finished"); });
  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    Serial.printf("OTA Progress: %u%%\r", (progress / (total / 100)));
  });
  ArduinoOTA.onError([](ota_error_t error) { Serial.printf("OTA Error[%u]\n", error); });
  ArduinoOTA.begin();

  // Initialize Web Server
  server.on("/", HTTP_GET, handleRoot); // Handle the root path to serve the HTML
  server.on("/wifi", HTTP_GET, handleWifiConfig);
  server.on("/save", HTTP_POST, handleSaveConfig);
  server.on("/scan", HTTP_GET, handleScan);
  server.onNotFound(handleCaptive); // Capture portal redirect
  server.begin(); // Start the HTTP server on port 80

  // WebSocket setup - already exists
  wsServer.onEvent(onWebSocketEvent);
  wsServer.begin();

  if (ENABLE_TEST_MODE)
  {
    runTestSequence(keyboard, mouse, media, touchpad);
  }
}

void loop() {
  server.handleClient();
  if (isAPMode) dnsServer.processNextRequest();
  wsServer.loop();
  ArduinoOTA.handle();

  // Periodic Telemetry and Thermal Check (Every 10 seconds)
  if (millis() - lastTelemetryTime > TELEMETRY_INTERVAL) {
    lastTelemetryTime = millis();
    
    if (pcPowerEnabled) measureDutyCycle();
    float currentTemp = temperatureRead();
    int8_t rssi = (int8_t)WiFi.RSSI();
    uint8_t currentPowerState = pcPowerEnabled ? getPowerState() : 1;

    // Thermal Logic
    if (!thermalThrottled && currentTemp > TEMP_LIMIT_HIGH) {
      thermalThrottled = true;
      Serial.printf("CRITICAL: Temperature %.2fC exceeded limit! Throttling...\n", currentTemp);
      enterPowerSaving();
    } else if (thermalThrottled && currentTemp < TEMP_LIMIT_LOW) {
      thermalThrottled = false;
      Serial.printf("INFO: Temperature %.2fC normalized. Thermal lock released.\n", currentTemp);
    }

    // PC Power State Logic for Power Saving
    if (pcPowerEnabled && (currentPowerState == 0 || currentPowerState == 2)) {
      enterPowerSaving();
    }

    // Send Telemetry to Home Assistant (Opcode 0xF0 | float temp | int8 rssi)
    bool anyAuth = false;
    for (int i = 0; i < MAX_WS_CLIENTS; i++) {
      if (client_authenticated[i]) { anyAuth = true; break; }
    }
    
    if (anyAuth) {
      uint8_t telePacket[9];
      telePacket[0] = 0xF0;
      memcpy(&telePacket[1], &currentTemp, 4);
      telePacket[5] = (uint8_t)rssi;
      telePacket[6] = isPowerSaving ? 1 : 0;
      telePacket[7] = currentPowerState;
      telePacket[8] = (pcPowerEnabled ? 0x01 : 0x00) | (usingEthernet ? 0x02 : 0x00); // Capabilities Bitmask
      
      for (int i = 0; i < MAX_WS_CLIENTS; i++) {
        if (client_authenticated[i]) {
          wsServer.sendBIN(i, telePacket, 9);
        }
      }
    }
  }

  // Check for inactivity timeout
  if (!isPowerSaving && (millis() - lastActivityTime > SLEEP_TIMEOUT)) {
    enterPowerSaving();
  }

  delay(0);
}