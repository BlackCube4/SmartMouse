#ifndef TEST_SEQUENCE_H
#define TEST_SEQUENCE_H

#include <Arduino.h>
#include <USBHIDConsumerControl.h>
#include "USBHIDKeyboardUTF8.h"
#include "USBHIDMouse.h"
#include "USBHIDTouchpad.h"

void runTestSequence(USBHIDKeyboardUTF8 &keyboard, USBHIDMouse &mouse, USBHIDConsumerControl &media, USBHIDTouchpad &touchpad) {
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

#endif