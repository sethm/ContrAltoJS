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
    NONE:          0,
    LOAD_ADDRESS:  1,
    READ:          2,
    STORE:         3
};

var MemoryBus = {
    memoryCycle: 0,
    memoryAddress: 0,
    memoryData: 0,
    doubleWordStore: false,
    doubleWordMixed: false,
    memoryOperationActive: false,
    extendedMemoryReference: false,
    bus: {},

    reset: function() {
        this.memoryCycle = 0;
        this.memoryAddress = 0;
        this.memoryCycle = 0;
        this.memoryAddress = 0;
        this.memoryData = 0;
        this.doubleWordStore = false;
        this.doubleWordMixed = false;
        this.memoryOperationActive = false;
        this.extendedMemoryReference = false;
    },

    addDevice: function(dev) {
        // TODO: Implement
    },

    clock: function() {
        // TODO: Implement
    },

    clockAltoI: function() {
        // TODO: Implement
    },

    clockAltoII: function() {
        // TODO: Implement
    },

    ready: function(memoryOperation) {
        if (this.memoryOperationActive) {
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

            default:
                throw "Unexpected memory operation " + memoryOperation;
            }
        } else {
            // Nothing running right now, we're ready for anything
            return true;
        }
    },

    loadMAR: function(address, task, extendedMemoryReference) {
        if (this.memoryOperationActive) {
            throw "Invalid LoadMAR request during active memory operation.";
        }

        this.memoryOperationActive = false;
        this.doubleWordStore = false;
        this.doubleWordMixed = false;
        this.memoryAddress = address;
        this.extendedMemoryReference = extendedMemoryReference;
        this.task = task;
        this.memoryCycle = 1;
    }

};
