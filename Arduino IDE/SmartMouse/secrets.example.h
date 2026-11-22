// Copy this file to secrets.h (which is ignored by git) and set your own secret.
//
// The secret authenticates Home Assistant and the control page, protects OTA
// updates and is the password of the "SmartMouse-Setup" hotspot. Use a random
// string of at least 8 characters, e.g. from: openssl rand -base64 18
#pragma once
#define SMARTMOUSE_SECRET "CHANGE_ME_SECRET"
