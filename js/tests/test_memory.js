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


//
// Unit Tests for the Alto memory bus and memory store
//

QUnit.module("MemoryRange Tests", {
});

QUnit.test("MemoryRange overlap", function(assert) {
    var a = new MemoryRange(0, 100);
    var b = new MemoryRange(99, 200);
    var c = new MemoryRange(101, 200);

    assert.strictEqual(a.overlaps(b), true);
    assert.strictEqual(a.overlaps(c), false);
});

QUnit.module("Memory Tests", {
});

QUnit.test("Memory should be inittable - Alto I", function(assert) {
    Configuration.systemType = SystemType.ALTO_I;
    memory.init();
    memory.reset();
    assert.strictEqual(memory.addresses.length, 1);
    assert.strictEqual(memory.addresses[0].start, 0);
    assert.strictEqual(memory.addresses[0].end, 0xfdff);
});

QUnit.test("Memory should be inittable - Alto II", function(assert) {
    Configuration.systemType = SystemType.TWO_K_ROM;
    memory.init();
    memory.reset();
    assert.strictEqual(memory.addresses.length, 2);
    assert.strictEqual(memory.addresses[0].start, 0);
    assert.strictEqual(memory.addresses[0].end, 0xfdff);
});

QUnit.test("Get Bank Number", function(assert) {
    memory.init();
    memory.reset();

    memory.xmBanks[TaskType.DISK_SECTOR] = 0xd;   // 1101
    assert.strictEqual(memory.getBankNumber(TaskType.DISK_SECTOR, true), 1);
    assert.strictEqual(memory.getBankNumber(TaskType.DISK_SECTOR, false), 3);
});

QUnit.test("Read and Write Meory", function(assert) {
    memory.init();
    memory.reset();
    memory.xmBanks[TaskType.DISK_SECTOR] = 5; // 0101 -- bank 1
    memory.xmBanks[TaskType.ETHERNET] = 10;   // 1010 -- bank 2

    memory.load(0, 0x5a5a, TaskType.EMULATOR, false);
    assert.strictEqual(memory.read(0, TaskType.EMULATOR, false),
                       0x5a5a);
    assert.strictEqual(memory.mem[0], 0x5a5a);

    memory.load(0xff, 0xa5a5, TaskType.EMULATOR, false);
    assert.strictEqual(memory.read(0xff, TaskType.EMULATOR, false),
                       0xa5a5);
    assert.strictEqual(memory.mem[0xff], 0xa5a5);

    // DISK_SECTOR should be in bank 1
    memory.load(0, 0x1234, TaskType.DISK_SECTOR, false);
    assert.strictEqual(memory.read(0, TaskType.DISK_SECTOR, false),
                       0x1234);
    assert.strictEqual(memory.mem[0x10000], 0x1234);

    // ETHERNET should be in bank 2
    memory.load(0, 0xabcd, TaskType.ETHERNET, false);
    assert.strictEqual(memory.read(0, TaskType.ETHERNET, false),
                       0xabcd);
    assert.strictEqual(memory.mem[0x20000], 0xabcd);
});

QUnit.module("Memory Bus Tests", {
    beforeEach: function() {
        Configuration.systemType = SystemType.TWO_K_ROM;
        memory.init();
        memory.reset();
        memoryBus.reset();
        memoryBus.bus = {}; // Clear off the old bus
    }
});

QUnit.test("Ready returns true if no memoryOperation active", function(assert) {
    memoryBus.memoryOperationActive = false;
    assert.strictEqual(memoryBus.ready(MemoryOperation.LOAD_ADDRESS), true);
});

QUnit.test("Ready returns false if Load Address during active", function(assert) {
    memoryBus.memoryOperationActive = true;
    assert.strictEqual(memoryBus.ready(MemoryOperation.LOAD_ADDRESS), false);
});

QUnit.test("Ready returns false if Read with memorycycle <= 4 during active", function(assert) {
    memoryBus.memoryOperationActive = true;

    memoryBus.memoryCycle = 0;
    assert.strictEqual(memoryBus.ready(MemoryOperation.READ), false);

    memoryBus.memoryCycle = 1;
    assert.strictEqual(memoryBus.ready(MemoryOperation.READ), false);

    memoryBus.memoryCycle = 2;
    assert.strictEqual(memoryBus.ready(MemoryOperation.READ), false);

    memoryBus.memoryCycle = 3;
    assert.strictEqual(memoryBus.ready(MemoryOperation.READ), false);

    memoryBus.memoryCycle = 4;
    assert.strictEqual(memoryBus.ready(MemoryOperation.READ), false);

    memoryBus.memoryCycle = 5;
    assert.strictEqual(memoryBus.ready(MemoryOperation.READ), true);
});

QUnit.test("Ready returns false if Store with memorycycle <= 4 during active (Alto I)", function(assert) {
    memoryBus.memoryOperationActive = true;
    Configuration.systemType = SystemType.ALTO_I;

    memoryBus.memoryCycle = 0;
    assert.strictEqual(memoryBus.ready(MemoryOperation.STORE), false);

    memoryBus.memoryCycle = 1;
    assert.strictEqual(memoryBus.ready(MemoryOperation.STORE), false);

    memoryBus.memoryCycle = 2;
    assert.strictEqual(memoryBus.ready(MemoryOperation.STORE), false);

    memoryBus.memoryCycle = 3;
    assert.strictEqual(memoryBus.ready(MemoryOperation.STORE), false);

    memoryBus.memoryCycle = 4;
    assert.strictEqual(memoryBus.ready(MemoryOperation.STORE), false);

    memoryBus.memoryCycle = 5;
    assert.strictEqual(memoryBus.ready(MemoryOperation.STORE), true);
});

QUnit.test("Ready returns false if Store with memorycycle <= 2 during active (Alto II)", function(assert) {
    memoryBus.memoryOperationActive = true;
    Configuration.systemType = SystemType.TWO_K_ROM;

    memoryBus.memoryCycle = 0;
    assert.strictEqual(memoryBus.ready(MemoryOperation.STORE), false);

    memoryBus.memoryCycle = 1;
    assert.strictEqual(memoryBus.ready(MemoryOperation.STORE), false);

    memoryBus.memoryCycle = 2;
    assert.strictEqual(memoryBus.ready(MemoryOperation.STORE), false);

    memoryBus.memoryCycle = 3;
    assert.strictEqual(memoryBus.ready(MemoryOperation.STORE), true);
});

QUnit.test("Ready throws if unknown type", function(assert) {
    memoryBus.memoryOperationActive = true;
    assert.throws(function() {
        memoryBus.ready(MemoryOperation.NONE);
    }, /Unexpected memory operation/);
});

QUnit.test("LoadMAR throws if memory operation active", function(assert) {
    memoryBus.memoryOperationActive = true;
    assert.throws(function() {
        memoryBus.loadMAR(0, TaskType.EMULATOR, true);
    }, /Invalid LoadMAR request during active memory operation/);
});


QUnit.test("LoadMAR sets extendedMemoryReference", function(assert) {
    memoryBus.memoryOperationActive = false;
    memoryBus.loadMAR(0, TaskType.EMULATOR, true);
    assert.strictEqual(memoryBus.extendedMemoryReference, true);

    memoryBus.memoryOperationActive = false;
    memoryBus.loadMAR(0, TaskType.EMULATOR, false);
    assert.strictEqual(memoryBus.extendedMemoryReference, false);
});

QUnit.test("LoadMAR sets internal state", function(assert) {
    memoryBus.memoryOperationActive = false;

    memoryBus.loadMAR(0xf1e1, TaskType.DISK_SECTOR, true);
    assert.strictEqual(memoryBus.extendedMemoryReference, true);

    assert.strictEqual(memoryBus.doubleWordStore, false);
    assert.strictEqual(memoryBus.doubleWordMixed, false);
    assert.strictEqual(memoryBus.memoryAddress, 0xf1e1);
    assert.strictEqual(memoryBus.task, TaskType.DISK_SECTOR);
    assert.strictEqual(memoryBus.memoryCycle, 1);
});

QUnit.test("ReadMD returns 0xffff if not in memory operation - Alto I", function(assert) {
    Configuration.systemType = SystemType.ALTO_I;
    memoryBus.memoryOperationActive = false;

    assert.strictEqual(memoryBus.readMD(), 0xffff);
});

QUnit.test("ReadMD throws if memorycycle too low - Alto I", function(assert) {
    Configuration.systemType = SystemType.ALTO_I;
    memoryBus.memoryOperationActive = true;

    memoryBus.memoryCycle = 1;
    assert.throws(function() {
        memoryBus.readMD();
    }, /Unexpected microcode behavior/);

    memoryBus.memoryCycle = 2;
    assert.throws(function() {
        memoryBus.readMD();
    }, /Unexpected microcode behavior/);

    memoryBus.memoryCycle = 3;
    assert.throws(function() {
        memoryBus.readMD();
    }, /Invalid readMD request during cycle 3 or 4/);

    memoryBus.memoryCycle = 4;
    assert.throws(function() {
        memoryBus.readMD();
    }, /Invalid readMD request during cycle 3 or 4/);
});

QUnit.test("ReadMD returns memoryData - Alto I", function(assert) {
    Configuration.systemType = SystemType.ALTO_I;
    memoryBus.memoryOperationActive = true;
    memoryBus.memoryCycle = 5;
    memoryBus.memoryData = 0x1e35;
    assert.strictEqual(memoryBus.readMD(), 0x1e35);
});

QUnit.test("ReadMD returns memoryData2 - Alto I", function(assert) {
    Configuration.systemType = SystemType.ALTO_I;
    memoryBus.memoryOperationActive = true;
    memoryBus.memoryCycle = 6;
    memoryBus.memoryData = 0x1e35;
    memoryBus.memoryData2 = 0xa5e5;
    assert.strictEqual(memoryBus.readMD(), 0xa5e5);
});

QUnit.test("ReadMD throws if memorycycle too low - Alto II", function(assert) {
    Configuration.systemType = SystemType.TWO_K_ROM;
    memoryBus.memoryOperationActive = true;

    memoryBus.memoryCycle = 1;
    assert.throws(function() {
        memoryBus.readMD();
    }, /Unexpected microcode behavior/);

    memoryBus.memoryCycle = 2;
    assert.throws(function() {
        memoryBus.readMD();
    }, /Unexpected microcode behavior/);

    memoryBus.memoryCycle = 3;
    assert.throws(function() {
        memoryBus.readMD();
    }, /Invalid readMD request during cycle 3 or 4/);

    memoryBus.memoryCycle = 4;
    assert.throws(function() {
        memoryBus.readMD();
    }, /Invalid readMD request during cycle 3 or 4/);
});

QUnit.test("ReadMD throws if memorycycle is 6 - Alto II", function(assert) {
    // Unlike the Alto I, if memoryOperationActive is true and we reach
    // memory cycle 6, we should error.

    Configuration.systemType = SystemType.TWO_K_ROM;
    memoryBus.memoryOperationActive = true;
    memoryBus.memoryCycle = 6;

    assert.throws(function() {
        memoryBus.readMD();
    }, /Unexpected memory cycle 6 in memory state machine/);
});

QUnit.test("ReadMD returns memoryData - Alto II", function(assert) {
    Configuration.systemType = SystemType.TWO_K_ROM;
    memoryBus.memoryOperationActive = true;
    memoryBus.memoryCycle = 5;
    memoryBus.memoryData = 0x1e35;
    assert.strictEqual(memoryBus.readMD(), 0x1e35);
});

QUnit.test("ReadMD returns memoryData2 doubleWordMixed - Alto II", function(assert) {
    Configuration.systemType = SystemType.TWO_K_ROM;
    memoryBus.memoryOperationActive = false;
    memoryBus.memoryCycle = 5;
    memoryBus.memoryData = 0x1e35;
    memoryBus.memoryData2 = 0xf1ef;
    memoryBus.doubleWordMixed = true;
    assert.strictEqual(memoryBus.readMD(), 0xf1ef);

    // Should have been set to false.
    assert.strictEqual(memoryBus.doubleWordMixed, false);
});

QUnit.test("ReadMD returns memoryData2 - Alto II", function(assert) {
    Configuration.systemType = SystemType.TWO_K_ROM;
    memoryBus.memoryOperationActive = false;
    memoryBus.memoryCycle = 6;
    memoryBus.memoryData = 0x1e35;
    memoryBus.memoryData2 = 0xa5e5;
    memoryBus.doubleWordMixed = true;
    assert.strictEqual(memoryBus.readMD(), 0xa5e5);
    // Should have been set to false.
    assert.strictEqual(memoryBus.doubleWordMixed, false);
});

QUnit.test("Adds main memory to bus", function(assert) {
    memoryBus.addDevice(memory);

    // Main memory
    assert.equal(memory.addresses[0].start, 0);
    assert.equal(memory.addresses[0].end, 0xfdff);

    // Extended memory bank registers
    assert.equal(memory.addresses[1].start, 0xffe0);
    assert.equal(memory.addresses[1].end, 0xfff0);

    // Let's just check the first 16 slots to make sure they're filled.
    for (var i = 0; i <= 0xf; i++) {
        assert.strictEqual(memoryBus.bus[i], memory);
    }
});

QUnit.test("Writes and Reads from bus", function(assert) {
    var mockDevice = {
        writeData: 0,
        writeAddress: 0,

        addresses: [
            new MemoryRange(0xfffe, 0xffff)
        ],

        read: function(address, task, xmr) {
            return this.writeData;
        },

        load: function(address, data, task, xmr) {
            this.writeData = data;
            this.writeAddress = address;
        }
    };

    memoryBus.addDevice(memory);
    memoryBus.addDevice(mockDevice);

    memoryBus.writeToBus(0x0f1f, 0x5a5a, TaskType.EMULATOR, false);

    assert.equal(memoryBus.readFromBus(0x0f1f, TaskType.EMULATOR, false),
                 0x5a5a);

    memoryBus.writeToBus(0xfffe, 0xabcd, TaskType.EMULATOR, false);
    assert.equal(mockDevice.writeData, 0xabcd);
    assert.equal(mockDevice.writeAddress, 0xfffe);
    assert.equal(memoryBus.readFromBus(0xfffe, TaskType.EMULATOR, false),
                 0xabcd);
});
