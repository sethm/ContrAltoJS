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
// Unit Tests for the Alto CPU
//


// ----------------------------------------------------------------------
// ALU Tests

QUnit.module("ALU Tests", {
    beforeEach: function() {
        alu.reset();
    }
});

QUnit.test("ALU Reset clears carry", function(assert) {
    alu.carry = 1;
    assert.strictEqual(alu.carry, 1);

    alu.reset();
    assert.strictEqual(alu.carry, 0);
});

QUnit.test("ALU BUS", function(assert) {
    assert.strictEqual(alu.execute(AluFunction.BUS, 12, 0, 0), 12);
    assert.strictEqual(alu.carry, 0);
});

QUnit.test("ALU T", function(assert) {
    assert.strictEqual(alu.execute(AluFunction.T, 0, 8, 0), 8);
    assert.strictEqual(alu.carry, 0);
});

QUnit.test("ALU BUS_OR_T", function(assert) {
    assert.strictEqual(alu.execute(AluFunction.BUS_OR_T, 5, 0xa, 0), 0xf);
    assert.strictEqual(alu.execute(AluFunction.BUS_OR_T, 3, 0xc, 0), 0xf);
    assert.strictEqual(alu.execute(AluFunction.BUS_OR_T, 2, 5, 0), 7);
    assert.strictEqual(alu.carry, 0);
});

QUnit.test("ALU BUS_AND_T", function(assert) {
    assert.strictEqual(alu.execute(AluFunction.BUS_AND_T, 5, 0xa, 0), 0);
    assert.strictEqual(alu.execute(AluFunction.BUS_AND_T, 0xa, 5, 0), 0);
    assert.strictEqual(alu.execute(AluFunction.BUS_AND_T, 0xc, 7, 0), 4);
    assert.strictEqual(alu.execute(AluFunction.BUS_AND_T, 6, 0xf, 0), 6);
    assert.strictEqual(alu.carry, 0);
});

QUnit.test("ALU ALU_BUS_AND_T", function(assert) {
    assert.strictEqual(alu.execute(AluFunction.ALU_BUS_AND_T, 5, 0xa, 0), 0);
    assert.strictEqual(alu.execute(AluFunction.ALU_BUS_AND_T, 0xa, 5, 0), 0);
    assert.strictEqual(alu.execute(AluFunction.ALU_BUS_AND_T, 0xc, 7, 0), 4);
    assert.strictEqual(alu.execute(AluFunction.ALU_BUS_AND_T, 6, 0xf, 0), 6);
    assert.strictEqual(alu.carry, 0);
});

QUnit.test("ALU BUS_XOR_T", function(assert) {
    assert.strictEqual(alu.execute(AluFunction.BUS_XOR_T, 0xa, 0xf, 0), 5);
    assert.strictEqual(alu.execute(AluFunction.BUS_XOR_T, 0xf, 0xf, 0), 0);
    assert.strictEqual(alu.execute(AluFunction.BUS_XOR_T, 3, 7, 0), 4);
    assert.strictEqual(alu.execute(AluFunction.BUS_XOR_T, 7, 3, 0), 4);
    assert.strictEqual(alu.carry, 0);
});

QUnit.test("ALU BUS_PLUS_1", function(assert) {
    assert.strictEqual(alu.execute(AluFunction.BUS_PLUS_1, 0xe, 0, 0), 0xf);
    assert.strictEqual(alu.carry, 0);

    // Carry should work.
    assert.strictEqual(alu.execute(AluFunction.BUS_PLUS_1, 0xfffe, 0, 0), 0xffff);
    assert.strictEqual(alu.carry, 0);
    assert.strictEqual(alu.execute(AluFunction.BUS_PLUS_1, 0xffff, 0, 0), 0);
    assert.strictEqual(alu.carry, 1);
});

QUnit.test("ALU BUS_MINUS_1", function(assert) {
    assert.strictEqual(alu.execute(AluFunction.BUS_MINUS_1, 0xf, 0, 0), 0xe);

    // Subtraction carry is reversed from intuition!
    assert.strictEqual(alu.carry, 1);

    // Carry should work.
    assert.strictEqual(alu.execute(AluFunction.BUS_MINUS_1, 1, 0, 0), 0);
    assert.strictEqual(alu.carry, 1);
    assert.strictEqual(alu.execute(AluFunction.BUS_MINUS_1, 0, 0, 0), 0xffff);
    assert.strictEqual(alu.carry, 0);
});

QUnit.test("ALU BUS_PLUS_T", function(assert) {
    assert.strictEqual(alu.execute(AluFunction.BUS_PLUS_T, 0xe, 0xa, 0), 0x18);
    assert.strictEqual(alu.carry, 0);

    // Carry should work.
    assert.strictEqual(alu.execute(AluFunction.BUS_PLUS_T, 0xfffe, 1, 0), 0xffff);
    assert.strictEqual(alu.carry, 0);
    assert.strictEqual(alu.execute(AluFunction.BUS_PLUS_T, 0xffff, 1, 0), 0);
    assert.strictEqual(alu.carry, 1);
});

QUnit.test("ALU BUS_MINUS_T", function(assert) {
    assert.strictEqual(alu.execute(AluFunction.BUS_MINUS_T, 0xf, 1, 0), 0xe);

    // Subtraction carry is reversed from intuition!
    assert.strictEqual(alu.carry, 1);

    assert.strictEqual(alu.execute(AluFunction.BUS_MINUS_T, 0xffff, 0xf, 0), 0xfff0);
    assert.strictEqual(alu.carry, 1);

    // Carry should work.
    assert.strictEqual(alu.execute(AluFunction.BUS_MINUS_T, 1, 1, 0), 0);
    assert.strictEqual(alu.carry, 1);
    assert.strictEqual(alu.execute(AluFunction.BUS_MINUS_T, 0, 1, 0), 0xffff);
    assert.strictEqual(alu.carry, 0);
});

QUnit.test("ALU BUS_MINUS_T_MINUS_1", function(assert) {
    assert.strictEqual(alu.execute(AluFunction.BUS_MINUS_T_MINUS_1, 0xf, 1, 0), 0xd);

    // Subtraction carry is reversed from intuition!
    assert.strictEqual(alu.carry, 1);
    assert.strictEqual(alu.execute(AluFunction.BUS_MINUS_T_MINUS_1, 0xffff, 0xf, 0), 0xffef);
    assert.strictEqual(alu.carry, 1);

    // Carry should work.
    assert.strictEqual(alu.execute(AluFunction.BUS_MINUS_T_MINUS_1, 2, 1, 0), 0);
    assert.strictEqual(alu.carry, 1);
    assert.strictEqual(alu.execute(AluFunction.BUS_MINUS_T_MINUS_1, 1, 1, 0), 0xffff);
    assert.strictEqual(alu.carry, 0);
});

QUnit.test("ALU BUS_PLUS_T_PLUS_1", function(assert) {
    assert.strictEqual(alu.execute(AluFunction.BUS_PLUS_T_PLUS_1, 0xe, 0xa, 0), 25);
    assert.strictEqual(alu.carry, 0);

    // Carry should work.
    assert.strictEqual(alu.execute(AluFunction.BUS_PLUS_T_PLUS_1, 0xfffd, 1, 0), 0xffff);
    assert.strictEqual(alu.carry, 0);
    assert.strictEqual(alu.execute(AluFunction.BUS_PLUS_T_PLUS_1, 0xfffe, 1, 0), 0);
    assert.strictEqual(alu.carry, 1);
});

QUnit.test("ALU BUS_PLUS_SKIP", function(assert) {
    assert.strictEqual(alu.execute(AluFunction.BUS_PLUS_SKIP, 0xe, 0, 0xa), 0x18);
    assert.strictEqual(alu.carry, 0);

    // Carry should work.
    assert.strictEqual(alu.execute(AluFunction.BUS_PLUS_SKIP, 0xfffe, 0, 1), 0xffff);
    assert.strictEqual(alu.carry, 0);
    assert.strictEqual(alu.execute(AluFunction.BUS_PLUS_SKIP, 0xffff, 0, 1), 0);
    assert.strictEqual(alu.carry, 1);
});

QUnit.test("ALU BUS_AND_NOT_T", function(assert) {
    assert.strictEqual(alu.execute(AluFunction.BUS_AND_NOT_T, 5, 3, 0), 4);
    assert.strictEqual(alu.execute(AluFunction.BUS_AND_NOT_T, 0xf13a, 0x2038), 0xd102);

    assert.strictEqual(alu.carry, 0);
});


QUnit.test("ALU Unimplemented Function", function(assert) {
    // '99' is not an implemented function
    assert.throws(
        function() {
            alu.execute(99, 12, 8, 1);
        },
            /Unimplemented Function/,
        "raised 'Unimplemented Function'"
    );
});

// ----------------------------------------------------------------------
// CPU Tests

QUnit.module("CPU Tests", {
    beforeEach: function() {
        cpu.reset();
    }
});

QUnit.test("CPU Reset", function(assert) {
    var i, j;

    assert.strictEqual(cpu.r.length, 32);

    for (i = 0; i < cpu.r.length; i++) {
        assert.strictEqual(cpu.r[i], 0);
    }

    assert.strictEqual(cpu.s.length, 8);

    for (i = 0; i < cpu.s.length; i++) {
        assert.ok(cpu.s[i] instanceof Array, "s[i] is an array");
        assert.strictEqual(cpu.s[i].length, 32);

        for (j = 0; j < cpu.s[i].length; j++) {
            assert.strictEqual(cpu.s[i][j], 0);
        }
    }

    assert.strictEqual(cpu.t, 0);
    assert.strictEqual(cpu.l, 0);
    assert.strictEqual(cpu.m, 0);
    assert.strictEqual(cpu.ir, 0);

    assert.strictEqual(cpu.aluC0, 0);

    assert.strictEqual(cpu.rmr, 0xffff);

    // We should have switched in a current task.
    assert.ok(cpu.currentTask);
    assert.notOk(cpu.nextTask);
});

QUnit.test("CPU Reset calls taskSwitch", function(assert) {
    var taskSwitchCalled = false;

    doWithMock(cpu, "taskSwitch", function() {
        taskSwitchCalled = true;
    }, function() {
        cpu.reset();
        assert.strictEqual(taskSwitchCalled, true);
    });
});

QUnit.test("CPU Clock", function(assert) {
    var executeNextCalled = false;

    doWithMock(emulatorTask, "executeNext", function() {
        executeNextCalled = true;
    }, function() {
        cpu.reset();
        cpu.clock();
        assert.strictEqual(executeNextCalled, true);
    });
});

// ----------------------------------------------------------------------
// MicroInstruction Tests

QUnit.module("MicroInstruction Tests", {});

QUnit.test("Parses rselect", function(assert) {
    var u;

    u = new MicroInstruction(0x07ffffff);
    assert.strictEqual(u.rselect, 0);

    u = new MicroInstruction(0x0fffffff);
    assert.strictEqual(u.rselect, 1);

    u = new MicroInstruction(0x7fffffff);
    assert.strictEqual(u.rselect, 15);

    u = new MicroInstruction(0xffffffff);
    assert.strictEqual(u.rselect, 31);
});

QUnit.test("Parses ALU Function", function(assert) {
    var u;

    u = new MicroInstruction(0x0);
    assert.strictEqual(u.aluf, AluFunction.BUS);

    u = new MicroInstruction(0x00800000);
    assert.strictEqual(u.aluf, AluFunction.T);

    u = new MicroInstruction(0x01000000);
    assert.strictEqual(u.aluf, AluFunction.BUS_OR_T);

    u = new MicroInstruction(0x01800000);
    assert.strictEqual(u.aluf, AluFunction.BUS_AND_T);

    u = new MicroInstruction(0x02000000);
    assert.strictEqual(u.aluf, AluFunction.BUS_XOR_T);

    u = new MicroInstruction(0x02800000);
    assert.strictEqual(u.aluf, AluFunction.BUS_PLUS_1);

    u = new MicroInstruction(0x03000000);
    assert.strictEqual(u.aluf, AluFunction.BUS_MINUS_1);

    u = new MicroInstruction(0x03800000);
    assert.strictEqual(u.aluf, AluFunction.BUS_PLUS_T);

    u = new MicroInstruction(0x04000000);
    assert.strictEqual(u.aluf, AluFunction.BUS_MINUS_T);

    u = new MicroInstruction(0x04800000);
    assert.strictEqual(u.aluf, AluFunction.BUS_MINUS_T_MINUS_1);

    u = new MicroInstruction(0x05000000);
    assert.strictEqual(u.aluf, AluFunction.BUS_PLUS_T_PLUS_1);

    u = new MicroInstruction(0x05800000);
    assert.strictEqual(u.aluf, AluFunction.BUS_PLUS_SKIP);

    u = new MicroInstruction(0x06000000);
    assert.strictEqual(u.aluf, AluFunction.ALU_BUS_AND_T);

    u = new MicroInstruction(0x06800000);
    assert.strictEqual(u.aluf, AluFunction.BUS_AND_NOT_T);

    u = new MicroInstruction(0x07000000);
    assert.strictEqual(u.aluf, AluFunction.UNDEFINED_1);

    u = new MicroInstruction(0x07800000);
    assert.strictEqual(u.aluf, AluFunction.UNDEFINED_2);
});

QUnit.test("Parses Bus Source", function(assert) {
    var u;

    u = new MicroInstruction(0x00000000);
    assert.strictEqual(u.bs, BusSource.READ_R);

    u = new MicroInstruction(0x00100000);
    assert.strictEqual(u.bs, BusSource.LOAD_R);

    u = new MicroInstruction(0x00200000);
    assert.strictEqual(u.bs, BusSource.NONE);

    u = new MicroInstruction(0x00300000);
    assert.strictEqual(u.bs, BusSource.TASK_SPECIFIC_1);

    u = new MicroInstruction(0x00400000);
    assert.strictEqual(u.bs, BusSource.TASK_SPECIFIC_2);

    u = new MicroInstruction(0x00500000);
    assert.strictEqual(u.bs, BusSource.READ_MD);

    u = new MicroInstruction(0x00600000);
    assert.strictEqual(u.bs, BusSource.READ_MOUSE);

    u = new MicroInstruction(0x00700000);
    assert.strictEqual(u.bs, BusSource.READ_DISP);
});

QUnit.test("Parses Special Function 1", function(assert) {
    var u;

    u = new MicroInstruction(0x00000000);
    assert.strictEqual(u.f1, SpecialFunction1.NONE);

    u = new MicroInstruction(0x00010000);
    assert.strictEqual(u.f1,  SpecialFunction1.LOAD_MAR);

    u = new MicroInstruction(0x00020000);
    assert.strictEqual(u.f1,  SpecialFunction1.TASK);

    u = new MicroInstruction(0x00030000);
    assert.strictEqual(u.f1,  SpecialFunction1.BLOCK);

    u = new MicroInstruction(0x00040000);
    assert.strictEqual(u.f1,  SpecialFunction1.LLSH1);

    u = new MicroInstruction(0x00050000);
    assert.strictEqual(u.f1,  SpecialFunction1.LRSH1);

    u = new MicroInstruction(0x00060000);
    assert.strictEqual(u.f1,  SpecialFunction1.LLCY8);

    u = new MicroInstruction(0x00070000);
    assert.strictEqual(u.f1,  SpecialFunction1.CONSTANT);
});

QUnit.test("Parses Special Function 2", function(assert) {
    var u;

    u = new MicroInstruction(0x00000000);
    assert.strictEqual(u.f2, SpecialFunction2.NONE);

    u = new MicroInstruction(0x00001000);
    assert.strictEqual(u.f2, SpecialFunction2.BUSEQ0);

    u = new MicroInstruction(0x00002000);
    assert.strictEqual(u.f2, SpecialFunction2.SHLT0);

    u = new MicroInstruction(0x00003000);
    assert.strictEqual(u.f2, SpecialFunction2.SHEQ0);

    u = new MicroInstruction(0x00004000);
    assert.strictEqual(u.f2, SpecialFunction2.BUS);

    u = new MicroInstruction(0x00005000);
    assert.strictEqual(u.f2, SpecialFunction2.ALUCY);

    u = new MicroInstruction(0x00006000);
    assert.strictEqual(u.f2, SpecialFunction2.STORE_MD);

    u = new MicroInstruction(0x00007000);
    assert.strictEqual(u.f2, SpecialFunction2.CONSTANT);
});

QUnit.test("Parses LoadT", function(assert) {
    var u;

    u = new MicroInstruction(0x00000000);
    assert.ok(false === u.loadT, "0 is false");

    u = new MicroInstruction(0x00000800);
    assert.ok(true === u.loadT, "1 is true");
});

QUnit.test("Parses LoadL", function(assert) {
    var u;

    u = new MicroInstruction(0x00000000);
    assert.ok(false === u.loadL, "0 is false");

    u = new MicroInstruction(0x00000400);
    assert.ok(true === u.loadL, "1 is true");
});

QUnit.test("Parses Next", function(assert) {
    var u;

    u = new MicroInstruction(0xfffffff10);
    assert.strictEqual(0x310, u.next);

    u = new MicroInstruction(0xfffffffff);
    assert.strictEqual(0x3ff, u.next);

    u = new MicroInstruction(0xffffffc01);
    assert.strictEqual(1, u.next);

    u = new MicroInstruction(0xffffffc00);
    assert.strictEqual(0, u.next);
});

QUnit.test("Parses constantAccess", function(assert) {
    var u;

    u = new MicroInstruction(0xf1001000);
    assert.strictEqual(u.constantAccess, false);

    u = new MicroInstruction(0x00070000);
    assert.strictEqual(u.constantAccess, true);

    u = new MicroInstruction(0x00007000);
    assert.strictEqual(u.constantAccess, true);

    u = new MicroInstruction(0x00077000);
    assert.strictEqual(u.constantAccess, true);

    u = new MicroInstruction(0x00003000);
    assert.strictEqual(u.constantAccess, false);
});

QUnit.test("Parses constantAccessOrBS4", function(assert) {
    var u;

    u = new MicroInstruction(0);
    assert.strictEqual(u.constantAccessOrBS4, false);

    u = new MicroInstruction(0x00077000);
    assert.strictEqual(u.constantAccessOrBS4, true);

    u = new MicroInstruction(0x00300000);
    assert.strictEqual(u.constantAccessOrBS4, false);

    u = new MicroInstruction(0x00500000);
    assert.strictEqual(u.constantAccessOrBS4, true);
});

QUnit.test("Parses constantValue", function(assert) {
    var u;

    u = new MicroInstruction(0x07300000);
    assert.strictEqual(u.constantValue, 0xfffe);
});

QUnit.test("Parses needShifterOutput", function(assert) {
    var u;

    u = new MicroInstruction(0);
    assert.strictEqual(u.needShifterOutput, false);

    u = new MicroInstruction(0x0000a000);      // LOAD_DNS
    assert.strictEqual(u.needShifterOutput, true);

    u = new MicroInstruction(0x00002000);      // SHEQ0
    assert.strictEqual(u.needShifterOutput, true);

    u = new MicroInstruction(0x00003000);      // SHLT0
    assert.strictEqual(u.needShifterOutput, true);

    u = new MicroInstruction(0x00001000);      // BUSEQ0
    assert.strictEqual(u.needShifterOutput, false);
});

QUnit.test("Parses memoryAccess", function(assert) {
    var u;

    u = new MicroInstruction(0);
    assert.strictEqual(u.memoryAccess, false);

    u = new MicroInstruction(0x00500000); // bs = READ_MD,
    assert.strictEqual(u.memoryAccess, true);

    u = new MicroInstruction(0x00010000); // LOAD_MAR
    assert.strictEqual(u.memoryAccess, true);

    u = new MicroInstruction(0x00006000);
    assert.strictEqual(u.memoryAccess, true);

    u = new MicroInstruction(0x00507000); // bs = READ_MD, but ConstantAccess
    assert.strictEqual(u.memoryAccess, false);
});

QUnit.test("Parses memoryOperation", function(assert) {
    var u;

    u = new MicroInstruction(0);
    assert.strictEqual(u.memoryOperation, MemoryOperation.NONE);

    u = new MicroInstruction(0x00010000); // LOAD_MAR
    assert.strictEqual(u.memoryOperation, MemoryOperation.LOAD_ADDRESS);

    u = new MicroInstruction(0x00500000); // READ_MD
    assert.strictEqual(u.memoryOperation, MemoryOperation.READ);

    u = new MicroInstruction(0x00006000); // STORE_MD
    assert.strictEqual(u.memoryOperation, MemoryOperation.STORE);
});

QUnit.test("Parses LoadTFromAlu", function(assert) {
    var u;

    u = new MicroInstruction(0x00800000); // T
    assert.strictEqual(u.loadTFromALU, false);

    u = new MicroInstruction(0x0); // BUS
    assert.strictEqual(u.loadTFromALU, true);

    u = new MicroInstruction(0x01000000); // BUS_OR_T
    assert.strictEqual(u.loadTFromALU, true);

    u = new MicroInstruction(0x01800000); // BUS_AND_T
    assert.strictEqual(u.loadTFromALU, false);

    u = new MicroInstruction(0x02800000); // BUS_PLUS_1
    assert.strictEqual(u.loadTFromALU, true);

    u = new MicroInstruction(0x03000000); // BUS_MINUS_1
    assert.strictEqual(u.loadTFromALU, true);

    u = new MicroInstruction(0x05000000); // BUS_PLUS_T_PLUS_1
    assert.strictEqual(u.loadTFromALU, true);

    u = new MicroInstruction(0x05800000); // BUS_PLUS_SKIP
    assert.strictEqual(u.loadTFromALU, true);

    u = new MicroInstruction(0x06000000); // ALU_BUS_AND_T
    assert.strictEqual(u.loadTFromALU, true);
});

QUnit.test("toString", function(assert) {
    var u;

    u = new MicroInstruction(0x09623903);

    assert.strictEqual(u.toString(), "RSELECT=1 ALUF=2 BS=6 F1=2 F2=3 LoadT=1 LoadL=0 NEXT=403");
});
