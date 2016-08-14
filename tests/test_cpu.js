//    JsAlto Xerox Alto Emulator
//    Copyright (C) 2016  Seth J. Morabito
//
//    This program is free software: you can redistribute it and/or modify
//    it under the terms of the GNU Affero General Public License as published by
//    the Free Software Foundation, either version 3 of the License, or
//    (at your option) any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU Affero General Public License for more details.
//
//    You should have received a copy of the GNU Affero General Public License
//    along with this program.  If not, see
//    <http://www.gnu.org/licenses/>.

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

QUnit.test("ALU BUS Test", function(assert) {
  assert.ok(12 === Alu.execute(AluFunction.BUS, 12, 8, 1), "bus == 12");
  assert.ok(0 === Alu.carry);
});

QUnit.test("ALU T Test", function(assert) {
  assert.ok(8 === Alu.execute(AluFunction.T, 12, 8, 1), "t == 8");
  assert.ok(0 === Alu.carry);
});

QUnit.test("ALU BUS_OR_T Test", function(assert) {
  assert.ok(0xF === Alu.execute(AluFunction.BUS_OR_T, 5, 0xa, 1), "5|a == f");
  assert.ok(0xF === Alu.execute(AluFunction.BUS_OR_T, 3, 0xc, 1), "3|c == f");
  assert.ok(7 === Alu.execute(AluFunction.BUS_OR_T, 2, 5, 1), "2|5 == 7");
  assert.ok(0 === Alu.carry, "carry == 0");
});

QUnit.test("ALU BUS_AND_T Test", function(assert) {
  assert.ok(0 === Alu.execute(AluFunction.BUS_AND_T, 5, 0xa, 1), "5&a == 0");
  assert.ok(0 === Alu.execute(AluFunction.BUS_AND_T, 0xa, 5, 1), "a&5 == 0");
  assert.ok(4 === Alu.execute(AluFunction.BUS_AND_T, 0xc, 7, 1), "3&c == 4");
  assert.ok(6 === Alu.execute(AluFunction.BUS_AND_T, 6, 0xf, 1), "6&f == 6");
  assert.ok(0 === Alu.carry, "carry == 0");
});

QUnit.test("ALU ALU_BUS_AND_T Test", function(assert) {
  assert.ok(0 === Alu.execute(AluFunction.ALU_BUS_AND_T, 5, 0xa, 1), "5&a == 0");
  assert.ok(0 === Alu.execute(AluFunction.ALU_BUS_AND_T, 0xa, 5, 1), "a&5 == 0");
  assert.ok(4 === Alu.execute(AluFunction.ALU_BUS_AND_T, 0xc, 7, 1), "3&c == 4");
  assert.ok(6 === Alu.execute(AluFunction.ALU_BUS_AND_T, 6, 0xf, 1), "6&f == 6");
  assert.ok(0 === Alu.carry, "carry == 0");
});

QUnit.test("ALU BUS_XOR_T Test", function(assert) {
  assert.ok(5 === Alu.execute(AluFunction.BUS_XOR_T, 0xa, 0xf, 1), "a^f == 5");
  assert.ok(0 === Alu.execute(AluFunction.BUS_XOR_T, 0xf, 0xf, 1), "f^f == 0");
  assert.ok(4 === Alu.execute(AluFunction.BUS_XOR_T, 3, 7, 1), "3^7 == 4");
  assert.ok(4 === Alu.execute(AluFunction.BUS_XOR_T, 7, 3, 1), "7^3 == 4");
  assert.ok(0 === Alu.carry, "carry == 0");
});

QUnit.test("ALU BUS_PLUS_1 Test", function(assert) {
  assert.ok(0xf === Alu.execute(AluFunction.BUS_PLUS_1, 0xe, 0, 1), "e + 1 == f");
  assert.ok(0 === Alu.carry, "carry == 0");

  // Carry should work.
  assert.ok(0xffff === Alu.execute(AluFunction.BUS_PLUS_1, 0xfffe, 0, 1), "fffe + 1 == ffff");
  assert.ok(0 === Alu.carry, "carry == 0");
  assert.ok(0 === Alu.execute(AluFunction.BUS_PLUS_1, 0xffff, 0, 1), "ffff + 1 == 0");
  assert.ok(1 === Alu.carry, "carry == 1");
});

QUnit.test("ALU BUS_MINUS_1 Test", function(assert) {
  assert.ok(0xe === Alu.execute(AluFunction.BUS_MINUS_1, 0xf, 0, 1), "f - 1 == e");
  // Subtraction carry is reversed from intuition!
  assert.ok(1 === Alu.carry, "carry == 1");

  // Carry should work.
  assert.ok(0 === Alu.execute(AluFunction.BUS_MINUS_1, 1, 0, 1), "1 - 1 == 0");
  assert.ok(1 === Alu.carry, "carry == 1");
  assert.ok(0xffff === Alu.execute(AluFunction.BUS_MINUS_1, 0, 0, 1), "0 - 1 == ffff");
  assert.ok(0 === Alu.carry, "carry == 0");
});

QUnit.test("ALU Unimplemented Test", function(assert) {
  // '99' is not an implemented function
  assert.throws(
    function() {
      Alu.execute(99, 12, 8, 1);
    },
      /Unimplemented Function/,
    "raised 'Unimplemented Function'"
  );
});
