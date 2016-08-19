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

// Microcode Tasks

function extend(src, dst) {

    var sourceKeys = Object.keys(src);
    var destKeys = Object.keys(dst);

    for (var i = 0; i < sourceKeys.length; i++) {
        var name = sourceKeys[i];

        if (dst[name] === undefined) {
            dst[name] = src[name];
        }
    }

    return dst;
}

// Also serves as priority
var TaskType = {
    INVALID:        -1,
    EMULATOR:        0,
    DISK_SECTOR:     1,
    ETHERNET:        7,
    MEMORY_REFRESH:  8,
    DISPLAY_WORD:    9,
    CURSOR:         10,
    DISPLAY_HORIZ:  11,
    DISPLAY_VERT:   12,
    PARITY:         13,
    DISK_WORD:      14
};

var InstructionCompletion = {
    NORMAL:      0,
    TASK_SWITCH: 1,
    MEMORY_WAIT: 2
};

var EmulatorBusSource = {
    READ_S_LOCATION: 3,
    LOAD_S_LOCATION: 4
};

//
// Base Task implementation used by all tasks
//

var Task = {
    baseReset: function() {
        this.mpc = this.taskType;
        this.rdRam = false;
        this.rb = 0;
        this.firstInstructionAfterSwitch = false;
        this.swMode = false;
        this.wrtRam = false;
        this.wakeup = false;
        this.skip = 0;
    },

    reset: function() {
        return this.baseReset();
    },

    priority: function() {
        return this.taskType;
    },

    softReset: function() {
        this.mpc = this.taskType;
    },

    // Removes the Wakeup signal for this task
    blockTask: function() {
        this.wakeup = true;
    },

    // Sets the wakeup signal for this task
    wakeupTask: function() {
        this.wakeup = true;
    },

    // Execute a single microinstruction.
    //
    // Returns an 'InstructionCompletion' indicating whether this
    // instruction calls for a task switch or not.
    executeNext: function() {
        var instruction = uCodeMemory.getInstruction(this.mpc, this.taskType);
        return this.executeInstruction(instruction);
    },

    // ExecuteInstruction causes the Task to execute the next
    // instruction (the one this.mpc is pointing to). The base
    // implementation covers non-task specific logic, but other
    // tasks may provide their own implementation.
    //
    // Returns an InstructionCompletion indicating whether this
    // instruction calls for a task switch or not.
    baseExecuteInstruction: function(instruction) {
        var completion = InstructionCompletion.NORMAL;

        var swMode = false;
        var block = false;
        var aluData = 0;
        var nextModifier = 0;

        this.loadR = false;
        this.loadS = false;
        this.rSelect = 0;
        this.srSelect = 0;
        this.busData = 0;
        this.softReset = false;

        shifter.reset();

        // TODO: Much, much more implementation.

        return completion;
    },

    executeInstruction: function(instruction) {
        return this.baseExecuteInstruction(instruction);
    }
};

var emulatorTask = extend(Task, {
    taskType: TaskType.EMULATOR,

    wakeup: true,
    srSelect: 0,
    priority: 0,
    loadS: false,

    reset: function() {
        this.baseReset();
        this.rb = 0;
        this.srSelect = 0;
        this.loadS = false;
        this.wakeup = true;
    },

    blockTask: function() {
        throw("The emulator task cannot be blocked.");
    },

    wakeupTask: function() {
        throw("The emulator task is always in wakeup state.");
    },

    executeNext: function() {
        return InstructionCompletion.NORMAL;
    },

    getBusSource: function(bs) {
        switch(bs) {
        case EmulatorBusSource.READ_S_LOCATION:
            if (this.srSelect != 0) {
                return cpu.s[this.rb][this.srSelect];
            } else {
                // "...when reading data from the S registers onto the processor bus,
                //  the RSELECT value 0 causes the current value of the M register to
                //  appear on the bus..."
                 return cpu.m;
            }
            break;
            ;;
        case EmulatorBusSource.LOAD_S_LOCATION:
            this.loadS = true;
            return 0xffff;
            break;
            ;;
        default:
            throw "Unhandled bus source " + bs;
        }
    },

    executeSpecialFunctionEarly(instruction) {

    },

    toString: function() {
        return "Emulator Task [rb=" + this.rb + ", srSelect=" + this.srSelect + "]";
    }
});


var diskSectorTask = extend(Task, {
    taskType: TaskType.DISK_SECTOR,

    reset: function() {
        this.baseReset();
    }
});

var diskWordTask = extend(Task, {
    taskType: TaskType.DISK_WORD,

    reset: function() {
        this.baseReset();
    }
});

var displayWordTask = extend(Task, {
    taskType: TaskType.DISPLAY_WORD,

    reset: function() {
        this.baseReset();
    }
});

var displayHorizontalTask = extend(Task, {
    taskType: TaskType.DISPLAY_HORIZ,

    reset: function() {
        this.baseReset();
    }
});

var displayVerticalTask = extend(Task, {
    taskType: TaskType.DISPLAY_VERT,

    reset: function() {
        this.baseReset();
    }
});

var cursorTask = extend(Task, {
    taskType: TaskType.CURSOR,

    reset: function() {
        this.baseReset();
    }
});

var memoryRefreshTask = extend(Task, {
    taskType: TaskType.MEMORY_REFRESH,

    reset: function() {
        this.baseReset();
    }
});

var ethernetTask = extend(Task, {
    taskType: TaskType.ETHERNET,

    reset: function() {
        this.baseReset();
    }
});

var parityTask = extend(Task, {
    taskType: TaskType.PARITY,

    reset: function() {
        this.baseReset();
    }
});
