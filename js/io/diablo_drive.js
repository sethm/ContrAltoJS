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

var CellType = {
    DATA: 0,
    GAP:  1,
    SYNC: 2
};

var DataCell = function(data, type) {
    this.data = data;
    this.type = type;
};

DataCell.prototype.toString = function() {
    return this.data.toString() + " " + this.type.toString();
};

var EmptyDataCell = new DataCell(0, CellType.DATA);

var DiabloDrive = function() {
    this.reset();

    for (var i = 0; i < DiabloDrive.sectorWordCount; i++) {
        this.sectorData[i] = new DataCell(0, CellType.DATA);
    }

};

DiabloDrive.headerOffset = 44;
DiabloDrive.labelOffset = DiabloDrive.headerOffset + 14;
DiabloDrive.dataOffset = DiabloDrive.labelOffset + 20;
DiabloDrive.sectorWordCount = 269 + DiabloDrive.headerOffset + 34;

DiabloDrive.prototype = {
    sectorData: [],

    reset: function() {
        this.sector = 0;
        this.cylinder = 0;
        this.head = 0;

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
        return this.pack != null && this.pack != undefined;
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
        if (value != this.head) {
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
        if (value != cylinder) {
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
        if (this.pack != null && this.pack != undefined) {
            return this.sectorData[index];
        } else {
            return EmptyDataCell;
        }
    },

    writeWord: function(index, data) {
        if (this.pack != null && this.pack != undefined && index < this.sectorData.length) {
            if (this.sectorData[index].type === CellType.DATA) {
                this.sectorData[index].Data = data;
            } else {
                console.log("Data written to non-data section!");
            }

            this.sectorModified = true;
        }
    },

    loadSector: function() {
        console.log("Load Sector " + this.cylinder + "/" + this.head + "/" + this.sector);
        var i, j, checksum;

        if (this.pack == null || this.pack == undefined) {
            return;
        }

        var sec = this.pack.getSector(this.cylinder, this.head, this.sector);

        // Header (2 words data, 1 word checksum)
        for (i = DiabloDrive.headerOffset + 1, j = 1; i < DiabloDrive.headerOffset + 3; i++, j--) {
            this.sectorData[i] = new DataCell(sec.header[j], CellType.DATA);
        }
        checksum = this.calculateChecksum(this.sectorData, DiabloDrive.headerOffset + 1, 2);
        this.sectorData[DiabloDrive.headerOffset + 3].data = checksum;

        // Label (8 words data, 1 word checksum)
        for (i = DiabloDrive.labelOffset + 1, j = 7; i < DiabloDrive.labelOffset + 9; i++, j--) {
            this.sectorData[i] = new DataCell(sec.label[j], CellType.DATA);
        }
        checksum = this.calculateChecksum(this.sectorData, DiabloDrive.labelOffset + 1, 8);
        this.sectorData[DiabloDrive.labelOffset + 9].data = checksum;

        // Sector data (256 words data, 1 word checksum)
        for (i = DiabloDrive.dataOffset + 1, j = 255; i < DiabloDrive.dataOffset + 257; i++, j--) {
            this.sectorData[i] = new DataCell(sec.data[j], CellType.DATA);
        }
        checksum = this.calculateChecksum(this.sectorData, DiabloDrive.dataOffset + 1, 256);
        this.sectorData[DiabloDrive.dataOffset + 257].data = checksum;
    },

    commitSector: function() {
        console.log("Commit Sector " + this.cylinder + "/" + this.head + "/" + this.sector);
        var i, j, checksum;

        if (this.pack == null || this.pack == undefined) {
            return;
        }

        var sec = this.pack.getSector(this.cylinder, this.head, this.sector);

        // Header (2 words data, 1 word checksum)
        for (i = DiabloDrive.headerOffset + 1, j = 1; i < DiabloDrive.headerOffset + 3; i++, j--) {
            sec.header[j] = this.sectorData[i].data;
        }

        // Label (8 words data, 1 word checksum)
        for (i = DiabloDrive.labelOffset + 1, j = 7; i < DiabloDrive.labelOffset + 9; i++, j--) {
            sec.label[j] = this.sectorData[i].data;
        }

        // Sector data (256 words data, 1 word checksum)
        for (i = DiabloDrive.dataOffset + 1, j = 255; i < DiabloDrive.dataOffset + 257; i++, j--) {
            sec.data[j] = this.sectorData[i].data;
        }

    },

    initSector: function() {
        console.log("Init Sector " + this.cylinder + "/" + this.head + "/" + this.sector);
        var i;

        // Header delay, 22 words
        for (i = 0; i < DiabloDrive.headerOffset; i++) {
            this.sectorData[i] = new DataCell(0, CellType.GAP);
        }
        this.sectorData[DiabloDrive.headerOffset] = new DataCell(1, CellType.Sync);

        // inter-record delay between header & label (10 words)
        for (i = DiabloDrive.headerOffset + 4; i < DiabloDrive.labelOffset; i++) {
            this.sectorData[i] = new DataCell(0, CellType.GAP);
        }
        this.sectorData[DiabloDrive.labelOffset] = new DataCell(1, CellType.Sync);

        // inter-record delay between label & data (10 words)
        for (i = DiabloDrive.labelOffset + 10; i < DiabloDrive.dataOffset; i++) {
            this.sectorData[i] = new DataCell(0, CellType.GAP);
        }
        this.sectorData[DiabloDrive.dataOffset] = new DataCell(1, CellType.Sync);

        // read-postamble
        for (i = DiabloDrive.dataOffset + 258; i < DiabloDrive.sectorWordCount; i++) {
            this.sectorData[i] = new DataCell(0, CellType.GAP);
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
