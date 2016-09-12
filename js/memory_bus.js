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

// Implements the memory bus and memory timings for the Alto system.
// This implements timings for both Alto I and Alto II systems.

var MemoryOperation = {
    NONE: 0,
    LOAD_ADDRESS: 1,
    READ: 2,
    STORE: 3
};

var memoryBus = {
    memoryCycle: 0,
    memoryAddress: 0,
    memoryData: 0,
    memoryData2: 0,
    doubleWordStore: false,
    doubleWordMixed: false,
    memoryOperationActive: false,
    extendedMemoryReference: false,
    bus: {},

    addDevice: function (dev) {
        // We represent the bus as an object where each key is a
        // physical address slot number (1 - 65535) and each value is
        // a reference to a device that is mapped to that address.
        // This isn't so space efficient, but shouldn't be TOO bad.

        var ranges = dev.addresses;

        if (dev === memory) {
            this.mainMemory = dev;
        }

        for (var i = 0; i < ranges.length; i++) {
            for (var addr = ranges[i].start; addr <= ranges[i].end; addr++) {
                // Make sure nothing is already using the slot
                if (this.bus[addr] !== undefined) {
                    throw "Memory mapped address collision for dev " + dev + " at address " + addr + " with " +
                    this.bus[addr];
                }
                this.bus[addr] = dev;
            }
        }
    },

    reset: function () {
        this.memoryCycle = 0;
        this.memoryAddress = 0;
        this.memoryCycle = 0;
        this.memoryAddress = 0;
        this.memoryData = 0;
        this.memoryData2 = 0;
        this.doubleWordStore = false;
        this.doubleWordMixed = false;
        this.memoryOperationActive = false;
        this.extendedMemoryReference = false;
    },

    clock: function () {
        this.memoryCycle++;

        if (this.memoryOperationActive) {
            if (Configuration.systemType == SystemType.ALTO_I) {
                this.clockAltoI();
            } else {
                this.clockAltoII();
            }
        }
    },

    clockAltoI: function () {
        switch (this.memoryCycle) {
            case 4:
                // Buffered read of single word
                this.memoryData = this.readFromBus(this.memoryAddress, this.task, this.extendedMemoryReference);
                break;
            case 5:
                // Buffered read of double-word
                this.memoryData2 = this.readFromBus((this.memoryAddress | 1), this.task, this.extendedMemoryReference);
                break;
            case 7:
                // End of memory operation
                this.memoryOperationActive = false;
                this.doubleWordStore = false;
                break;
        }
    },

    clockAltoII: function () {
        switch (this.memoryCycle) {
            case 3:
                this.memoryData = this.readFromBus(this.memoryAddress, this.task, this.extendedMemoryReference);
                break;
            case 4:
                // Buffered read of double-word
                this.memoryData2 = this.readFromBus((this.memoryAddress ^ 1), this.task, this.extendedMemoryReference);
                break;
            case 5:
                this.memoryOperationActive = false;
                this.doubleWordStore = false;
                break;
        }
    },

    ready: function (memoryOperation) {
        if (!this.memoryOperationActive) {
            // Nothing running right now, we're ready for anything
            return true;
        }

        switch (memoryOperation) {
            case MemoryOperation.LOAD_ADDRESS:
                return false;
            case MemoryOperation.READ:
                return this.memoryCycle > 4;
            case MemoryOperation.STORE:
                if (Configuration.systemType === SystemType.ALTO_I) {
                    return this.memoryCycle > 4;
                } else {
                    return this.memoryCycle > 2;
                }
                break;
            default:
                throw "Unexpected memory operation " + memoryOperation;
        }
    },

    loadMAR: function (address, task, extendedMemoryReference) {
        if (this.memoryOperationActive) {
            throw "Invalid LoadMAR request during active memory operation.";
        }

        this.memoryOperationActive = true;
        this.doubleWordStore = false;
        this.doubleWordMixed = false;
        this.memoryAddress = address;
        this.extendedMemoryReference = extendedMemoryReference;
        this.task = task;
        this.memoryCycle = 1;
    },

    readMD: function () {
        if (Configuration.systemType == SystemType.ALTO_I) {
            return this.readMDAltoI();
        } else {
            return this.readMDAltoII();
        }
    },

    readMDAltoI: function () {
        if (!this.memoryOperationActive) {
            return 0xffff;
        }

        switch (this.memoryCycle) {
            case 1:
            case 2:
                // Good microcode should never do this
                throw "Unexpected microcode behavior - readMD too soon after start of memory cycle";
            case 3:
            case 4:
                // This should not happen; CPU should check whether the
                // operation is possible using 'ready()' and stall if not
                throw "Invalid readMD request during cycle 3 or 4 of memory operation";
            case 5:
                // Single word read
                return this.memoryData;
            case 6:
                // Double word read, other half.
                return this.memoryData2;
            default:
                throw("Unexpected memory cycle " + this.memoryCycle + " in" + " memory state machine.");
        }
    },

    readMDAltoII: function () {
        if (this.memoryOperationActive) {
            switch (this.memoryCycle) {
                case 1:
                case 2:
                    // Good microcode should never do this
                    throw "Unexpected microcode behavior - readMD too soon after start of memory cycle";
                case 3:
                case 4:
                    // This should not hapen; CPU should check whether the
                    // operation is possible using 'ready()' and stall if not
                    throw "Invalid readMD request during cycle 3 or 4 of memory operation";
                case 5:
                    // Single word read
                    return this.memoryData;

                // ***
                // NB: Handler for double-word read (cycle 6) is in
                // the "else" clause below; this is kind of a hack.
                // ***

                default:
                    // Invalid state.
                    throw "Unexpected memory cycle " + this.memoryCycle + " in memory state machine.";
            }
        } else {
            // memory state machine not running, just return last
            // latched contents. ("Because the Alto II latches memory
            // contents, it is possible to execute _MD anytime after
            // cycle 5 of a reference and obtain the results of the
            // read operation") If this is memory cycle 6 we will
            // return the last half of the doubleword to complete a
            // double-word read.
            if (this.memoryCycle === 6 || (this.memoryCycle === 5 && this.doubleWordMixed)) {
                this.doubleWordMixed = false;
                return this.memoryData2;
            } else {
                this.doubleWordMixed = false;
                return this.memoryData;
            }
        }
    },

    loadMD: function (data) {
        if (!this.memoryOperationActive) {
            return;
        }

        if (this.systemType == SystemType.ALTO_I) {
            this.loadMDAltoI(data);
        } else {
            this.loadMDAltoII(data);
        }
    },

    loadMDAltoI: function (data) {
        switch (this.memoryCycle) {
            case 1:
            case 2:
            case 3:
            case 4:
                throw "Unexpected microcode behavior -- LoadMD during incorrect memory cycle.";
            case 5:
                this.memoryData = data;
                this.writeToBus(this.memoryAddress, data, this.task,
                                this.extendedMemoryReference);
                this.doubleWordStore = true;
                this.doubleWordMixed = true;
                break;
            case 6:
                if (!this.doubleWordStore) {
                    throw "Unexpected microcode behavior -- LoadMD on cycle 6, no LoadMD on cycle 5";
                }

                this.memoryData = data;

                var actualAddress = this.memoryAddress | 1;

                this.writeToBus(actualAddress, data, this.task,
                                this.extendedMemoryReference);
                break;
        }
    },

    loadMDAltoII: function (data) {
        switch (this.memoryCycle) {
            case 1:
            case 2:
            case 5:
                throw "Unexpected microcode behavior -- LoadMD during incorrect memory cycle.";
            case 3:
                this.memoryData = data;
                this.writeToBus(this.memoryAddress, data, this.task, this.extendedMemoryReference);
                this.doubleWordStore = true;
                this.doubleWordMixed = true;
                break;
            case 4:
                this.memoryData = data;

                var actualAddress = this.doubleWordStore ? this.memoryAddress ^ 1 : this.memoryAddress;

                this.writeToBus(actualAddress, data, this.task, this.extendedMemoryReference);
                break;
        }
    },

    readFromBus: function (address, task, extendedMemoryReference) {
        if (address <= MEM_TOP) {
            return this.mainMemory.read(address, task, extendedMemoryReference);
        }

        var device = this.bus[address];

        if (device === undefined) {
            return 0;
        }

        return device.read(address, task, extendedMemoryReference);
    },

    writeToBus: function (address, data, task, extendedMemoryReference) {
        if (address <= MEM_TOP) {
            this.mainMemory.load(address, data, task, extendedMemoryReference);
            return;
        }

        var device = this.bus[address];

        if (device === undefined) {
            return;
        }

        device.load(address, data, task, extendedMemoryReference);
    }
};
