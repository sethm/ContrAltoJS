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

var SCAN_LINE_WORDS = 38;
var DISPLAY_SCALE = 1.0;
var VERTICAL_BLANK_DURATION = 665000.0 * DISPLAY_SCALE;
var VERTICAL_BLANK_SCANLINE_DURATION = 38080.0 * DISPLAY_SCALE;
var HORIZONTAL_BLANK_DURATION = 6084.0 * DISPLAY_SCALE;
var DISPLAY_WORD_DURATION = 842.0 * DISPLAY_SCALE;

var displayController = {

    // Mode data
    evenField: false,
    lowRes: false,
    lowResLatch: false,
    whiteOnBlack: false,
    whiteOnBlackLatch: false,
    swModeLatch: false,

    // Cursor data
    cursorRegLatch: false,
    cursorReg: 0,
    cursorRegLatched: 0,
    cursorXLatch: false,
    cursorX: 0,
    cursorXLatched: 0,


    // Indicates whether the DWT or DHT blocked themselves
    // in which case they cannot be reawakened until the next field.
    dwtBlocked: true,
    dhtBlocked: false,

    scanLine: 0,
    word: 0,

    dataBuffer: [],

    fields: 0,

    vblankScanlineCount: 0,

    setDwtBlock: function(val) {
        this.dwtBlocked = val;
        this.checkWordWakeup();
    },

    setDhtBlock: function(val) {
        this.dhtBlocked = val;
        this.checkWordWakeup();
    },

    reset: function() {
        this.evenField = false;
        this.scanLine = 0;
        this.word = 0;
        this.dwtBlocked = true;
        this.dhtBlocked = false;
        this.dataBuffer = [];

        this.checkWordWakeup();

        this.whiteOnBlack = this.whiteOnBlackLatch = false;
        this.lowRes = this.lowResLatch = false;
        this.swModeLatch = false;

        this.cursorReg = 0;
        this.cursorX = 0;
        this.cursorRegLatch = false;
        this.cursorXLatch = false;

        this.verticalBlankScanlineWakeup = new Event(VERTICAL_BLANK_DURATION, null, this.verticalBlankScanlineCallback);
        this.horizontalWakeup = new Event(HORIZONTAL_BLANK_DURATION, null, this.horizontalBlankEndCallback);
        this.wordWakeup = new Event(DISPLAY_WORD_DURATION, null, this.wordCallback);

        // Kick things off
        scheduler.schedule(this.verticalBlankScanlineWakeup);
    },

    // Begins the next display field.
    fieldStart: function() {
        this.evenField = !this.evenField;

        // Wakeup DVT
        cpu.wakeupTask(TaskType.DISPLAY_VERT);

        // Block DHT, DWT
        cpu.blockTask(TaskType.DISPLAY_HORIZ);
        cpu.blockTask(TaskType.DISPLAY_WORD);

        this.fields++;

        this.scanLine = this.evenField ? 0 : 1;
        this.vblankScanlineCount = 0;

        this.dataBuffer = [];

        this.verticalBlankScanlineWakeup.timestampNsec = VERTICAL_BLANK_SCANLINE_DURATION;
        scheduler.schedule(this.verticalBlankScanlineWakeup);
    },

    verticalBlankScanlineCallback: function(timeNsec, skewNsec, context) {
        var d = displayController;

        // End of VBlank scanline
        d.vblankScanlineCount++;

        // Run MRT
        cpu.wakeupTask(TaskType.MEMORY_REFRESH);

        // Run Ethernet if a countdown wakeup is in progress
        if (ethernetController.countdownWakeup) {
           cpu.wakeupTask(TaskType.ETHERNET);
        }

        if (d.vblankScanlineCount > (d.evenField ? 33 : 34)) {
            // End of vblank.
            // Wake up DHT
            cpu.wakeupTask(TaskType.DISPLAY_HORIZ);

            d.dataBuffer = [];

            d.setDwtBlock(false);
            d.setDhtBlock(false);

            // Run CURT
            cpu.wakeupTask(TaskType.CURSOR);

            // Schedule HBlank wakeup for end of first HBlank
            d.horizontalWakeup.timestampNsec = HORIZONTAL_BLANK_DURATION - skewNsec;
            scheduler.schedule(d.horizontalWakeup);
        } else {
            // Do the next vblank scanline
            d.verticalBlankScanlineWakeup.timestampNsec = VERTICAL_BLANK_SCANLINE_DURATION;
            scheduler.schedule(d.verticalBlankScanlineWakeup);
        }
    },

    horizontalBlankEndCallback: function(timeNsec, skewNsec, context) {
        var d = displayController;

        d.word = 0;

        // Deal with cursor latches for this scanline
        if (d.cursorRegLatch) {
            d.cursorRegLatched = d.cursorReg;
            d.cursorRegLatch = false;
        }

        if (d.cursorXLatch) {
            d.cursorXLatched = d.cursorX;
            d.cursorXLatch = false;
        }

        // Schedule wakeup for first word on this scanline
        d.wordWakeup.timestampNsec = HORIZONTAL_BLANK_DURATION;
        scheduler.schedule(d.wordWakeup);
    },

    wordCallback: function(timeNsec, skewNsec, context) {
        var d = displayController;

        var displayWord = d.whiteOnBlack ? 0 : 0xffff;

        if (d.dataBuffer.length > 0) {
            var word = d.dataBuffer.shift();
            displayWord = d.whiteOnBlack ? word : (~word) & 0xffff;
            d.checkWordWakeup();
        }

        altoDisplay.drawWord(d.scanLine, d.word, displayWord, d.lowRes);

        d.word++;

        if (d.word >= (d.lowRes ? (SCAN_LINE_WORDS / 2) : SCAN_LINE_WORDS)) {
            // End of scanline.
            // Move to next.

            // Draw cursor for this scanline first.
            if (d.cursorXLatched < 606) {
                altoDisplay.drawCursorWord(d.scanLine, d.cursorXLatched, d.whiteOnBlack, d.cursorRegLatched);
            }

            d.scanLine += 2;

            if (d.scanLine >= 808) {
                // Done with field, start another.
                d.fieldStart();
            } else {
                // More scanlines to do.

                // Run CURT and MRT at end of scanline.
                cpu.wakeupTask(TaskType.CURSOR);
                cpu.wakeupTask(TaskType.MEMORY_REFRESH);

                // Schedule HBlank wakeup for end of next HBlank
                d.horizontalWakeup.timestampNsec = HORIZONTAL_BLANK_DURATION - skewNsec;
                scheduler.schedule(d.horizontalWakeup);
                d.setDwtBlock(false);
                d.dataBuffer = [];

                // Deal with SWMODE latches for the scanline we're about to draw.
                if (d.swModeLatch) {
                    d.lowRes = d.lowResLatch;
                    d.whiteOnBlack = d.whiteOnBlackLatch;
                    d.swModeLatch = false;
                }
            }
        } else {
            // More words to do
            if (d.lowRes) {
                d.wordWakeup.timestampNsec = DISPLAY_WORD_DURATION * 2 - skewNsec;
            } else {
                d.wordWakeup.timestampNsec = DISPLAY_WORD_DURATION - skewNsec;
            }

            scheduler.schedule(d.wordWakeup);
        }
    },

    fifoFull: function() {
        return this.dataBuffer.size >= 127;
    },

    checkWordWakeup: function() {
        if (this.fifoFull() || this.dhtBlocked || this.dwtBlocked) {
            cpu.blockTask(TaskType.DISPLAY_WORD);
        } else if (!this.fifoFull() && !this.dhtBlocked && !this.dwtBlocked) {
            cpu.wakeupTask(TaskType.DISPLAY_WORD);
        }
    },

    loadDdr: function(word) {
        this.dataBuffer.push(word & 0xffff);

        if (this.dataBuffer.length > 128) {
            console.log("*** WARNING: DISPLAY WORD BUFFER OVERFLOW");
            this.dataBuffer.shift();
        }

        this.checkWordWakeup();
    },

    // Load the X position register for the cursor
    loadXpreg: function(word) {
        if (!this.cursorXLatch) {
            this.cursorXLatch = true;
            this.cursorX = (~word) & 0xffff;
        }
    },

    // Load the cursor register
    loadCsr: function(word) {
        if (!this.cursorRegLatch) {
            this.cursorRegLatch = true;
            this.cursorReg = word & 0xffff;
        }
    },

    // Sets the mode (low res and white on black bits)
    setMode: function(word) {
        this.lowResLatch = (word & 0x8000) !== 0;
        this.whiteOnBlackLatch = (word & 0x4000) !== 0;
        this.swModeLatch = true;
    }
};