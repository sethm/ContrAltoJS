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

QUnit.module("Task Tests", {
    beforeEach: function() {
        Alu.reset();
        Cpu.reset();
        EmulatorTask.reset();
    }
});

QUnit.test("EmulatorTask Reset", function(assert) {
    assert.ok(EmulatorTask.wakeup, "wakeup == true");
    assert.ok(0 === EmulatorTask.rb, "rb == 0");
    assert.ok(0 === EmulatorTask.srSelect, "srSelect == 0");
    assert.ok(false === EmulatorTask.loadS, "loadS is false");
});

QUnit.test("EmulatorTask getBusSource", function(assert) {
    // Set up the CPU
    Cpu.s[1][5] = 0x5a;
    Cpu.m = 0xf0;

    EmulatorTask.rb = 1;
    EmulatorTask.srSelect = 5;

    assert.ok(0x5a == EmulatorTask.getBusSource(EmulatorBusSource.READ_S_LOCATION));
    assert.ok(0xffff == EmulatorTask.getBusSource(EmulatorBusSource.LOAD_S_LOCATION));

    EmulatorTask.srSelect = 0;
    assert.ok(0xf0 == EmulatorTask.getBusSource(EmulatorBusSource.READ_S_LOCATION));
});
