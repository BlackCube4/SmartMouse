#pragma once

#include <USBHID.h>

// Report IDs for mouse in unified descriptor
#define REPORTID_MOUSE_RELATIVE 2
#define REPORTID_MOUSE_ABSOLUTE 3

// Mouse button definitions
#define MOUSE_LEFT     0x01
#define MOUSE_RIGHT    0x02
#define MOUSE_MIDDLE   0x04
#define MOUSE_BACKWARD 0x08
#define MOUSE_FORWARD  0x10

class USBHIDMouse : public USBHIDDevice {
private:
  USBHID hid;
  uint8_t _buttons;

public:
  USBHIDMouse();
  void begin();
  void end();
  
  // Relative Movement (Standard Mouse)
  void move(int16_t x, int16_t y, int8_t wheel = 0, int8_t pan = 0);
  
  // Absolute Movement (Screen Coordinates 0-32767)
  void moveTo(int16_t x, int16_t y);
  
  // Button Control (Sent via Relative Report)
  void click(uint8_t b = MOUSE_LEFT);
  void press(uint8_t b = MOUSE_LEFT);
  void release(uint8_t b = MOUSE_LEFT);
  void releaseAll();
  
  // USBHIDDevice override
  uint16_t _onGetDescriptor(uint8_t *dst);
};