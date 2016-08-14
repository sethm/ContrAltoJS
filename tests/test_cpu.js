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

// ALU tests

QUnit.module("ALU Tests", {
    beforeEach: function() {
        Alu.reset();
    }
});

QUnit.test("ALU Reset clears carry", function(assert) {
    Alu.carry = 1;
    assert.ok(1 == Alu.carry, "carry == 1");

    Alu.reset();
    assert.ok(0 == Alu.carry, "carry == 0");
});

QUnit.test("ALU BUS", function(assert) {
    assert.ok(12 === Alu.execute(AluFunction.BUS, 12, 0, 0),
              "bus == 12");
    assert.ok(0 === Alu.carry);
});

QUnit.test("ALU T", function(assert) {
    assert.ok(8 === Alu.execute(AluFunction.T, 0, 8, 0), "t == 8");
    assert.ok(0 === Alu.carry);
});

QUnit.test("ALU BUS_OR_T", function(assert) {
    assert.ok(0xF === Alu.execute(AluFunction.BUS_OR_T, 5, 0xa, 0),
              "5|a == f");
    assert.ok(0xF === Alu.execute(AluFunction.BUS_OR_T, 3, 0xc, 0),
              "3|c == f");
    assert.ok(7 === Alu.execute(AluFunction.BUS_OR_T, 2, 5, 0),
              "2|5 == 7");
    assert.ok(0 === Alu.carry, "carry == 0");
});

QUnit.test("ALU BUS_AND_T", function(assert) {
    assert.ok(0 === Alu.execute(AluFunction.BUS_AND_T, 5, 0xa, 0),
              "5&a == 0");
    assert.ok(0 === Alu.execute(AluFunction.BUS_AND_T, 0xa, 5, 0),
              "a&5 == 0");
    assert.ok(4 === Alu.execute(AluFunction.BUS_AND_T, 0xc, 7, 0),
              "3&c == 4");
    assert.ok(6 === Alu.execute(AluFunction.BUS_AND_T, 6, 0xf, 0),
              "6&f == 6");
    assert.ok(0 === Alu.carry, "carry == 0");
});

QUnit.test("ALU ALU_BUS_AND_T", function(assert) {
    assert.ok(0 === Alu.execute(AluFunction.ALU_BUS_AND_T, 5, 0xa, 0),
              "5&a == 0");
    assert.ok(0 === Alu.execute(AluFunction.ALU_BUS_AND_T, 0xa, 5, 0),
              "a&5 == 0");
    assert.ok(4 === Alu.execute(AluFunction.ALU_BUS_AND_T, 0xc, 7, 0),
              "3&c == 4");
    assert.ok(6 === Alu.execute(AluFunction.ALU_BUS_AND_T, 6, 0xf, 0),
              "6&f == 6");
    assert.ok(0 === Alu.carry, "carry == 0");
});

QUnit.test("ALU BUS_XOR_T", function(assert) {
    assert.ok(5 === Alu.execute(AluFunction.BUS_XOR_T, 0xa, 0xf, 0),
              "a^f == 5");
    assert.ok(0 === Alu.execute(AluFunction.BUS_XOR_T, 0xf, 0xf, 0),
              "f^f == 0");
    assert.ok(4 === Alu.execute(AluFunction.BUS_XOR_T, 3, 7, 0),
              "3^7 == 4");
    assert.ok(4 === Alu.execute(AluFunction.BUS_XOR_T, 7, 3, 0),
              "7^3 == 4");
    assert.ok(0 === Alu.carry, "carry == 0");
});

QUnit.test("ALU BUS_PLUS_1", function(assert) {
    assert.ok(0xf === Alu.execute(AluFunction.BUS_PLUS_1, 0xe, 0, 0),
              "e + 1 == f");
    assert.ok(0 === Alu.carry, "carry == 0");

    // Carry should work.
    assert.ok(0xffff === Alu.execute(AluFunction.BUS_PLUS_1, 0xfffe, 0, 0),
              "fffe + 1 == ffff");
    assert.ok(0 === Alu.carry, "carry == 0");
    assert.ok(0 === Alu.execute(AluFunction.BUS_PLUS_1, 0xffff, 0, 0),
              "ffff + 1 == 0");
    assert.ok(1 === Alu.carry, "carry == 1");
});

QUnit.test("ALU BUS_MINUS_1", function(assert) {
    assert.ok(0xe === Alu.execute(AluFunction.BUS_MINUS_1, 0xf, 0, 0),
              "f - 1 == e");
    // Subtraction carry is reversed from intuition!
    assert.ok(1 === Alu.carry, "carry == 1");

    // Carry should work.
    assert.ok(0 === Alu.execute(AluFunction.BUS_MINUS_1, 1, 0, 0),
              "1 - 1 == 0");
    assert.ok(1 === Alu.carry, "carry == 1");
    assert.ok(0xffff === Alu.execute(AluFunction.BUS_MINUS_1, 0, 0, 0),
              "0 - 1 == ffff");
    assert.ok(0 === Alu.carry, "carry == 0");
});

QUnit.test("ALU BUS_PLUS_T", function(assert) {
    assert.ok(0x18 === Alu.execute(AluFunction.BUS_PLUS_T, 0xe, 0xa, 0),
              "e + a == 24");
    assert.ok(0 === Alu.carry, "carry == 0");

    // Carry should work.
    assert.ok(0xffff === Alu.execute(AluFunction.BUS_PLUS_T, 0xfffe, 1, 0),
              "fffe + 1 == ffff");
    assert.ok(0 === Alu.carry, "carry == 0");
    assert.ok(0 === Alu.execute(AluFunction.BUS_PLUS_T, 0xffff, 1, 0),
              "ffff + 1 == 0");
    assert.ok(1 === Alu.carry, "carry == 1");
});

QUnit.test("ALU BUS_MINUS_T", function(assert) {
    assert.ok(0xe === Alu.execute(AluFunction.BUS_MINUS_T, 0xf, 1, 0),
              "f - 1 == e");
    // Subtraction carry is reversed from intuition!
    assert.ok(1 === Alu.carry, "carry == 1");

    assert.ok(0xfff0 === Alu.execute(AluFunction.BUS_MINUS_T, 0xffff, 0xf, 0),
              "ffff - f == fff0");
    assert.ok(1 === Alu.carry, "carry == 1");

    // Carry should work.
    assert.ok(0 === Alu.execute(AluFunction.BUS_MINUS_T, 1, 1, 0),
              "1 - 1 == 0");
    assert.ok(1 === Alu.carry, "carry == 1");
    assert.ok(0xffff === Alu.execute(AluFunction.BUS_MINUS_T, 0, 1, 0),
              "0 - 1 == ffff");
    assert.ok(0 === Alu.carry, "carry == 0");
});

QUnit.test("ALU BUS_MINUS_T_MINUS_1", function(assert) {
    assert.ok(0xd === Alu.execute(AluFunction.BUS_MINUS_T_MINUS_1,
                                  0xf, 1, 0),
              "f - 1 - 1 == d");
    // Subtraction carry is reversed from intuition!
    assert.ok(1 === Alu.carry, "carry == 1");

    assert.ok(0xffef === Alu.execute(AluFunction.BUS_MINUS_T_MINUS_1,
                                     0xffff, 0xf, 0),
              "ffff - f - 1 == ffef");
    assert.ok(1 === Alu.carry, "carry == 1");

    // Carry should work.
    assert.ok(0 === Alu.execute(AluFunction.BUS_MINUS_T_MINUS_1, 2, 1, 0),
              "2 - 1 - 1 == 0");
    assert.ok(1 === Alu.carry, "carry == 1");
    assert.ok(0xffff === Alu.execute(AluFunction.BUS_MINUS_T_MINUS_1, 1, 1, 0),
              "1 - 1 - 1 == ffff");
    assert.ok(0 === Alu.carry, "carry == 0");
});

QUnit.test("ALU BUS_PLUS_T_PLUS_1", function(assert) {
    assert.ok(25 === Alu.execute(AluFunction.BUS_PLUS_T_PLUS_1, 0xe, 0xa, 0),
              "e + a + 1 == 25");
    assert.ok(0 === Alu.carry, "carry == 0");

    // Carry should work.
    assert.ok(0xffff === Alu.execute(AluFunction.BUS_PLUS_T_PLUS_1,
                                     0xfffd, 1, 0),
              "fffd + 1 + 1 == ffff");
    assert.ok(0 === Alu.carry, "carry == 0");
    assert.ok(0 === Alu.execute(AluFunction.BUS_PLUS_T_PLUS_1, 0xfffe, 1, 0),
              "fffe + 1 + 1 == 0");
    assert.ok(1 === Alu.carry, "carry == 1");
});

QUnit.test("ALU BUS_PLUS_SKIP", function(assert) {
    assert.ok(0x18 === Alu.execute(AluFunction.BUS_PLUS_SKIP, 0xe, 0, 0xa),
              "e + a == 24");
    assert.ok(0 === Alu.carry, "carry == 0");

    // Carry should work.
    assert.ok(0xffff === Alu.execute(AluFunction.BUS_PLUS_SKIP, 0xfffe, 0, 1),
              "fffe + 1 == ffff");
    assert.ok(0 === Alu.carry, "carry == 0");
    assert.ok(0 === Alu.execute(AluFunction.BUS_PLUS_SKIP, 0xffff, 0, 1),
              "ffff + 1 == 0");
    assert.ok(1 === Alu.carry, "carry == 1");
});

QUnit.test("ALU BUS_AND_NOT_T", function(assert) {
    assert.ok(4 === Alu.execute(AluFunction.BUS_AND_NOT_T, 5, 3, 0),
              "5 & ~3 == 4");
    assert.ok(0xd102 === Alu.execute(AluFunction.BUS_AND_NOT_T,
                                     0xf13a, 0x2038),
              "f13a & ~2039 == d102");

    assert.ok(0 === Alu.carry, "carry == 0");
});


QUnit.test("ALU Unimplemented Function", function(assert) {
    // '99' is not an implemented function
    assert.throws(
        function() {
            Alu.execute(99, 12, 8, 1);
        },
            /Unimplemented Function/,
        "raised 'Unimplemented Function'"
    );
});


QUnit.module("CPU Tests", {
    beforeEach: function() {
        Cpu.reset();
    }
});

QUnit.test("CPU Reset", function(assert) {
    var i, j;

    assert.ok(32 === Cpu.r.length, "r.length == 32");

    for (i = 0; i < Cpu.r.length; i++) {
        assert.ok(Cpu.r[i] === 0, "r[i] == 0");
    }

    assert.ok(8 === Cpu.s.length, "s.length == 8");

    for (i = 0; i < Cpu.s.length; i++) {
        assert.ok(Cpu.s[i] instanceof Array, "s[i] is an array");
        assert.ok(32 === Cpu.s[i].length, "s[i] has a length of 8");

        for (j = 0; j < Cpu.s[i].length; j++) {
            assert.ok(0 === Cpu.s[i][j], "s[i][j] == 0");
        }
    }

    assert.ok(0 === Cpu.t, "t == 0");
    assert.ok(0 === Cpu.l, "l == 0");
    assert.ok(0 === Cpu.m, "m == 0");
    assert.ok(0 === Cpu.ir, "ir == 0");

    assert.ok(0 === Cpu.aluC0, "aluC0 == 0");

    assert.ok(0xffff === Cpu.rmr, "rmr == 0xffff");
});
