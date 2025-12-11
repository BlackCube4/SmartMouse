#pragma once

#include "USBHIDKeyboard.h"

class USBHIDKeyboardUTF8 : public USBHIDKeyboard {
public:
    USBHIDKeyboardUTF8() : USBHIDKeyboard() {}

    // Override write() für UTF-8 Unterstützung
    size_t write(uint8_t c) override;
    size_t write(const uint8_t *buffer, size_t size) override;
    size_t write(const char *str);

    // Neue Methoden für press/release mit UTF-8 Unterstützung
    size_t press(const char *utf8char);
    size_t release(const char *utf8char);
    
    // Original press/release für einzelne Bytes (ASCII)
    using USBHIDKeyboard::press;
    using USBHIDKeyboard::release;

private:
    // Hilfsfunktion: UTF-8 zu HID-Scancode konvertieren
    bool utf8ToHidCode(const uint8_t *utf8, size_t len, uint8_t &hidCode, bool &needsShift, bool &needsAltGr);
    
    // Hilfsfunktion: Länge eines UTF-8 Zeichens ermitteln
    size_t getUtf8CharLength(uint8_t firstByte);
};