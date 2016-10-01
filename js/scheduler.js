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


// Queue

var SchedulerQueue = function () {
    var q = [];

    this.enqueue = function(event) {
        // Do a linear search to find a place to put the event
        for (var i = 0; i < q.length; i++) {
            if (q[i].timestampNsec >= event.timestampNsec) {
                q.splice(i, 0, event);
                return;
            }
        }

        // Event happens later than any other event on list
        q.push(event);
    };

    this.checkOrdering = function() {
        for (var i = 0; i < q.length-1; i++) {
            if(q[i].timestampNsec > q[i+1].timestampNsec) {
                console.log("scheduler: Error: Priority queue out of order");
            }
        }
    };

    this.peek = function() {
        return q[0];
    };

    this.dequeue = function() {
        return q.shift();
    };

    this.remove = function(event) {
        return removeFromArray(q, event);
    };

    this.clear = function() {
        q = [];
    };

    this.length = function() {
        return q.length;
    };

    this.getQueue = function() {
        return q;
    };
};

// Scheduler

var Event = function(timestampNsec, context, callback) {
    this.timestampNsec = timestampNsec;
    this.context = context;
    this.callback = callback;
    this.pending = false;
};

Event.prototype.toString = function() {
    return "[Event: timestampNsec = " + this.timestampNsec + "]";
};

function removeFromArray(array, element) {
    var index = array.indexOf(element);

    if (index > -1) {
        return array.splice(index, 1);
    }

    return undefined;
};

var TIME_STEP_NSEC = 170;

var scheduler = {

    queue: new SchedulerQueue(),

    currentTimeNsec: 0,

    debug: false,

    reset: function() {
        this.queue.clear();
        this.currentTimeNsec = 0;
    },

    clock: function() {
        "use strict";
        this.currentTimeNsec += TIME_STEP_NSEC;

        var peek = this.queue.peek();
        while (peek !== undefined && this.currentTimeNsec >= peek.timestampNsec) {
            var event = this.queue.dequeue();
            event.callback(this.currentTimeNsec, this.currentTimeNsec - event.timestampNsec, event.context);
            peek = this.queue.peek();
        }
    },

    schedule: function(event) {
        event.timestampNsec += this.currentTimeNsec;
        this.queue.enqueue(event);
        if(this.debug) {
            this.queue.checkOrdering();
        }
        return event;
    },

    cancelEvent: function(event) {
        this.queue.remove(event);
    }
};
