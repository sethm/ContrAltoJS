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

const SCAN_LINE_WORDS = 38;
const DISPLAY_SCALE = 1.0;
const VERTICAL_BLANK_DURATION = 665000.0 * DISPLAY_SCALE;
const VERTICAL_BLANK_SCANLINE_DURATION = 3808.0 * DISPLAY_SCALE;
const HORIZONTAL_BLANK_DURATION = 6084.0 * DISPLAY_SCALE;
const WORD_DURATION = 842.0 * DISPLAY_SCALE;

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
    scanLineWords: 38,

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
        this.wordWakeup = new Event(WORD_DURATION, null, this.wordCallback);
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
        console.log("Vertical Blank Scanline Callback");

        var d = displayController;

        // End of VBlank scanline
        d.vblankScanlineCount++;

        // Run MRT
        cpu.wakeupTask(TaskType.MEMORY_REFRESH);

        // // Run Ethernet if a countdown wakeup is in progress
        // if (ethernetController.countdownWakeup) {
        //    cpu.wakeupTask(TaskType.ETHERNET);
        // }

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
        console.log("Horizontal Blank End Callback");

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
        // TODO: the delay below is chosen to reduce flicker on first scanline;
        // investigate.
        d.wordWakeup.timestampNsec = d.lowRes ? 0 : WORD_DURATION * 3;
        scheduler.schedule(d.wordWakeup);
    },

    wordCallback: function(timeNsec, skewNsec, context) {
        console.log("Display Word Callback");

        var d = displayController;

        var displayWord = d.whiteOnBlack ? 0 : 0xffff;

        if (dataBuffer.length > 0) {
            var word = d.dataBuffer.shift();
            displayWord = d.whiteOnBlack ? word : (~word) & 0xffff;
        }

        altoDisplay.drawWord(d.scanline, d.word, displayWord, d.lowRes);

        // // Merge in cursor word.a
        // TODO: This local variable is unused in ContrAlto, investigate.
        // var xOffset = word * (d.lowRes ? 32 : 16);

        d.word++;

        if (d.word >= (d.lowRes ? SCAN_LINE_WORDS / 2 : SCAN_LINE_WORDS)) {
            // End of scanline.
            // Move to next.

            // Draw cursor for this scanline first.
            if (d.cursorXLatched < 606) {
                altoDisplay.drawCursorWord(d.scanline, d.cursorXLatched, d.whiteOnBlack, d.cursorRegLatched);
            }

            d.scanline += 2;

            if (d.scanline >= 808) {
                // Done with field.
                // Draw completed field to the emulated display
                altoDisplay.render();

                // And start over.
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
                    d.whtieOnBlack = d.whiteOnBlackLatch;
                    d.swModeLatch = false;
                }
            }
        } else {
            // More words to do
            if (d.lowRes) {
                d.wordWakeup.timestampNsec = WORD_DURATION * 2 - skewNsec;
            } else {
                d.wordWakeup.timestampNsec = WORD_DURATION - skewNsec;
            }

            scheduler.schedule(d.wordWakeup);
        }
    },

    fifoFull: function() {
        return this.dataBuffer.size >= 15;
    },

    checkWordWakeup: function() {
        if (this.fifoFull() || this.dhtBlocked || this.dwtBlocked) {
            cpu.blockTask(TaskType.DISPLAY_WORD);
        } else if (!this.fifoFull() && !this.dhtBlocked && !this.dwtBlocked) {
            cpu.wakeupTask(TaskType.DISPLAY_WORD);
        }
    },

    loadDdr: function(word) {
        dataBuffer.push(word & 0xffff);

        if (dataBuffer > 16) {
            dataBuffer.shift();
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
        this.lowResLatch = (word & 0x8000) != 0;
        this.whiteOnBlackLatch = (word & 0x4000) != 0;
        this.swModeLatch = true;
    }
};