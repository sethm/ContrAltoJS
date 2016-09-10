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

var HEADER_OFFSET = 44;
var LABEL_OFFSET = HEADER_OFFSET + 14;
var DATA_OFFSET = LABEL_OFFSET + 20;
var SECTOR_WORD_COUNT = 269 + HEADER_OFFSET + 34;

var CellType = {
    DATA: 0,
    GAP:  1,
    SYNC: 2
};

var EmptyDataCell = {data: 0, type: CellType.DATA};

var DiabloDrive = function() {
    this.reset();
};

DiabloDrive.prototype = {
    sectorData: [],

    reset: function() {
        this.sector = 0;
        this.cylinder = 0;
        this.head = 0;

        for (var i = 0; i < SECTOR_WORD_COUNT; i++) {
            this.sectorData[i] = {data: 0, type: CellType.DATA};
        }

        this.sectorModified = false;
        this.initSector();
        this.loadSector();
    },

    loadPack: function(pack) {
        this.pack = pack;
        this.reset();
    },

    unloadPack: function() {
        this.pack = null;
        this.reset();
    },

    isLoaded: function() {
        return this.pack !== null && this.pack !== undefined;
    },

    setSector: function(value) {
        if (this.sectorModified) {
            this.commitSector();
            this.sectorModified = false;
        }

        this.sector = value;
        this.loadSector();
    },

    setHead: function(value) {
        if (value !== this.head) {
            // If we switch heads, we need to reload the sector.

            // If the last sector was modified,
            // commit it before moving to the next.
            if (this.sectorModified) {
                this.commitSector();
                this.sectorModified = false;
            }

            this.head = value;
            this.loadSector();
        }
    },

    setCylinder: function(value) {
        if (value != this.cylinder) {
            // If we switch cylinders, we need to reload the sector.
            // If the last sector was modified,
            // commit it before moving to the next.
            if (this.sectorModified) {
                this.commitSector();
                this.sectorModified = false;
            }

            this.cylinder = value;
            this.loadSector();
        }
    },

    readWord: function(index) {
        if (this.pack !== null && this.pack !== undefined) {
            return this.sectorData[index];
        } else {
            return EmptyDataCell;
        }
    },

    writeWord: function(index, data) {
        if (this.pack !== null && this.pack !== undefined && index < this.sectorData.length) {
            if (this.sectorData[index].type === CellType.DATA) {
                this.sectorData[index].data = data;
                this.sectorModified = true;
            }
        }
    },

    loadSector: function() {
        var i, j, checksum;

        if (this.pack === null || this.pack === undefined) {
            return;
        }

        var sec = this.pack.getSector(this.cylinder, this.head, this.sector);

        // Header (2 words data, 1 word checksum)
        for (i = HEADER_OFFSET + 1, j = 1; i < HEADER_OFFSET + 3; i++, j--) {
            this.sectorData[i].data = sec.header[j];
            this.sectorData[i].type = CellType.DATA;
        }
        checksum = this.calculateChecksum(this.sectorData, HEADER_OFFSET + 1, 2);
        this.sectorData[HEADER_OFFSET + 3].data = checksum;

        // Label (8 words data, 1 word checksum)
        for (i = LABEL_OFFSET + 1, j = 7; i < LABEL_OFFSET + 9; i++, j--) {
            this.sectorData[i].data = sec.label[j];
            this.sectorData[i].type = CellType.DATA;
        }
        checksum = this.calculateChecksum(this.sectorData, LABEL_OFFSET + 1, 8);
        this.sectorData[LABEL_OFFSET + 9].data = checksum;

        // Sector data (256 words data, 1 word checksum)
        for (i = DATA_OFFSET + 1, j = 255; i < DATA_OFFSET + 257; i++, j--) {
            this.sectorData[i].data = sec.data[j];
            this.sectorData[i].type = CellType.DATA;
        }
        checksum = this.calculateChecksum(this.sectorData, DATA_OFFSET + 1, 256);
        this.sectorData[DATA_OFFSET + 257].data = checksum;
    },

    commitSector: function() {
        var i, j;

        if (this.pack === null || this.pack === undefined) {
            return;
        }

        var sec = this.pack.getSector(this.cylinder, this.head, this.sector);

        // Header (2 words data, 1 word checksum)
        for (i = HEADER_OFFSET + 1, j = 1; i < HEADER_OFFSET + 3; i++, j--) {
            sec.header[j] = this.sectorData[i].data;
        }

        // Label (8 words data, 1 word checksum)
        for (i = LABEL_OFFSET + 1, j = 7; i < LABEL_OFFSET + 9; i++, j--) {
            sec.label[j] = this.sectorData[i].data;
        }

        // Sector data (256 words data, 1 word checksum)
        for (i = DATA_OFFSET + 1, j = 255; i < DATA_OFFSET + 257; i++, j--) {
            sec.data[j] = this.sectorData[i].data;
        }

    },

    initSector: function() {
        var i;

        // Header delay, 22 words
        for (i = 0; i < HEADER_OFFSET; i++) {
            this.sectorData[i].data = 0;
            this.sectorData[i].type = CellType.GAP;
        }

        this.sectorData[HEADER_OFFSET].data = 1;
        this.sectorData[HEADER_OFFSET].type = CellType.SYNC;

        // inter-record delay between header & label (2 words)
        for (i = HEADER_OFFSET + 4; i < LABEL_OFFSET; i++) {
            this.sectorData[i].data = 0;
            this.sectorData[i].type = CellType.GAP;
        }

        this.sectorData[LABEL_OFFSET].data = 1;
        this.sectorData[LABEL_OFFSET].type = CellType.SYNC;

        // inter-record delay between label & data (10 words)
        for (i = LABEL_OFFSET + 10; i < DATA_OFFSET; i++) {
            this.sectorData[i].data = 0;
            this.sectorData[i].type = CellType.GAP;
        }

        this.sectorData[DATA_OFFSET].data = 1;
        this.sectorData[DATA_OFFSET].type = CellType.SYNC;

        // read-postamble
        for (i = DATA_OFFSET + 258; i < SECTOR_WORD_COUNT; i++) {
            this.sectorData[i].data = 0;
            this.sectorData[i].type = CellType.GAP;
        }
    },

    calculateChecksum: function(sectorData, offset, length) {
        //
        // From the uCode, the Alto's checksum algorithm is:
        // 1. Load checksum with constant value of 521B (0x151)
        // 2. For each word in the record, cksum <- word XOR cksum
        // 3. Profit
        //

        var checksum = 0x151;

        for (var i = offset; i < offset + length; i++) {
            // Sanity check that we're checksumming actual data
            if (this.sectorData[i].type != CellType.DATA) {
                throw "Attempt to checksum non-data area of sector";
            }

            checksum = (checksum ^ this.sectorData[i].data) & 0xffff;
        }

        return checksum;
    }
};
