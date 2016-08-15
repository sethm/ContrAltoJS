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

// Microcode Task

var InstructionCompletion = {
    NORMAL:      0,
    TASK_SWITCH: 1,
    MEMORY_WAIT: 2
};

var EmulatorBusSource = {
    READ_S_LOCATION: 3,
    LOAD_S_LOCATION: 4
};

var EmulatorTask = {
    wakeup: true,
    rb: 0,
    srSelect: 0,
    loadS: false,

    reset: function() {
        this.rb = 0;
        this.srSelect = 0;
        this.loadS = false;
        this.wakeup = true;
    },

    getBusSource: function (bs) {
        switch(bs) {
        case EmulatorBusSource.READ_S_LOCATION:
            if (this.srSelect != 0) {
                return Cpu.s[this.rb][this.srSelect];
            } else {
                // "...when reading data from the S registers onto the processor bus,
                //  the RSELECT value 0 causes the current value of the M register to
                //  appear on the bus..."
                 return Cpu.m;
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
    }
};
