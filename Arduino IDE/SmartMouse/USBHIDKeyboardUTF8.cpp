#include "USBHIDKeyboardUTF8.h"
#include <Arduino.h>
#include <string.h>

// HID Usage IDs für deutsche Sonderzeichen (German Layout)
#define HID_KEY_ESZETT     0x2D  // ß (US: -)
#define HID_KEY_U_UMLAUT   0x2F  // ü (US: [)
#define HID_KEY_O_UMLAUT   0x33  // ö (US: ;)
#define HID_KEY_A_UMLAUT   0x34  // ä (US: ')
#define HID_KEY_E          0x08  // e (für Euro Zeichen)

// Modifier Keys
#define HID_KEY_SHIFT_LEFT 0xE1
#define HID_KEY_ALT_RIGHT  0xE6  // Alt Gr (Right Alt)

// Hilfsfunktion: UTF-8 Zeichenlänge ermitteln
size_t USBHIDKeyboardUTF8::getUtf8CharLength(uint8_t firstByte) {
    if (firstByte < 0x80) return 1;      // ASCII
    if ((firstByte & 0xE0) == 0xC0) return 2;  // 2-Byte UTF-8
    if ((firstByte & 0xF0) == 0xE0) return 3;  // 3-Byte UTF-8
    if ((firstByte & 0xF8) == 0xF0) return 4;  // 4-Byte UTF-8
    return 1; // Fehlerfall
}

// UTF-8 zu HID-Scancode konvertieren
bool USBHIDKeyboardUTF8::utf8ToHidCode(const uint8_t *utf8, size_t len, uint8_t &hidCode, bool &needsShift, bool &needsAltGr) {
    hidCode = 0;
    needsShift = false;
    needsAltGr = false;

    // 1-Byte (ASCII): Standard-Handling über Parent-Klasse
    if (len == 1 && utf8[0] < 0x80) {
        return false; // Signalisiert: Nutze Standard-Methode
    }

    // 2-Byte UTF-8: Deutsche Umlaute
    if (len == 2 && utf8[0] == 0xC3) {
        switch (utf8[1]) {
            // Kleinbuchstaben
            case 0xA4: hidCode = HID_KEY_A_UMLAUT; return true;  // ä
            case 0xB6: hidCode = HID_KEY_O_UMLAUT; return true;  // ö
            case 0xBC: hidCode = HID_KEY_U_UMLAUT; return true;  // ü
            case 0x9F: hidCode = HID_KEY_ESZETT;   return true;  // ß

            // Großbuchstaben (mit Shift)
            case 0x84: hidCode = HID_KEY_A_UMLAUT; needsShift = true; return true;  // Ä
            case 0x96: hidCode = HID_KEY_O_UMLAUT; needsShift = true; return true;  // Ö
            case 0x9C: hidCode = HID_KEY_U_UMLAUT; needsShift = true; return true;  // Ü
        }
    }

    // 3-Byte UTF-8: Euro Zeichen (€) -> 0xE2 0x82 0xAC
    if (len == 3 && utf8[0] == 0xE2 && utf8[1] == 0x82 && utf8[2] == 0xAC) {
        hidCode = HID_KEY_E;
        needsAltGr = true;
        return true;
    }

    return false; // Unbekanntes Zeichen
}

// write() für einzelnes Byte/Zeichen
size_t USBHIDKeyboardUTF8::write(uint8_t c) {
    if (c < 0x80) {
        return USBHIDKeyboard::write(c);
    }
    return 0;
}

// write() für Buffer (mit UTF-8 Unterstützung)
size_t USBHIDKeyboardUTF8::write(const uint8_t *buffer, size_t size) {
    if (!buffer || size == 0) return 0;

    size_t written = 0;
    const uint8_t *p = buffer;
    const uint8_t *end = buffer + size;

    while (p < end) {
        size_t charLen = getUtf8CharLength(*p);
        
        if (p + charLen > end) {
            break; 
        }

        uint8_t hidCode;
        bool needsShift;
        bool needsAltGr;
        
        if (utf8ToHidCode(p, charLen, hidCode, needsShift, needsAltGr)) {
            // 1. Modifier drücken
            if (needsShift) USBHIDKeyboard::pressRaw(HID_KEY_SHIFT_LEFT);
            if (needsAltGr) USBHIDKeyboard::pressRaw(HID_KEY_ALT_RIGHT);
            
            if (needsShift || needsAltGr) delay(5);
            
            // 2. Taste drücken
            USBHIDKeyboard::pressRaw(hidCode);
            delay(5);
            
            // 3. Alles loslassen
            USBHIDKeyboard::releaseRaw(hidCode);
            
            if (needsShift) USBHIDKeyboard::releaseRaw(HID_KEY_SHIFT_LEFT);
            if (needsAltGr) USBHIDKeyboard::releaseRaw(HID_KEY_ALT_RIGHT);
            
            delay(5);
            written += charLen;
        } else if (charLen == 1 && *p < 0x80) {
            // ASCII-Zeichen
            if (*p != '\r') {
                USBHIDKeyboard::write(*p);
                written++;
            } else {
                written++;
            }
        } else {
            // Unbekanntes Zeichen überspringen
            written += charLen;
        }
        
        p += charLen;
    }

    return written;
}

// write() für C-Strings
size_t USBHIDKeyboardUTF8::write(const char *str) {
    if (str == nullptr) return 0;
    return write((const uint8_t *)str, strlen(str));
}

// press() für UTF-8 String
size_t USBHIDKeyboardUTF8::press(const char *utf8char) {
    if (!utf8char) return 0;
    
    size_t len = getUtf8CharLength((uint8_t)utf8char[0]);
    uint8_t hidCode;
    bool needsShift;
    bool needsAltGr;
    
    if (utf8ToHidCode((const uint8_t *)utf8char, len, hidCode, needsShift, needsAltGr)) {
        if (needsShift) USBHIDKeyboard::pressRaw(HID_KEY_SHIFT_LEFT);
        if (needsAltGr) USBHIDKeyboard::pressRaw(HID_KEY_ALT_RIGHT);
        return USBHIDKeyboard::pressRaw(hidCode);
    }
    
    if (len == 1 && utf8char[0] < 0x80) {
        return USBHIDKeyboard::press((uint8_t)utf8char[0]);
    }
    
    return 0;
}

// release() für UTF-8 String
size_t USBHIDKeyboardUTF8::release(const char *utf8char) {
    if (!utf8char) return 0;
    
    size_t len = getUtf8CharLength((uint8_t)utf8char[0]);
    uint8_t hidCode;
    bool needsShift;
    bool needsAltGr;
    
    if (utf8ToHidCode((const uint8_t *)utf8char, len, hidCode, needsShift, needsAltGr)) {
        size_t result = USBHIDKeyboard::releaseRaw(hidCode);
        if (needsShift) USBHIDKeyboard::releaseRaw(HID_KEY_SHIFT_LEFT);
        if (needsAltGr) USBHIDKeyboard::releaseRaw(HID_KEY_ALT_RIGHT);
        return result;
    }
    
    if (len == 1 && utf8char[0] < 0x80) {
        return USBHIDKeyboard::release((uint8_t)utf8char[0]);
    }
    
    return 0;
}