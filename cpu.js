
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
// Alto CPU
//

var AluFunction = {
    BUS:                 0,
    T:                   1,
    BUS_OR_T:            2,
    BUS_AND_T:           3,
    ALU_BUS_AND_T:       4,
    BUS_XOR_T:           6,
    BUS_PLUS_1:          7,
    BUS_MINUS_1:         8,
    BUS_PLUS_T:          9,
    BUS_MINUS_T:         10,
    BUS_MINUS_T_MINUS_1: 11,
    BUS_PLUS_T_PLUS_1:   12,
    BUS_PLUS_SKIP:       13,
    BUS_AND_NOT_T:       14
};

//
// This implements the stripped-down version of the 74181 ALU
// that the Alto exposes to the microcode, and nothing more.
//

var Alu = {

    // State

    carry: 0,

    // Functions

    reset: function() {
        console.log("Resetting ALU.");
        this.carry = 0;
    },

    execute: function(fn, bus, t, skip) {
        var r = 0;

        switch (fn) {
        case AluFunction.BUS:
            this.carry = 0;
            r = bus;
            break;

        case AluFunction.T:
            this.carry = 0;
            r = t;
            break;

        case AluFunction.BUS_OR_T:
            this.carry = 0;
            r = (bus | t);
            break;

        case AluFunction.BUS_AND_T:
        case AluFunction.ALU_BUS_AND_T:
            this.carry = 0;
            r = (bus & t);
            break;

        case AluFunction.BUS_XOR_T:
            this.carry = 0;
            r = (bus ^ t);
            break;

        case AluFunction.BUS_PLUS_1:
            r = bus + 1;
            this.carry = (r > 0xffff) ? 1 : 0;
            break;

        case AluFunction.BUS_MINUS_1:
            r = bus - 1;

            // Because subtraction is actually performed by complementary
            // addition (1s complement), a carry out means borrow; thus, a
            // carry is generated when there is no underflow and no carry is
            // generated when there is underflow.
            this.carry = (r < 0) ? 0 : 1;
            break;

        case AluFunction.BUS_PLUS_T:
            r = bus + t;
            this.carry = (r > 0xffff) ? 1 : 0;
            break;

        case AluFunction.BUS_MINUS_T:
            r = bus - t;
            this.carry = (r < 0) ? 0 : 1;
            break;

        case AluFunction.BUS_MINUS_T_MINUS_1:
            r = bus - t - 1;
            this.carry = (r < 0) ? 0 : 1;
            break;

        case AluFunction.BUS_PLUS_T_PLUS_1:
            r = bus + t + 1;
            this.carry = (r > 0xffff) ? 1 : 0;
            break;

        case AluFunction.BUS_PLUS_SKIP:
            r = bus + skip;
            this.carry = (r > 0xffff) ? 1 : 0;
            break;

        case AluFunction.BUS_AND_NOT_T:
            r = (bus & (~t));
            carry = 0;
            break;

        default:
            throw("Unimplemented Function");
        }

        return r & 0xffff;
    }
};

var Cpu = {
    R_SIZE: 32,
    S_SIZE: 8,
    S_I_SIZE: 32,

    // State

    // CPU Registers
    t:  0,
    l:  0,
    m:  0,
    ir: 0,

    // R and S register files and bank select
    r: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],

    s: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
         0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
         0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
         0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
         0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
         0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
         0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
         0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
         0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],

    // Stores the last carry from the ALU on a Load L
    aluC0: 0,
    rmr: 0,

    // Tasks
    nextTask: undefined,
    currentTask: undefined,
    tasks: [
    ],

    // Functions

    // Reset the CPU state
    reset: function() {
        var i;

        // Initialize r and s
        for (i = 0; i < this.R_SIZE; i++) {
            this.r[i] = 0;
        }

        for (i = 0; i < this.S_SIZE; i++) {
            for (var j = 0; j < this.S_I_SIZE; j++) {
                this.s[i][j] = 0;
            }
        }

        // Initialize CPU registers
        this.t = 0;
        this.l = 0;
        this.m = 0;
        this.ir = 0;

        this.aluC0 = 0;
        // Start all tasks in ROM0
        this.rmr = 0xffff;

        // reset tasks.
        for (i = 0; i < this.tasks.length; i++) {
            if (tasks[i] != undefined) {
                tasks[i].reset();
            }
        }
    }
};
