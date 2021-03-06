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

QUnit.module("Scheduler Tests", {
    beforeEach: function() {
        scheduler.reset();
    }
});

QUnit.test("Can schedule an event", function(assert) {
    var event = {};
    assert.strictEqual(scheduler.queue.length(), 0);
    scheduler.schedule(event);
    assert.strictEqual(scheduler.queue.length(), 1);
});

QUnit.test("Can cancel an event", function(assert) {
    var event = {};

    assert.strictEqual(scheduler.queue.length(), 0);
    scheduler.schedule(event);
    assert.strictEqual(scheduler.queue.length(), 1);
    scheduler.cancelEvent(event);
    assert.strictEqual(scheduler.queue.length(), 0);
});

QUnit.test("Clocks", function(assert) {

    var callbackCalled = false;

    var event = new Event(0, {}, function() {
        callbackCalled = true;
    });

    assert.strictEqual(scheduler.queue.length(), 0);
    scheduler.schedule(event);

    scheduler.clock();

    assert.strictEqual(scheduler.queue.length(), 0);
    assert.strictEqual(callbackCalled, true);
});
