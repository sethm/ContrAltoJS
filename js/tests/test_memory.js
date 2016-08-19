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
    Memory.init();
    Memory.reset();
    assert.strictEqual(Memory.addresses.length, 1);
    assert.strictEqual(Memory.addresses[0].start, 0);
    assert.strictEqual(Memory.addresses[0].end, 0xfdff);
});

QUnit.test("Memory should be inittable - Alto II", function(assert) {
    Configuration.systemType = SystemType.ALTO_II;
    Memory.init();
    Memory.reset();
    assert.strictEqual(Memory.addresses.length, 2);
    assert.strictEqual(Memory.addresses[0].start, 0);
    assert.strictEqual(Memory.addresses[0].end, 0xfdff);
});

QUnit.test("Get Bank Number", function(assert) {
    Memory.init();
    Memory.reset();

    Memory.xmBanks[TaskType.DISK_SECTOR] = 0xd;   // 1101
    assert.strictEqual(Memory.getBankNumber(TaskType.DISK_SECTOR, true), 1);
    assert.strictEqual(Memory.getBankNumber(TaskType.DISK_SECTOR, false), 3);
});

QUnit.test("Read and Write Meory", function(assert) {
    Memory.init();
    Memory.reset();
    Memory.xmBanks[TaskType.DISK_SECTOR] = 5; // 0101 -- bank 1
    Memory.xmBanks[TaskType.ETHERNET] = 10;   // 1010 -- bank 2

    Memory.load(0, 0x5a5a, TaskType.EMULATOR, false);
    assert.strictEqual(Memory.read(0, TaskType.EMULATOR, false),
                       0x5a5a);
    assert.strictEqual(Memory.mem[0], 0x5a5a);

    Memory.load(0xff, 0xa5a5, TaskType.EMULATOR, false);
    assert.strictEqual(Memory.read(0xff, TaskType.EMULATOR, false),
                       0xa5a5);
    assert.strictEqual(Memory.mem[0xff], 0xa5a5);

    // DISK_SECTOR should be in bank 1
    Memory.load(0, 0x1234, TaskType.DISK_SECTOR, false);
    assert.strictEqual(Memory.read(0, TaskType.DISK_SECTOR, false),
                       0x1234);
    assert.strictEqual(Memory.mem[0x10000], 0x1234);

    // ETHERNET should be in bank 2
    Memory.load(0, 0xabcd, TaskType.ETHERNET, false);
    assert.strictEqual(Memory.read(0, TaskType.ETHERNET, false),
                       0xabcd);
    assert.strictEqual(Memory.mem[0x20000], 0xabcd);
});

QUnit.module("MemoryBus Tests", {
    beforeEach: function() {
        Configuration.systemType = SystemType.ALTO_II;
        Memory.init();
        Memory.reset();
        MemoryBus.reset();
    }
});

QUnit.test("Ready returns true if no memoryOperation active", function(assert) {
    MemoryBus.memoryOperationActive = false;
    assert.strictEqual(MemoryBus.ready(MemoryOperation.LOAD_ADDRESS), true);
});

QUnit.test("Ready returns false if Load Address during active", function(assert) {
    MemoryBus.memoryOperationActive = true;
    assert.strictEqual(MemoryBus.ready(MemoryOperation.LOAD_ADDRESS), false);
});

QUnit.test("Ready returns false if Read with memorycycle <= 4 during active", function(assert) {
    MemoryBus.memoryOperationActive = true;

    MemoryBus.memoryCycle = 0;
    assert.strictEqual(MemoryBus.ready(MemoryOperation.READ), false);

    MemoryBus.memoryCycle = 1;
    assert.strictEqual(MemoryBus.ready(MemoryOperation.READ), false);

    MemoryBus.memoryCycle = 2;
    assert.strictEqual(MemoryBus.ready(MemoryOperation.READ), false);

    MemoryBus.memoryCycle = 3;
    assert.strictEqual(MemoryBus.ready(MemoryOperation.READ), false);

    MemoryBus.memoryCycle = 4;
    assert.strictEqual(MemoryBus.ready(MemoryOperation.READ), false);

    MemoryBus.memoryCycle = 5;
    assert.strictEqual(MemoryBus.ready(MemoryOperation.READ), true);
});

QUnit.test("Ready returns false if Store with memorycycle <= 4 during active (Alto I)", function(assert) {
    MemoryBus.memoryOperationActive = true;
    Configuration.systemType = SystemType.ALTO_I;

    MemoryBus.memoryCycle = 0;
    assert.strictEqual(MemoryBus.ready(MemoryOperation.STORE), false);

    MemoryBus.memoryCycle = 1;
    assert.strictEqual(MemoryBus.ready(MemoryOperation.STORE), false);

    MemoryBus.memoryCycle = 2;
    assert.strictEqual(MemoryBus.ready(MemoryOperation.STORE), false);

    MemoryBus.memoryCycle = 3;
    assert.strictEqual(MemoryBus.ready(MemoryOperation.STORE), false);

    MemoryBus.memoryCycle = 4;
    assert.strictEqual(MemoryBus.ready(MemoryOperation.STORE), false);

    MemoryBus.memoryCycle = 5;
    assert.strictEqual(MemoryBus.ready(MemoryOperation.STORE), true);
});

QUnit.test("Ready returns false if Store with memorycycle <= 2 during active (Alto II)", function(assert) {
    MemoryBus.memoryOperationActive = true;
    Configuration.systemType = SystemType.ALTO_II;

    MemoryBus.memoryCycle = 0;
    assert.strictEqual(MemoryBus.ready(MemoryOperation.STORE), false);

    MemoryBus.memoryCycle = 1;
    assert.strictEqual(MemoryBus.ready(MemoryOperation.STORE), false);

    MemoryBus.memoryCycle = 2;
    assert.strictEqual(MemoryBus.ready(MemoryOperation.STORE), false);

    MemoryBus.memoryCycle = 3;
    assert.strictEqual(MemoryBus.ready(MemoryOperation.STORE), true);
});

QUnit.test("Ready throws if unknown type", function(assert) {
    MemoryBus.memoryOperationActive = true;
    assert.throws(function() {
        MemoryBus.ready(MemoryOperation.NONE);
    }, /Unexpected memory operation/);
});

QUnit.test("LoadMAR throws if memory operation active", function(assert) {
    MemoryBus.memoryOperationActive = true;
    assert.throws(function() {
        MemoryBus.loadMAR(0, TaskType.EMULATOR, true);
    }, /Invalid LoadMAR request during active memory operation/);
});


QUnit.test("LoadMAR sets extendedMemoryReference", function(assert) {
    MemoryBus.memoryOperationActive = false;

    MemoryBus.loadMAR(0, TaskType.EMULATOR, true);
    assert.strictEqual(MemoryBus.extendedMemoryReference, true);

    MemoryBus.loadMAR(0, TaskType.EMULATOR, false);
    assert.strictEqual(MemoryBus.extendedMemoryReference, false);
});

QUnit.test("LoadMAR sets internal state", function(assert) {
    MemoryBus.memoryOperationActive = false;

    MemoryBus.loadMAR(0xf1e1, TaskType.DISK_SECTOR, true);
    assert.strictEqual(MemoryBus.extendedMemoryReference, true);

    assert.strictEqual(MemoryBus.doubleWordStore, false);
    assert.strictEqual(MemoryBus.doubleWordMixed, false);
    assert.strictEqual(MemoryBus.memoryAddress, 0xf1e1);
    assert.strictEqual(MemoryBus.task, TaskType.DISK_SECTOR);
    assert.strictEqual(MemoryBus.memoryCycle, 1);
});

QUnit.test("ReadMD returns 0xffff if not in memory operation - Alto I", function(assert) {
    Configuration.systemType = SystemType.ALTO_I;
    MemoryBus.memoryOperationActive = false;

    assert.strictEqual(MemoryBus.readMD(), 0xffff);
});

QUnit.test("ReadMD throws if memorycycle too low - Alto I", function(assert) {
    Configuration.systemType = SystemType.ALTO_I;
    MemoryBus.memoryOperationActive = true;

    MemoryBus.memoryCycle = 1;
    assert.throws(function() {
        MemoryBus.readMD();
    }, /Unexpected microcode behavior/);

    MemoryBus.memoryCycle = 2;
    assert.throws(function() {
        MemoryBus.readMD();
    }, /Unexpected microcode behavior/);

    MemoryBus.memoryCycle = 3;
    assert.throws(function() {
        MemoryBus.readMD();
    }, /Invalid readMD request during cycle 3 or 4/);

    MemoryBus.memoryCycle = 4;
    assert.throws(function() {
        MemoryBus.readMD();
    }, /Invalid readMD request during cycle 3 or 4/);
});

QUnit.test("ReadMD returns memoryData - Alto I", function(assert) {
    Configuration.systemType = SystemType.ALTO_I;
    MemoryBus.memoryOperationActive = true;
    MemoryBus.memoryCycle = 5;
    MemoryBus.memoryData = 0x1e35;
    assert.strictEqual(MemoryBus.readMD(), 0x1e35);
});

QUnit.test("ReadMD returns memoryData2 - Alto I", function(assert) {
    Configuration.systemType = SystemType.ALTO_I;
    MemoryBus.memoryOperationActive = true;
    MemoryBus.memoryCycle = 6;
    MemoryBus.memoryData = 0x1e35;
    MemoryBus.memoryData2 = 0xa5e5;
    assert.strictEqual(MemoryBus.readMD(), 0xa5e5);
});

QUnit.test("ReadMD throws if memorycycle too low - Alto II", function(assert) {
    Configuration.systemType = SystemType.ALTO_II;
    MemoryBus.memoryOperationActive = true;

    MemoryBus.memoryCycle = 1;
    assert.throws(function() {
        MemoryBus.readMD();
    }, /Unexpected microcode behavior/);

    MemoryBus.memoryCycle = 2;
    assert.throws(function() {
        MemoryBus.readMD();
    }, /Unexpected microcode behavior/);

    MemoryBus.memoryCycle = 3;
    assert.throws(function() {
        MemoryBus.readMD();
    }, /Invalid readMD request during cycle 3 or 4/);

    MemoryBus.memoryCycle = 4;
    assert.throws(function() {
        MemoryBus.readMD();
    }, /Invalid readMD request during cycle 3 or 4/);
});

QUnit.test("ReadMD throws if memorycycle is 6 - Alto II", function(assert) {
    // Unlike the Alto I, if memoryOperationActive is true and we reach
    // memory cycle 6, we should error.

    Configuration.systemType = SystemType.ALTO_II;
    MemoryBus.memoryOperationActive = true;
    MemoryBus.memoryCycle = 6;

    assert.throws(function() {
        MemoryBus.readMD();
    }, /Unexpected memory cycle 6 in memory state machine/);
});

QUnit.test("ReadMD returns memoryData - Alto II", function(assert) {
    Configuration.systemType = SystemType.ALTO_II;
    MemoryBus.memoryOperationActive = true;
    MemoryBus.memoryCycle = 5;
    MemoryBus.memoryData = 0x1e35;
    assert.strictEqual(MemoryBus.readMD(), 0x1e35);
});

QUnit.test("ReadMD returns memoryData2 doubleWordMixed - Alto II", function(assert) {
    Configuration.systemType = SystemType.ALTO_II;
    MemoryBus.memoryOperationActive = false;
    MemoryBus.memoryCycle = 5;
    MemoryBus.memoryData = 0x1e35;
    MemoryBus.memoryData2 = 0xf1ef;
    MemoryBus.doubleWordMixed = true;
    assert.strictEqual(MemoryBus.readMD(), 0xf1ef);

    // Should have been set to false.
    assert.strictEqual(MemoryBus.doubleWordMixed, false);
});

QUnit.test("ReadMD returns memoryData2 - Alto II", function(assert) {
    Configuration.systemType = SystemType.ALTO_II;
    MemoryBus.memoryOperationActive = false;
    MemoryBus.memoryCycle = 6;
    MemoryBus.memoryData = 0x1e35;
    MemoryBus.memoryData2 = 0xa5e5;
    MemoryBus.doubleWordMixed = true;
    assert.strictEqual(MemoryBus.readMD(), 0xa5e5);
    // Should have been set to false.
    assert.strictEqual(MemoryBus.doubleWordMixed, false);
});

QUnit.test("Adds main memory to bus", function(assert) {
    MemoryBus.addDevice(Memory);

    // Main memory
    assert.equal(Memory.addresses[0].start, 0);
    assert.equal(Memory.addresses[0].end, 0xfdff);

    // Extended memory bank registers
    assert.equal(Memory.addresses[1].start, 0xffe0);
    assert.equal(Memory.addresses[1].end, 0xfff0);

    // Let's just check the first 16 slots to make sure they're filled.
    for (var i = 0; i <= 0xf; i++) {
        assert.strictEqual(MemoryBus.bus[i], Memory);
    }
});
