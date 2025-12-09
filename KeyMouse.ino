#include <WiFi.h>
#include <WebSocketsServer.h>
#include <USB.h>
#include <USBHIDConsumerControl.h>
#include "USBHIDKeyboardUTF8.h"
#include "USBHIDMouse.h"
#include "USBHIDTouchpad.h"
#include <WebServer.h>
#include <index_html.h>

USBHIDKeyboardUTF8 keyboard;
USBHIDMouse mouse;
USBHIDConsumerControl media;
USBHIDTouchpad touchpad;

const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const bool  test     = false;

WebSocketsServer wsServer(81);
WebServer server(80);

// NEW: Function to handle HTTP requests for the web page
void handleRoot() {
  server.send(200, "text/html", INDEX_HTML);
}

void onWebSocketEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length) {
  if (length < 1) return;

  uint8_t cmd = payload[0];

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
    default: {
      Serial.printf("Unknown command: ", cmd);
      break;
    }
  }
}

void setup() {
  Serial.begin(115200);

  // USB/HID Setup - already exists
  USB.begin();
  keyboard.begin(KeyboardLayout_de_DE);
  mouse.begin();
  media.begin();
  touchpad.begin();

  // WiFi Connection - already exists
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi..");
  }

  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // NEW: Initialize Web Server
  server.on("/", HTTP_GET, handleRoot); // Handle the root path to serve the HTML
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
  wsServer.loop();
  delay(0);
}