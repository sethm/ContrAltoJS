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
QUnit.module("MemoryBus Tests", {
    beforeEach: function() {
        Configuration.systemType = SystemType.ALTO_II;
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
