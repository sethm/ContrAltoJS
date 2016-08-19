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
// Unit Tests for the Alto ROM and decoding
//

QUnit.module("Microcode ROM Tests", {
    beforeEach: function() {
        uCodeMemory.init();
    }
});

QUnit.test("Caches Microcode at start", function(assert) {
    var u;

    // Just pick some at random

    u = uCodeMemory.decodeCache[0];
    assert.ok(u instanceof MicroInstruction);
    assert.equal(u.aluf, AluFunction.BUS);

    u = uCodeMemory.decodeCache[0x100];
    assert.ok(u instanceof MicroInstruction);
    assert.equal(u.aluf, AluFunction.BUS_MINUS_1);

    u = uCodeMemory.decodeCache[0x200];
    assert.ok(u instanceof MicroInstruction);
    assert.equal(u.aluf, AluFunction.BUS);

    u = uCodeMemory.decodeCache[0x300];
    assert.ok(u instanceof MicroInstruction);
    assert.equal(u.aluf, AluFunction.BUS_MINUS_1);

    u = uCodeMemory.decodeCache[0x3ff];
    assert.ok(u instanceof MicroInstruction);
    assert.equal(u.aluf, AluFunction.UNDEFINED_2);
});

QUnit.test("Inits correctly", function(assert) {
    for (var i = 0; i < 16; i++) {
        assert.strictEqual(uCodeMemory.microcodeBank[i], 0);
    }

    assert.strictEqual(uCodeMemory.ramAddr, 0);
    assert.strictEqual(uCodeMemory.ramBank, 0);
    assert.strictEqual(uCodeMemory.ramSelect, true);
    assert.strictEqual(uCodeMemory.lowHalfsel, true);
});

QUnit.test("Sets banks from RMR", function(assert) {
    var rmr = 0x5a5a; // 0101101001011010

    uCodeMemory.loadBanksFromRMR(rmr);

    assert.strictEqual(uCodeMemory.microcodeBank[0], MicrocodeBank.RAM0);
    assert.strictEqual(uCodeMemory.microcodeBank[1], MicrocodeBank.ROM0);
    assert.strictEqual(uCodeMemory.microcodeBank[2], MicrocodeBank.RAM0);
    assert.strictEqual(uCodeMemory.microcodeBank[3], MicrocodeBank.ROM0);

    assert.strictEqual(uCodeMemory.microcodeBank[4], MicrocodeBank.ROM0);
    assert.strictEqual(uCodeMemory.microcodeBank[5], MicrocodeBank.RAM0);
    assert.strictEqual(uCodeMemory.microcodeBank[6], MicrocodeBank.ROM0);
    assert.strictEqual(uCodeMemory.microcodeBank[7], MicrocodeBank.RAM0);

    assert.strictEqual(uCodeMemory.microcodeBank[8], MicrocodeBank.RAM0);
    assert.strictEqual(uCodeMemory.microcodeBank[9], MicrocodeBank.ROM0);
    assert.strictEqual(uCodeMemory.microcodeBank[10], MicrocodeBank.RAM0);
    assert.strictEqual(uCodeMemory.microcodeBank[11], MicrocodeBank.ROM0);

    assert.strictEqual(uCodeMemory.microcodeBank[12], MicrocodeBank.ROM0);
    assert.strictEqual(uCodeMemory.microcodeBank[13], MicrocodeBank.RAM0);
    assert.strictEqual(uCodeMemory.microcodeBank[14], MicrocodeBank.ROM0);
    assert.strictEqual(uCodeMemory.microcodeBank[15], MicrocodeBank.RAM0);
});

QUnit.test("Can get bank", function(assert) {
    var rmr = 0x5a5a; // 0101101001011010
    uCodeMemory.loadBanksFromRMR(rmr);

    assert.strictEqual(uCodeMemory.getBank(TaskType.EMULATOR), MicrocodeBank.RAM0);
    assert.strictEqual(uCodeMemory.getBank(TaskType.DISK_SECTOR), MicrocodeBank.ROM0);
});

QUnit.test("Switches Modes", function(assert) {
    assert.strictEqual(uCodeMemory.getBank(TaskType.EMULATOR), MicrocodeBank.ROM0);
    uCodeMemory.switchMode(0x31f, TaskType.EMULATOR);
    assert.strictEqual(uCodeMemory.getBank(TaskType.EMULATOR), MicrocodeBank.ROM1);
});

QUnit.test("Writes and Reads RAM", function(assert) {
    uCodeMemory.writeRam(0xf234, 0xf678);
    uCodeMemory.lowHalfsel = true;
    assert.strictEqual(uCodeMemory.readRam(), 0xf234);
    uCodeMemory.lowHalfsel = false;
    assert.strictEqual(uCodeMemory.readRam(), 0xf678);
});
