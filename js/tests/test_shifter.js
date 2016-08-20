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


QUnit.module("Shifter Tests", {
    beforeEach: function() {
        shifter.reset();
    }
});

QUnit.test("Shifts left", function(assert) {
    shifter.op = ShifterOp.SHIFT_LEFT;
    shifter.count = 1;
    shifter.doOperation(1, 0);
    assert.strictEqual(shifter.output, 2);
    shifter.doOperation(2, 0);
    assert.strictEqual(shifter.output, 4);
});

QUnit.test("Shifts right", function(assert) {
    shifter.op = ShifterOp.SHIFT_RIGHT;
    shifter.count = 1;
    shifter.doOperation(2, 0);
    assert.strictEqual(shifter.output, 1);
    shifter.doOperation(1, 0);
    assert.strictEqual(shifter.output, 0);
    shifter.doOperation(0xffff, 0);
    assert.strictEqual(shifter.output, 0x7fff);
});

QUnit.test("Rotates left", function(assert) {
    shifter.op = ShifterOp.ROTATE_LEFT;

    shifter.count = 2;

    shifter.doOperation(1, 0);
    assert.strictEqual(shifter.output, 4);

    shifter.count = 1;

    shifter.doOperation(0x8000, 0);
    assert.strictEqual(shifter.output, 1);

    shifter.count = 3;

    shifter.doOperation(0x8000, 0);
    assert.strictEqual(shifter.output, 4);

    shifter.count = 16;

    shifter.doOperation(1, 0);
    assert.strictEqual(shifter.output, 1);
});

QUnit.test("Rotates right", function(assert) {
    shifter.op = ShifterOp.ROTATE_RIGHT;

    shifter.count = 2;

    shifter.doOperation(4, 0);
    assert.strictEqual(shifter.output, 1);

    shifter.count = 1;

    shifter.doOperation(0x8000, 0);
    assert.strictEqual(shifter.output, 0x4000);

    shifter.count = 15;

    shifter.doOperation(0x8000, 0);
    assert.strictEqual(shifter.output, 1);

    shifter.count = 16;

    shifter.doOperation(1, 0);
    assert.strictEqual(shifter.output, 1);
});
