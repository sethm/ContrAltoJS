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

    this.push = function(event) {
        if (q.length === 0 || q.peek().timestampNsec >= event.timestampNsec) {
            q.push(event);
            return;
        }

        var newIndex = 0;

        // Do a linear search to find a place to put the event
        for (var i = 0; i < q.length; i++) {
            if (q[i].timestampNsec >= event.timestampNsec) {
                newIndex = i;
                break;
            }
        }

        q.splice(newIndex, 0, event);
    };

    this.peek = function() {
        return q.peek();
    };

    this.pop = function() {
        return q.pop();
    };

    this.remove = function(event) {
        return q.remove(event);
    };

    this.clear = function() {
        q = [];
    };

    this.length = function() {
        return q.length;
    };

    this.getQueue = function() {
        return q;
    }
};

// Scheduler

var Event = function(timestampNsec, context, callback) {
    this.timestampNsec = timestampNsec;
    this.context = context;
    this.callback = callback;
};

Event.prototype.toString = function() {
    return "[Event: timestampNsec = " + this.timestampNsec + "]";
};

Array.prototype.peek = function() {
    return this[this.length - 1];
};

Array.prototype.remove = function(element) {
    var index = this.indexOf(element);

    if (index > -1) {
        return this.splice(index, 1);
    }

    return undefined;
};

var scheduler = {

    queue: new SchedulerQueue(),

    timeStepNsec: 170,

    currentTimeNsec: 0,

    reset: function() {
        this.queue.clear();
        this.currentTimeNsec = 0;
    },

    clock: function() {
        this.currentTimeNsec += this.timeStepNsec;

        while (this.queue.peek() !== undefined &&
               (this.currentTimeNsec >= this.queue.peek().timestampNsec)) {
            var event = this.queue.pop();
            event.callback(this.currentTimeNsec,
                           this.currentTimeNsec - event.timestampNsec,
                           event.context);
        }
    },

    schedule: function(event) {
        event.timestampNsec += this.currentTimeNsec;
        this.queue.push(event);

        return event;
    },

    cancelEvent: function(event) {
        this.queue.remove(event);
    }
};
