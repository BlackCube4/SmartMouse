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
#include "wifi_config_html.h"
#include "test_sequence.h"

USBHIDKeyboardUTF8 keyboard;
USBHIDMouse mouse;
USBHIDConsumerControl media;
USBHIDTouchpad touchpad;

const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const bool  test     = true;

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

  if (test)
  {
    runTestSequence(keyboard, mouse, media, touchpad);
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