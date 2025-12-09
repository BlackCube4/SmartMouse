#include "USBHIDMouse.h"

// Combined Mouse Descriptor (Relative + Absolute)
static const uint8_t mouse_descriptor[] = {
  // ===== RELATIVE MOUSE (Report ID 2) - 16-bit =====
  0x05, 0x01,                    // Usage Page (Generic Desktop)
  0x09, 0x02,                    // Usage (Mouse)
  0xa1, 0x01,                    // Collection (Application)
  0x09, 0x01,                    //   Usage (Pointer)
  0xa1, 0x00,                    //   Collection (Physical)
  0x85, REPORTID_MOUSE_RELATIVE, //     Report ID (2)
  0x05, 0x09,                    //     Usage Page (Button)
  0x19, 0x01,                    //     Usage Minimum (Button 1)
  0x29, 0x05,                    //     Usage Maximum (Button 5)
  0x15, 0x00,                    //     Logical Minimum (0)
  0x25, 0x01,                    //     Logical Maximum (1)
  0x95, 0x05,                    //     Report Count (5)
  0x75, 0x01,                    //     Report Size (1)
  0x81, 0x02,                    //     Input (Data,Var,Abs)
  0x95, 0x01,                    //     Report Count (1)
  0x75, 0x03,                    //     Report Size (3)
  0x81, 0x03,                    //     Input (Const)
  0x05, 0x01,                    //     Usage Page (Generic Desktop)
  0x09, 0x30,                    //     Usage (X)
  0x09, 0x31,                    //     Usage (Y)
  0x16, 0x01, 0x80,              //     Logical Minimum (-32767)
  0x26, 0xff, 0x7f,              //     Logical Maximum (32767)
  0x75, 0x10,                    //     Report Size (16)
  0x95, 0x02,                    //     Report Count (2)
  0x81, 0x06,                    //     Input (Data,Var,Rel)
  0x09, 0x38,                    //     Usage (Wheel)
  0x15, 0x81,                    //     Logical Minimum (-127)
  0x25, 0x7f,                    //     Logical Maximum (127)
  0x75, 0x08,                    //     Report Size (8)
  0x95, 0x01,                    //     Report Count (1)
  0x81, 0x06,                    //     Input (Data,Var,Rel)
  0x05, 0x0c,                    //     Usage Page (Consumer)
  0x0a, 0x38, 0x02,              //     Usage (AC Pan)
  0x15, 0x81,                    //     Logical Minimum (-127)
  0x25, 0x7f,                    //     Logical Maximum (127)
  0x95, 0x01,                    //     Report Count (1)
  0x81, 0x06,                    //     Input (Data,Var,Rel)
  0xc0,                          //   End Collection (Physical)
  0xc0,                          // End Collection (Application)

  // ===== ABSOLUTE MOUSE (Report ID 3) =====
  0x05, 0x01,                    // Usage Page (Generic Desktop)
  0x09, 0x02,                    // Usage (Mouse)
  0xa1, 0x01,                    // Collection (Application)
  0x09, 0x01,                    //   Usage (Pointer)
  0xa1, 0x00,                    //   Collection (Physical)
  0x85, REPORTID_MOUSE_ABSOLUTE, //     Report ID (3)
  0x05, 0x09,                    //     Usage Page (Button)
  0x19, 0x01,                    //     Usage Minimum (Button 1)
  0x29, 0x05,                    //     Usage Maximum (Button 5)
  0x15, 0x00,                    //     Logical Minimum (0)
  0x25, 0x01,                    //     Logical Maximum (1)
  0x95, 0x05,                    //     Report Count (5)
  0x75, 0x01,                    //     Report Size (1)
  0x81, 0x02,                    //     Input (Data,Var,Abs)
  0x95, 0x01,                    //     Report Count (1)
  0x75, 0x03,                    //     Report Size (3)
  0x81, 0x03,                    //     Input (Const)
  0x05, 0x01,                    //     Usage Page (Generic Desktop)
  0x09, 0x30,                    //     Usage (X)
  0x09, 0x31,                    //     Usage (Y)
  0x16, 0x00, 0x00,              //     Logical Minimum (0)
  0x26, 0xff, 0x7f,              //     Logical Maximum (32767)
  0x36, 0x00, 0x00,              //     Physical Minimum (0)
  0x46, 0xff, 0x7f,              //     Physical Maximum (32767)
  0x75, 0x10,                    //     Report Size (16)
  0x95, 0x02,                    //     Report Count (2)
  0x81, 0x02,                    //     Input (Data,Var,Abs)
  0xc0,                          //   End Collection (Physical)
  0xc0,                          // End Collection (Application)
};

USBHIDMouse::USBHIDMouse() : hid(), _buttons(0) {
  static bool initialized = false;
  if (!initialized) {
    initialized = true;
    hid.addDevice(this, sizeof(mouse_descriptor));
  }
}

uint16_t USBHIDMouse::_onGetDescriptor(uint8_t *dst) {
  memcpy(dst, mouse_descriptor, sizeof(mouse_descriptor));
  return sizeof(mouse_descriptor);
}

void USBHIDMouse::begin() {
  hid.begin();
}

void USBHIDMouse::end() {}

// Relative Movement (Standard)
void USBHIDMouse::move(int16_t x, int16_t y, int8_t wheel, int8_t pan) {
  uint8_t report[7];
  report[0] = _buttons;
  report[1] = x & 0xFF;
  report[2] = (x >> 8) & 0xFF;
  report[3] = y & 0xFF;
  report[4] = (y >> 8) & 0xFF;
  report[5] = wheel;
  report[6] = pan;
  hid.SendReport(REPORTID_MOUSE_RELATIVE, report, sizeof(report));
}

// Absolute Movement (Positioning only)
void USBHIDMouse::moveTo(int16_t x, int16_t y) {
  uint8_t report[5];
  report[0] = 0;
  report[1] = x & 0xFF;
  report[2] = (x >> 8) & 0xFF;
  report[3] = y & 0xFF;
  report[4] = (y >> 8) & 0xFF;

  hid.SendReport(REPORTID_MOUSE_ABSOLUTE, report, sizeof(report));
}

void USBHIDMouse::click(uint8_t b) {
  _buttons = b;
  move(0, 0);
  _buttons = 0;
  move(0, 0);
}

void USBHIDMouse::press(uint8_t b) {
  _buttons |= b;
  move(0, 0);
}

void USBHIDMouse::release(uint8_t b) {
  _buttons &= ~b;
  move(0, 0);
}

void USBHIDMouse::releaseAll() {
  _buttons = 0;
  move(0, 0);
}