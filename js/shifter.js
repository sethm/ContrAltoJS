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


var ShifterOp = {
    NONE:         0,
    SHIFT_LEFT:   1,
    SHIFT_RIGHT:  2,
    ROTATE_LEFT:  3,
    ROTATE_RIGHT: 4
};

// NOTE: FOR NOVA (NOVEL) SHIFTS (from aug '76 manual): The emulator
// has two additional bits of state, the SKIP and CARRY flip
// flops.CARRY is identical to the Nova carry bit, and is set or
// cleared as appropriate when the DNS+- (do Nova shifts) function is
// executed. DNS also addresses R from (R[3 - 4] XOR 3), and sets the
// SKIP flip flop if appropriate.The PC is incremented by 1 at the
// beginning of the next emulated instruction if SKIP is set, using
// ALUF DB. IR<- clears SKIP.

var shifter = {

    op: ShifterOp.NONE,
    count: 0,
    output: 0,
    magic: false,
    dns: false,
    dnsCarry: 0,

    reset: function() {
        this.op = ShifterOp.NONE;
        this.count = 0;
        this.output = 0;
        this.magic = false;
        this.dns = false;
        this.dnsCarry = 0;
    },

    setOperation: function(op, count) {
        this.op = op;
        this.count = count;
    },

    setDns: function(dns, carry) {
        this.dns = dns;
        this.dnsCarry = carry;
    },

    doOperation: function(input, t) {
        var i = 0;
        var c = 0;

        switch(this.op) {
        case ShifterOp.NONE:
            this.output = input;
            break;

        case ShifterOp.SHIFT_LEFT:
            this.output = (input << this.count) & 0xffff;

            if (this.magic) {
                // "MAGIC places the high order bit of T into the low
                // order bit of the shifter output on left shifts..."

                this.output |= ((t & 0x8000) >>> 15);

                if (this.count != 1) {
                    throw "Magic LCY 8 not implemented yet";
                }
            } else if (this.dns) {
                // "Rotate the 17 input bits left by one bit. This has
                // the effect of rotating bit 0 left into the carry
                // position and the carry bit into bit 15."

                // Put input carry into bit 15
                this.output = (this.output | this.dnsCarry) & 0xffff;

                // Update carry
                this.dnsCarry = ((input & 0x8000) >>> 15);
            }
            break;

        case ShifterOp.SHIFT_RIGHT:
            this.output = (input >>> this.count) & 0xffff;

            if (this.magic) {
                // "...and places the low order bit of T into the high
                // order bit position of the shifter output on right
                // shifts."
                this.output |= ((t & 0x1) << 15);

                if (this.count != 1) {
                    throw "Magic LCY 8 not implemented yet.";
                }
            } else if (this.dns) {
                // "Rotate the 17 bits right by one bit. Bit 15 is
                // rotated into the carry position and the carry bit
                // into bit 0."
                this.output |= (this.output | (this.dnsCarry << 15)) & 0xffff;

                // update carry
                this.dnsCarry = input & 0x1;
            }
            break;

        case ShifterOp.ROTATE_LEFT:
            if (this.dns) {
                // "Swap the 8-bit halves of the 16-bit result. The
                // carry is not affected."
                this.output = ((input & 0xff00) >>> 8) | ((input & 0x00ff) << 8);
            } else {
                this.output = input;
                for (i = 0; i < this.count; i++) {
                    c = (this.output & 0x8000) >>> 15;
                    this.output = ((this.output << 1) & 0xffff) | c;
                }
            }
            break;

        case ShifterOp.ROTATE_RIGHT:
            this.output = input;
            for (i = 0; i < this.count; i++) {
                c = (this.output & 1) << 15;
                this.output = (((this.output >>> 1) & 0xffff) | c) & 0xffff;
            }

            if (this.dns) {
                throw "DNS on Rotate Right, not possible.";
            }
            break;

        default:
            throw "Unhandled shift operation " + this.op;
        }

        return this.output;
    }
};
