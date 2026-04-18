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
    delay(1000);

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
    // TEST 4a: Touchpad Zoom In
    // ---------------------------------------
    Serial.println("TEST 4a: Touchpad - Zoom In (spread fingers)");
    for (int i = 0; i < 30; i++) {
      touchpad.zoom(5); // Increase spacing
      delay(12);
    }
    touchpad.liftFingers();
    delay(1000);

    // ---------------------------------------
    // TEST 5: Touchpad Two-Finger Scroll
    // (Vertical, Horizontal, Diagonal)
    // ---------------------------------------
    Serial.println("TEST 5a: Touchpad - Two-finger scroll down (vertical)");
    for (int i = 0; i < 30; i++) {
      touchpad.scroll(0, -15);
      delay(8);
    }
    touchpad.liftFingers(); 
    delay(1000);

    Serial.println("TEST 5b: Touchpad - Two-finger scroll up (vertical)");
    for (int i = 0; i < 30; i++) {
      touchpad.scroll(0, 15);
      delay(8);
    }
    touchpad.liftFingers(); 
    delay(1000);

    Serial.println("TEST 5c: Touchpad - Two-finger scroll left (horizontal)");
    for (int i = 0; i < 30; i++) {
      touchpad.scroll(15, 0);
      delay(8);
    }
    touchpad.liftFingers(); 
    delay(1000);

    Serial.println("TEST 5d: Touchpad - Two-finger scroll right (horizontal)");
    for (int i = 0; i < 30; i++) {
      touchpad.scroll(-15, 0);
      delay(8);
    }
    touchpad.liftFingers(); 
    delay(1000);

    Serial.println("TEST 5e: Touchpad - Two-finger scroll diagonal (up-left)");
    for (int i = 0; i < 30; i++) {
      touchpad.scroll(20, 20);
      delay(8);

    }
    touchpad.liftFingers(); 
    delay(1000);
    
    // ---------------------------------------
    // TEST 4b: Touchpad Zoom Out
    // ---------------------------------------
    Serial.println("TEST 4b: Touchpad - Zoom Out (pinch fingers)");
    for (int i = 0; i < 30; i++) {
      touchpad.zoom(-5); // Decrease spacing
      delay(12);
    }
    touchpad.liftFingers();
    delay(2000);

    // ---------------------------------------
    // TEST 6: Custom Multi-Finger Input
    // ---------------------------------------
    Serial.println("TEST 6: Custom Touch - 4 Fingers Swipe Up");
    USBHIDTouchpad::FingerData fingers[5];
    memset(fingers, 0, sizeof(fingers));

    // Initial positions for 4 fingers in a horizontal row
    for(int i = 0; i < 4; i++) {
        fingers[i].active = 1;
        fingers[i].x = 600 + (i * 700);
        fingers[i].y = 3000;
    }
    touchpad.updateFingers(fingers);
    delay(150);

    // Perform a 4-finger swipe up gesture
    for(int i = 0; i < 40; i++) {
        for(int j = 0; j < 4; j++) fingers[j].y -= 50;
        touchpad.updateFingers(fingers);
        delay(10);
    }

    for (int i = 0; i < 5; i++) fingers[i].active = 0;
    touchpad.updateFingers(fingers);

    delay(2000);

    // ---------------------------------------
    // TEST 7: Keyboard - Type text
    // ---------------------------------------
    Serial.println("TEST 7: Keyboard - Type 'Hello'");
    keyboard.write("ABCxyz123äöü,.-+#!?$%&/(){}[]=ß<>*:;|");
    delay(1000);

    // ---------------------------------------
    // TEST 8: Media Keys (Volume)
    // ---------------------------------------
    Serial.println("TEST 8a: Media Keys - Volume Down");
    media.press(0xEA);  // Volume Down
    delay(100);
    media.release();
    delay(1000);
    
    Serial.println("TEST 8b: Media Keys - Volume Up");
    media.press(0xE9);  // Volume Up
    delay(100);
    media.release();
    delay(1000);
    
    Serial.println("\n=== ALL TESTS COMPLETE ===\n");
    delay(1000);
}

#endif