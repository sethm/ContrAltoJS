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

var MemoryRange = function (start, end) {
    if (!(end >= start)) {
        throw "end must be greater than or equal to start";
    }

    this.start = start;
    this.end = end;
};

MemoryRange.prototype.overlaps = function(other) {
    return ((other.start >= this.start && other.start <= this.end) ||
            (other.end >= this.start && other.end <= this.end));
};

var Memory = {

    mem: [],
    xmBanks: [],
    memTop: 0xfdff,       // 176777
    xmBankStart: 0xffe0,  // 177740
    addresses: [],

    init: function() {
        if (Configuration.systemType === SystemType.ALTO_I) {
            this.addresses = [
                // Main bank of RAM to 176777. IO above this.
                new MemoryRange(0, this.memTop)
            ];
        } else {
            this.addresses = [
                // Main bank of RAM to 176777. IO above this.
                new MemoryRange(0, this.memTop),
                // Memory bank registers
                new MemoryRange(this.xmBankStart, this.xmBankStart + 16)
            ];
        }
    },

    reset: function() {
        // Clear out memory and bank registers
        this.mem = [];
        this.xmBanks = [];
    },

    read: function(address, task, extendedMemory) {
        if (address >= this.xmBankStart && address < this.xmBankStart + 16) {
            return this.xmBanks[address - this.xmBankStart] & 0xfff0;
        } else {
            address += 0x10000 * this.getBankNumber(task, extendedMemory);
            return this.mem[address];
        }
    },

    getBankNumber: function(task, extendedMemory) {
        return extendedMemory ? (this.xmBanks[task] & 0x3) : (this.xmBanks[task] & 0xc) >>> 2;
    }
};
