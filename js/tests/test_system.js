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
// Unit Tests for the Alto System
//

var originalFunctions = {};

QUnit.module("Alto System Tests", {
    beforeEach: function() {
        // Steal original methods so we can mock them.
        originalFunctions.schedulerReset = scheduler.reset;
        originalFunctions.memoryReset = memory.reset;
        originalFunctions.memoryBusReset = memoryBus.reset;
    },

    afterEach: function() {
        scheduler.reset = originalFunctions.schedulerReset;
        memory.reset = originalFunctions.memoryReset;
        memoryBus.reset = originalFunctions.memoryBusReset;
    }
});

QUnit.test("System can be reset", function(assert) {
    // TODO: This is a little hokey. Can we genericize or DRY this up?

    var memoryWasReset = false;
    var memoryBusWasReset = false;
    var schedulerWasReset = false;

    memory.reset = function() {
        memoryWasReset = true;
    };

    memoryBus.reset = function() {
        memoryBusWasReset = true;
    };

    scheduler.reset = function() {
        schedulerWasReset = true;
    };

    altoSystem.reset();

    assert.strictEqual(schedulerWasReset, true);
    assert.strictEqual(memoryWasReset, true);
    assert.strictEqual(memoryBusWasReset, true);
});
