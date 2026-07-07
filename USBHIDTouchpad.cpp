#include "USBHIDTouchpad.h"
#include <Arduino.h> 

// Exact Descriptor from UnifiedHID.cpp
static const uint8_t touchpad_report_descriptor[] = {
  // ===== PRECISION TOUCHPAD (Report ID 5, 7, 8) =====
  // TLC 1: Touch Pad
  0x05, 0x0d,                         // USAGE_PAGE (Digitizers)
  0x09, 0x05,                         // USAGE (Touch Pad)
  0xa1, 0x01,                         // COLLECTION (Application)
  0x85, REPORTID_TOUCHPAD,            //   REPORT_ID (5)
  
  // Finger 1
  0x09, 0x22,                         //   USAGE (Finger)
  0xa1, 0x02,                         //   COLLECTION (Logical)
  0x15, 0x00,                         //     LOGICAL_MINIMUM (0)
  0x25, 0x01,                         //     LOGICAL_MAXIMUM (1)
  0x09, 0x42,                         //     USAGE (Tip Switch)
  0x09, 0x47,                         //     USAGE (Confidence)
  0x95, 0x02,                         //     REPORT_COUNT (2)
  0x75, 0x01,                         //     REPORT_SIZE (1)
  0x81, 0x02,                         //     INPUT (Data,Var,Abs)
  0x95, 0x01,                         //     REPORT_COUNT (1)
  0x75, 0x03,                         //     REPORT_SIZE (3)
  0x25, 0x05,                         //     LOGICAL_MAXIMUM (5)
  0x09, 0x51,                         //     USAGE (Contact Identifier)
  0x81, 0x02,                         //     INPUT (Data,Var,Abs)
  0x75, 0x01,                         //     REPORT_SIZE (1)
  0x95, 0x03,                         //     REPORT_COUNT (3)
  0x81, 0x03,                         //     INPUT (Cnst,Var,Abs)
  0x05, 0x01,                         //     USAGE_PAGE (Generic Desktop)
  0x15, 0x00,                         //     LOGICAL_MINIMUM (0)
  0x26, 0xff, 0x0f,                   //     LOGICAL_MAXIMUM (4095)
  0x75, 0x10,                         //     REPORT_SIZE (16)
  0x95, 0x01,                         //     REPORT_COUNT (1)
  0x55, 0x0e,                         //     UNIT_EXPONENT (-2)
  0x65, 0x11,                         //     UNIT (SI Linear: cm)
  0x09, 0x30,                         //     USAGE (X)
  0x35, 0x00,                         //     PHYSICAL_MINIMUM (0)
  0x46, 0x14, 0x29,                   //     PHYSICAL_MAXIMUM (10500)
  0x81, 0x02,                         //     INPUT (Data,Var,Abs)
  0x46, 0x64, 0x19,                   //     PHYSICAL_MAXIMUM (6500)
  0x09, 0x31,                         //     USAGE (Y)
  0x81, 0x02,                         //     INPUT (Data,Var,Abs)
  0xc0,                               //   END_COLLECTION (Finger 1)
  
  // Finger 2
  0x05, 0x0d,                         //   USAGE_PAGE (Digitizers)
  0x09, 0x22,                         //   USAGE (Finger)
  0xa1, 0x02,                         //   COLLECTION (Logical)
  0x15, 0x00,                         //     LOGICAL_MINIMUM (0)
  0x25, 0x01,                         //     LOGICAL_MAXIMUM (1)
  0x09, 0x42,                         //     USAGE (Tip Switch)
  0x09, 0x47,                         //     USAGE (Confidence)
  0x95, 0x02,                         //     REPORT_COUNT (2)
  0x75, 0x01,                         //     REPORT_SIZE (1)
  0x81, 0x02,                         //     INPUT (Data,Var,Abs)
  0x95, 0x01,                         //     REPORT_COUNT (1)
  0x75, 0x03,                         //     REPORT_SIZE (3)
  0x25, 0x05,                         //     LOGICAL_MAXIMUM (5)
  0x09, 0x51,                         //     USAGE (Contact Identifier)
  0x81, 0x02,                         //     INPUT (Data,Var,Abs)
  0x75, 0x01,                         //     REPORT_SIZE (1)
  0x95, 0x03,                         //     REPORT_COUNT (3)
  0x81, 0x03,                         //     INPUT (Cnst,Var,Abs)
  0x05, 0x01,                         //     USAGE_PAGE (Generic Desktop)
  0x15, 0x00,                         //     LOGICAL_MINIMUM (0)
  0x26, 0xff, 0x0f,                   //     LOGICAL_MAXIMUM (4095)
  0x75, 0x10,                         //     REPORT_SIZE (16)
  0x95, 0x01,                         //     REPORT_COUNT (1)
  0x55, 0x0e,                         //     UNIT_EXPONENT (-2)
  0x65, 0x11,                         //     UNIT (SI Linear: cm)
  0x09, 0x30,                         //     USAGE (X)
  0x35, 0x00,                         //     PHYSICAL_MINIMUM (0)
  0x46, 0x14, 0x29,                   //     PHYSICAL_MAXIMUM (10500)
  0x81, 0x02,                         //     INPUT (Data,Var,Abs)
  0x46, 0x64, 0x19,                   //     PHYSICAL_MAXIMUM (6500)
  0x09, 0x31,                         //     USAGE (Y)
  0x81, 0x02,                         //     INPUT (Data,Var,Abs)
  0xc0,                               //   END_COLLECTION (Finger 2)

  // Finger 3
  0x05, 0x0d,                         //   USAGE_PAGE (Digitizers)
  0x09, 0x22,                         //   USAGE (Finger)
  0xa1, 0x02,                         //   COLLECTION (Logical)
  0x15, 0x00,                         //     LOGICAL_MINIMUM (0)
  0x25, 0x01,                         //     LOGICAL_MAXIMUM (1)
  0x09, 0x42,                         //     USAGE (Tip Switch)
  0x09, 0x47,                         //     USAGE (Confidence)
  0x95, 0x02,                         //     REPORT_COUNT (2)
  0x75, 0x01,                         //     REPORT_SIZE (1)
  0x81, 0x02,                         //     INPUT (Data,Var,Abs)
  0x95, 0x01,                         //     REPORT_COUNT (1)
  0x75, 0x03,                         //     REPORT_SIZE (3)
  0x25, 0x05,                         //     LOGICAL_MAXIMUM (5)
  0x09, 0x51,                         //     USAGE (Contact Identifier)
  0x81, 0x02,                         //     INPUT (Data,Var,Abs)
  0x75, 0x01,                         //     REPORT_SIZE (1)
  0x95, 0x03,                         //     REPORT_COUNT (3)
  0x81, 0x03,                         //     INPUT (Cnst,Var,Abs)
  0x05, 0x01,                         //     USAGE_PAGE (Generic Desktop)
  0x15, 0x00,                         //     LOGICAL_MINIMUM (0)
  0x26, 0xff, 0x0f,                   //     LOGICAL_MAXIMUM (4095)
  0x75, 0x10,                         //     REPORT_SIZE (16)
  0x95, 0x01,                         //     REPORT_COUNT (1)
  0x55, 0x0e,                         //     UNIT_EXPONENT (-2)
  0x65, 0x11,                         //     UNIT (SI Linear: cm)
  0x09, 0x30,                         //     USAGE (X)
  0x35, 0x00,                         //     PHYSICAL_MINIMUM (0)
  0x46, 0x14, 0x29,                   //     PHYSICAL_MAXIMUM (10500)
  0x81, 0x02,                         //     INPUT (Data,Var,Abs)
  0x46, 0x64, 0x19,                   //     PHYSICAL_MAXIMUM (6500)
  0x09, 0x31,                         //     USAGE (Y)
  0x81, 0x02,                         //     INPUT (Data,Var,Abs)
  0xc0,                               //   END_COLLECTION (Finger 3)

  // Finger 4
  0x05, 0x0d,                         //   USAGE_PAGE (Digitizers)
  0x09, 0x22,                         //   USAGE (Finger)
  0xa1, 0x02,                         //   COLLECTION (Logical)
  0x15, 0x00,                         //     LOGICAL_MINIMUM (0)
  0x25, 0x01,                         //     LOGICAL_MAXIMUM (1)
  0x09, 0x42,                         //     USAGE (Tip Switch)
  0x09, 0x47,                         //     USAGE (Confidence)
  0x95, 0x02,                         //     REPORT_COUNT (2)
  0x75, 0x01,                         //     REPORT_SIZE (1)
  0x81, 0x02,                         //     INPUT (Data,Var,Abs)
  0x95, 0x01,                         //     REPORT_COUNT (1)
  0x75, 0x03,                         //     REPORT_SIZE (3)
  0x25, 0x05,                         //     LOGICAL_MAXIMUM (5)
  0x09, 0x51,                         //     USAGE (Contact Identifier)
  0x81, 0x02,                         //     INPUT (Data,Var,Abs)
  0x75, 0x01,                         //     REPORT_SIZE (1)
  0x95, 0x03,                         //     REPORT_COUNT (3)
  0x81, 0x03,                         //     INPUT (Cnst,Var,Abs)
  0x05, 0x01,                         //     USAGE_PAGE (Generic Desktop)
  0x15, 0x00,                         //     LOGICAL_MINIMUM (0)
  0x26, 0xff, 0x0f,                   //     LOGICAL_MAXIMUM (4095)
  0x75, 0x10,                         //     REPORT_SIZE (16)
  0x95, 0x01,                         //     REPORT_COUNT (1)
  0x55, 0x0e,                         //     UNIT_EXPONENT (-2)
  0x65, 0x11,                         //     UNIT (SI Linear: cm)
  0x09, 0x30,                         //     USAGE (X)
  0x35, 0x00,                         //     PHYSICAL_MINIMUM (0)
  0x46, 0x14, 0x29,                   //     PHYSICAL_MAXIMUM (10500)
  0x81, 0x02,                         //     INPUT (Data,Var,Abs)
  0x46, 0x64, 0x19,                   //     PHYSICAL_MAXIMUM (6500)
  0x09, 0x31,                         //     USAGE (Y)
  0x81, 0x02,                         //     INPUT (Data,Var,Abs)
  0xc0,                               //   END_COLLECTION (Finger 4)

  // Finger 5
  0x05, 0x0d,                         //   USAGE_PAGE (Digitizers)
  0x09, 0x22,                         //   USAGE (Finger)
  0xa1, 0x02,                         //   COLLECTION (Logical)
  0x15, 0x00,                         //     LOGICAL_MINIMUM (0)
  0x25, 0x01,                         //     LOGICAL_MAXIMUM (1)
  0x09, 0x42,                         //     USAGE (Tip Switch)
  0x09, 0x47,                         //     USAGE (Confidence)
  0x95, 0x02,                         //     REPORT_COUNT (2)
  0x75, 0x01,                         //     REPORT_SIZE (1)
  0x81, 0x02,                         //     INPUT (Data,Var,Abs)
  0x95, 0x01,                         //     REPORT_COUNT (1)
  0x75, 0x03,                         //     REPORT_SIZE (3)
  0x25, 0x05,                         //     LOGICAL_MAXIMUM (5)
  0x09, 0x51,                         //     USAGE (Contact Identifier)
  0x81, 0x02,                         //     INPUT (Data,Var,Abs)
  0x75, 0x01,                         //     REPORT_SIZE (1)
  0x95, 0x03,                         //     REPORT_COUNT (3)
  0x81, 0x03,                         //     INPUT (Cnst,Var,Abs)
  0x05, 0x01,                         //     USAGE_PAGE (Generic Desktop)
  0x15, 0x00,                         //     LOGICAL_MINIMUM (0)
  0x26, 0xff, 0x0f,                   //     LOGICAL_MAXIMUM (4095)
  0x75, 0x10,                         //     REPORT_SIZE (16)
  0x95, 0x01,                         //     REPORT_COUNT (1)
  0x55, 0x0e,                         //     UNIT_EXPONENT (-2)
  0x65, 0x11,                         //     UNIT (SI Linear: cm)
  0x09, 0x30,                         //     USAGE (X)
  0x35, 0x00,                         //     PHYSICAL_MINIMUM (0)
  0x46, 0x14, 0x29,                   //     PHYSICAL_MAXIMUM (10500)
  0x81, 0x02,                         //     INPUT (Data,Var,Abs)
  0x46, 0x64, 0x19,                   //     PHYSICAL_MAXIMUM (6500)
  0x09, 0x31,                         //     USAGE (Y)
  0x81, 0x02,                         //     INPUT (Data,Var,Abs)
  0xc0,                               //   END_COLLECTION (Finger 5)
  
  // Scan Time
  0x05, 0x0d,                         //   USAGE_PAGE (Digitizers)
  0x55, 0x0C,                         //   UNIT_EXPONENT (-4)
  0x66, 0x01, 0x10,                   //   UNIT (Seconds)
  0x47, 0xff, 0xff, 0x00, 0x00,       //   PHYSICAL_MAXIMUM (65535)
  0x27, 0xff, 0xff, 0x00, 0x00,       //   LOGICAL_MAXIMUM (65535)
  0x75, 0x10,                         //   REPORT_SIZE (16)
  0x95, 0x01,                         //   REPORT_COUNT (1)
  0x09, 0x56,                         //   USAGE (Scan Time)
  0x81, 0x02,                         //   INPUT (Data,Var,Abs)
  
  // Contact Count
  0x09, 0x54,                         //   USAGE (Contact count)
  0x25, 0x7f,                         //   LOGICAL_MAXIMUM (127)
  0x75, 0x08,                         //   REPORT_SIZE (8)
  0x95, 0x01,                         //   REPORT_COUNT (1)
  0x81, 0x02,                         //   INPUT (Data,Var,Abs)
  
  // Buttons (Not strictly necessary for scroll, but kept for compatibility)
  0x05, 0x09,                         //   USAGE_PAGE (Button)
  0x09, 0x01,                         //   USAGE (Button 1)
  0x09, 0x02,                         //   USAGE (Button 2)
  0x09, 0x03,                         //   USAGE (Button 3)
  0x25, 0x01,                         //   LOGICAL_MAXIMUM (1)
  0x75, 0x01,                         //   REPORT_SIZE (1)
  0x95, 0x03,                         //   REPORT_COUNT (3)
  0x81, 0x02,                         //   INPUT (Data,Var,Abs)
  0x95, 0x05,                         //   REPORT_COUNT (5)
  0x81, 0x03,                         //   INPUT (Cnst,Var,Abs)
  
  // Feature Reports
  0x05, 0x0d,                         //   USAGE_PAGE (Digitizer)
  0x85, REPORTID_TOUCHPAD_MAX_COUNT,  //   REPORT_ID (7)
  0x09, 0x55,                         //   USAGE (Contact Count Maximum)
  0x09, 0x59,                         //   USAGE (Pad Type)
  0x75, 0x04,                         //   REPORT_SIZE (4)
  0x95, 0x02,                         //   REPORT_COUNT (2)
  0x25, 0x0f,                         //   LOGICAL_MAXIMUM (15)
  0xb1, 0x02,                         //   FEATURE (Data,Var,Abs)
  
  // Certification Blob
  0x06, 0x00, 0xff,                   //   USAGE_PAGE (Vendor Defined)
  0x85, REPORTID_TOUCHPAD_PTPHQA,     //   REPORT_ID (8)
  0x09, 0xC5,                         //   USAGE (Vendor Usage 0xC5)
  0x15, 0x00,                         //   LOGICAL_MINIMUM (0)
  0x26, 0xff, 0x00,                   //   LOGICAL_MAXIMUM (0xff)
  0x75, 0x08,                         //   REPORT_SIZE (8)
  0x96, 0x00, 0x01,                   //   REPORT_COUNT (256)
  0xb1, 0x02,                         //   FEATURE (Data,Var,Abs)
  0xc0,                               // END_COLLECTION (TLC 1)
  
  // ===== CONFIG TLC (Report ID 6, 9) =====
  // TLC 2: Configuration
  0x05, 0x0d,                         // USAGE_PAGE (Digitizer)
  0x09, 0x0E,                         // USAGE (Configuration)
  0xa1, 0x01,                         // COLLECTION (Application)
  0x85, REPORTID_TOUCHPAD_FEATURE,    //   REPORT_ID (6)
  0x09, 0x22,                         //   USAGE (Finger)
  0xa1, 0x02,                         //   COLLECTION (logical)
  0x09, 0x52,                         //     USAGE (Input Mode)
  0x15, 0x00,                         //     LOGICAL_MINIMUM (0)
  0x25, 0x0a,                         //     LOGICAL_MAXIMUM (10)
  0x75, 0x08,                         //     REPORT_SIZE (8)
  0x95, 0x01,                         //     REPORT_COUNT (1)
  0xb1, 0x02,                         //     FEATURE (Data,Var,Abs)
  0xc0,                               //   END_COLLECTION
  0x09, 0x22,                         //   USAGE (Finger)
  0xa1, 0x00,                         //   COLLECTION (physical)
  0x85, REPORTID_TOUCHPAD_FUNC_SWITCH,//     REPORT_ID (9)
  0x09, 0x57,                         //     USAGE(Surface switch)
  0x09, 0x58,                         //     USAGE(Button switch)
  0x75, 0x01,                         //     REPORT_SIZE (1)
  0x95, 0x02,                         //     REPORT_COUNT (2)
  0x25, 0x01,                         //     LOGICAL_MAXIMUM (1)
  0xb1, 0x02,                         //     FEATURE (Data,Var,Abs)
  0x95, 0x06,                         //     REPORT_COUNT (6)
  0xb1, 0x03,                         //     FEATURE (Cnst,Var,Abs)
  0xc0,                               //   END_COLLECTION
  0xc0,                               // END_COLLECTION (TLC 2)
};

USBHIDTouchpad::USBHIDTouchpad() : hid(), _scan_time(0), _input_mode(3), 
                             _fingers_down(false), _current_x(LOGICAL_MAX_X/2), 
                             _current_y(LOGICAL_MAX_Y/2), _current_spacing(FINGER_SPACING_DEFAULT) {
  static bool initialized = false;
  if (!initialized) {
    initialized = true;
    hid.addDevice(this, sizeof(touchpad_report_descriptor));
  }
}

void USBHIDTouchpad::begin() { hid.begin(); }
void USBHIDTouchpad::end() {}

// --- Report Encoding Helpers ---
// Byte layout per finger slot: bit0=Tip Switch, bit1=Confidence, bits2-4=Contact Identifier
static void encodeFinger(uint8_t* report, uint8_t slot, uint16_t x, uint16_t y, bool tip) {
  uint8_t base = slot * TOUCHPAD_FINGER_STRIDE;
  report[base] = (slot << 2) | 0x02 | (tip ? 0x01 : 0x00);
  report[base + 1] = x & 0xFF;
  report[base + 2] = (x >> 8) & 0xFF;
  report[base + 3] = y & 0xFF;
  report[base + 4] = (y >> 8) & 0xFF;
}

static void setScanTime(uint8_t* report, uint16_t scanTime) {
  report[TOUCHPAD_SCAN_TIME_OFFSET] = scanTime & 0xFF;
  report[TOUCHPAD_SCAN_TIME_OFFSET + 1] = (scanTime >> 8) & 0xFF;
}

// --- Internal Report Sender ---
void USBHIDTouchpad::_sendReport(uint8_t count, uint16_t x_pos, uint16_t y_pos, uint16_t spacing) {
  uint8_t report[TOUCHPAD_REPORT_LEN];
  memset(report, 0, sizeof(report)); // Clear report

  report[TOUCHPAD_CONTACT_COUNT_OFFSET] = count;

  if (count > 0) {
    uint16_t half = spacing / 2;
    uint16_t x1 = (x_pos > half) ? x_pos - half : 0;
    if (x1 > LOGICAL_MAX_X) x1 = 0;

    uint16_t x2 = x_pos + half;
    if (x2 > LOGICAL_MAX_X) x2 = LOGICAL_MAX_X;

    encodeFinger(report, 0, x1, y_pos, true);
    encodeFinger(report, 1, x2, y_pos, true);
  }

  setScanTime(report, _scan_time);

  hid.SendReport(REPORTID_TOUCHPAD, report, TOUCHPAD_REPORT_LEN);

  _scan_time += 100; // 10ms units roughly
}

// --- Scroll Implementation ---

void USBHIDTouchpad::scroll(int16_t dx, int16_t dy) {
  // 1. Start Gesture: If fingers aren't down, place them at center
  if (!_fingers_down) {
    _fingers_down = true;
    _current_x = LOGICAL_MAX_X / 2; 
    _current_y = LOGICAL_MAX_Y / 2; 
    _current_spacing = FINGER_SPACING_DEFAULT;
    _sendReport(2, _current_x, _current_y, _current_spacing); 
  }

  // 2. Move Fingers
  int16_t deltaY = dy; 
  int16_t deltaX = dx;

  _current_x += deltaX;
  _current_y += deltaY;
  
  // Clamp
  if (_current_x > LOGICAL_MAX_X - 100) _current_x = LOGICAL_MAX_X - 100;
  if (_current_x < 100) _current_x = 100;
  
  if (_current_y > LOGICAL_MAX_Y - 100) _current_y = LOGICAL_MAX_Y - 100;
  if (_current_y < 100)   _current_y = 100;

  // 3. Send Position Update
  _sendReport(2, _current_x, _current_y, _current_spacing);
}

void USBHIDTouchpad::zoom(int16_t delta) {
  if (!_fingers_down) {
    _fingers_down = true;
    _current_x = LOGICAL_MAX_X / 2;
    _current_y = LOGICAL_MAX_Y / 2;
    _current_spacing = FINGER_SPACING_DEFAULT;
  }

  _current_spacing += delta;
  // Clamp spacing: fingers shouldn't touch (min 50) or exceed logical bounds
  if (_current_spacing < 50) _current_spacing = 50;
  if (_current_spacing > 1500) _current_spacing = 1500;

  _sendReport(2, _current_x, _current_y, _current_spacing);
}

void USBHIDTouchpad::updateFingers(FingerData* fingers) {
  uint8_t report[TOUCHPAD_REPORT_LEN];
  memset(report, 0, sizeof(report));
  uint8_t activeCount = 0;

  for (int i = 0; i < 5; i++) {
    encodeFinger(report, i, fingers[i].x, fingers[i].y, fingers[i].active);
    if (fingers[i].active) activeCount++;
  }

  setScanTime(report, _scan_time);
  report[TOUCHPAD_CONTACT_COUNT_OFFSET] = activeCount;

  hid.SendReport(REPORTID_TOUCHPAD, report, TOUCHPAD_REPORT_LEN);
  _scan_time += 100;
  _fingers_down = (activeCount > 0);
}

void USBHIDTouchpad::liftFingers() {
  if (_fingers_down) {
    // 1. Intermediate Report: fingers still present but Tip Switch=0 (release event)
    uint8_t report_intermediate[TOUCHPAD_REPORT_LEN];
    memset(report_intermediate, 0, sizeof(report_intermediate));

    report_intermediate[TOUCHPAD_CONTACT_COUNT_OFFSET] = 2;

    uint16_t half = _current_spacing / 2;
    uint16_t x1 = (_current_x > half) ? _current_x - half : 0;
    uint16_t x2 = _current_x + half;
    if (x2 > LOGICAL_MAX_X) x2 = LOGICAL_MAX_X;

    encodeFinger(report_intermediate, 0, x1, _current_y, false);
    encodeFinger(report_intermediate, 1, x2, _current_y, false);

    _scan_time += 10; // Small increment
    setScanTime(report_intermediate, _scan_time);

    hid.SendReport(REPORTID_TOUCHPAD, report_intermediate, TOUCHPAD_REPORT_LEN);

    // 2. Final Report: Zero Contacts
    uint8_t report_final[TOUCHPAD_REPORT_LEN] = {0};

    _scan_time += 10; // Small increment
    setScanTime(report_final, _scan_time);
    report_final[TOUCHPAD_CONTACT_COUNT_OFFSET] = 0; // 0 Contacts

    hid.SendReport(REPORTID_TOUCHPAD, report_final, TOUCHPAD_REPORT_LEN);

    _fingers_down = false;

    // Reset position to center
    _current_x = LOGICAL_MAX_X / 2;
    _current_y = LOGICAL_MAX_Y / 2;
    _current_spacing = FINGER_SPACING_DEFAULT;
  }
}

// --- Feature Reports (Exact Logic from UnifiedHID.cpp) ---

uint16_t USBHIDTouchpad::_onGetDescriptor(uint8_t *dst) {
  memcpy(dst, touchpad_report_descriptor, sizeof(touchpad_report_descriptor));
  return sizeof(touchpad_report_descriptor);
}

void USBHIDTouchpad::_onSetFeature(uint8_t report_id, const uint8_t* buffer, uint16_t len) {
  // UnifiedHID Logic:
  if (report_id == REPORTID_TOUCHPAD_FEATURE && len >= 1) {
    _input_mode = buffer[0];
  }
}

uint16_t USBHIDTouchpad::_onGetFeature(uint8_t report_id, uint8_t* buffer, uint16_t len) {
  // UnifiedHID Logic:
  if (report_id == REPORTID_TOUCHPAD_MAX_COUNT && len >= 1) {
    // Packed nibbles per descriptor (low: Contact Count Maximum=5, high: Pad Type=2)
    buffer[0] = 0x25;
    return 1;
  }
  else if (report_id == REPORTID_TOUCHPAD_PTPHQA && len >= 256) {
    memcpy(buffer, PTPHQA_BLOB, 256);
    return 256;
  }
  else if (report_id == REPORTID_TOUCHPAD_FEATURE && len >= 1) {
    buffer[0] = _input_mode;
    return 1;
  }
  else if (report_id == REPORTID_TOUCHPAD_FUNC_SWITCH && len >= 1) {
    buffer[0] = 0x03; // UnifiedHID returned 0x03
    return 1;
  }
  return 0;
}