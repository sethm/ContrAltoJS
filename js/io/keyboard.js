/*
 JsAlto Xerox Alto Emulator
 Copyright (C) 2016  Seth J. Morabito

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Affero General Public License for more details.

 You should have received a copy of the GNU Affero General Public License
 along with this program.  If not, see
 <http://www.gnu.org/licenses/>.
*/

// Keyboard interface.

var keyboard = {

    keys: [0, 0, 0, 0],

    keyCodes: {
        53:  [0, 0x8000],  // D5
        52:  [0, 0x4000],  // D4
        54:  [0, 0x2000],  // D6
        69:  [0, 0x1000],  // E
        55:  [0, 0x0800],  // D7
        68:  [0, 0x0400],  // D
        85:  [0, 0x0200],  // U
        86:  [0, 0x0100],  // V
        48:  [0, 0x0080],  // D0
        75:  [0, 0x0040],  // K
        189: [0, 0x0020],  // Minus
        80:  [0, 0x0010],  // P
        191: [0, 0x0008],  // FSlash
        220: [0, 0x0004],  // BSlash
        // 13:  [0, 0x0002],  // LF
        8:   [0, 0x0001],  // BS

        51:  [1, 0x8000],  // D3
        50:  [1, 0x4000],  // D2
        87:  [1, 0x2000],  // W
        81:  [1, 0x1000],  // Q
        83:  [1, 0x0800],  // S
        65:  [1, 0x0400],  // A
        57:  [1, 0x0200],  // D9
        73:  [1, 0x0100],  // I
        88:  [1, 0x0080],  // X
        79:  [1, 0x0040],  // O
        76:  [1, 0x0020],  // L
        188: [1, 0x0010],  // Comma
        222: [1, 0x0008],  // Quote
        221: [1, 0x0004],  // RBracket
        112: [1, 0x0002],  // BlankMiddle
        113: [1, 0x0001],  // BlankTop

        49:  [2, 0x8000],  // D1
        27:  [2, 0x4000],  // ESC
        9:   [2, 0x2000],  // TAB
        70:  [2, 0x1000],  // F
        17:  [2, 0x0800],  // CTRL
        67:  [2, 0x0400],  // C
        74:  [2, 0x0200],  // J
        66:  [2, 0x0100],  // B
        90:  [2, 0x0080],  // Z
        16:  [2, 0x0040],  // LShift
        190: [2, 0x0020],  // Period
        186: [2, 0x0010],  // Semicolon
        13:  [2, 0x0008],  // Return
        39:  [2, 0x0004],  // Arrow
        46:  [2, 0x0002],  // DEL

        82:  [3, 0x8000],  // R
        84:  [3, 0x4000],  // T
        71:  [3, 0x2000],  // G
        89:  [3, 0x1000],  // Y
        72:  [3, 0x0800],  // H
        56:  [3, 0x0400],  // D8
        78:  [3, 0x0200],  // N
        77:  [3, 0x0100],  // M
        20:  [3, 0x0080],  // Lock
        32:  [3, 0x0040],  // Space
        219: [3, 0x0020],  // LBracket
        187: [3, 0x0010],  // Plus
        256: [3, 0x0008],  // RShift - special
        114: [3, 0x0004]   // BlankBottom
    },

    reset: function() {
        for (var i = 0; i < this.keys.length; i++) {
            this.keys[i] = 0;
        }
    },

    read: function(address, task, extendedMemoryReference) {
        var index = address - 0xfe1c;
        return(~(this.keys[index]) & 0xffff);
    },

    load: function(address, data, task, extendedMemoryReference) {
        // Nothing.
    },

    keyUp: function(e) {
        var keyCode = e.keyCode;

        // Special logic for left-shift vs. right-shift
        if (keyCode === 16 && e.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT) {
            keyCode = 256;
        }

        var code = keyboard.keyCodes[keyCode];

        if (code) {
            keyboard.keys[code[0]] &= ((~code[1]) & 0xffff);
        }

        e.stopPropagation();
        e.preventDefault();
        return false;
    },

    keyDown: function(e) {
        var keyCode = e.keyCode;

        // Special logic for left-shift vs. right-shift
        if (keyCode === 16 && e.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT) {
            keyCode = 256;
        }

        var code = keyboard.keyCodes[keyCode];

        if (code) {
            keyboard.keys[code[0]] |= code[1];
        }

        e.stopPropagation();
        e.preventDefault();
        return false;
    },

    addresses: [
        new MemoryRange(0xfe1c, 0xfe1f)
    ],

    toString: function() {
        return "Keyboard";
    }
};