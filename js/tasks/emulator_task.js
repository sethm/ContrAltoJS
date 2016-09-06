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

var emulatorTask = extend(Task, {
    taskType: TaskType.EMULATOR,

    wakeup: true,
    srSelect: 0,
    priority: 0,
    loadS: false,

    reset: function () {
        this.baseReset();
        this.rb = 0;
        this.srSelect = 0;
        this.loadS = false;
        this.wakeup = true;
    },

    blockTask: function () {
        throw("The emulator task cannot be blocked.");
    },

    wakeupTask: function () {
        throw("The emulator task is always in wakeup state.");
    },

    getBusSource: function (bs) {
        switch (bs) {
            case EmulatorBusSource.READ_S_LOCATION:
                if (this.srSelect !== 0) {
                    return cpu.s[this.rb][this.srSelect];
                } else {
                    // "...when reading data from the S registers onto the processor bus,
                    //  the RSELECT value 0 causes the current value of the M register to
                    //  appear on the bus..."
                    return cpu.m;
                }
                break;
            case EmulatorBusSource.LOAD_S_LOCATION:
                this.loadS = true;
                return 0xffff;
            default:
                throw "Unhandled bus source " + bs;
        }
    },

    executeSpecialFunction1Early: function (instruction) {
        switch (instruction.f1) {
            case EmulatorF1.RSNF:
                //
                // Early:
                // "...decoded by the Ethernet interface, which gates the
                // host address wired on the backplane onto BUS[8-15].
                // BUS[0-7] is not driven and will therefore be -1. If no
                // Ethernet interface is present, BUS will be -1.
                //
                this.busData &= (0xff00 | ethernetController.address);
                break;
        }
    },

    executeSpecialFunction1: function (instruction) {
        switch (instruction.f1) {
            case EmulatorF1.LOAD_RMR:
                //
                // "The emulator F1 RMR<- causes the reset mode register
                // to be loaded from the processor bus. The 16 bits of the
                // processor bus correspond to the 16 Alto tasks in the
                // following way: the low order bit of the processor bus
                // specifies the initial mode of task 0, the lowest
                // priority task (emulator), and the high-order bit of the
                // bus specifies the initial mode of task 15, the highest
                // priority task(recall that task i starts at location i;
                // the reset mode register determines only which
                // microinstruction bank will be used at the outset). A
                // task will commence in ROM0 if its associated bit in the
                // reset mode register contains the value 1; otherwise it
                // will start in RAM0.Upon initial power - up of the Alto,
                // and after each reset operation, the reset mode register
                // is automatically set to all ones, corresponding to
                // starting all tasks in ROM0."
                //
                cpu.rmr = this.busData;
                break;

            case EmulatorF1.RSNF:
                // Handled in the Early handler.
                break;

            case EmulatorF1.STARTF:
                // Dispatch function to Ethernet I/O based on contents of AC0.
                if ((this.busData & 0x8000) !== 0) {
                    //
                    // BOOT (soft-reset) operation. Reset the CPU using
                    // the current RMR (start tasks in RAM or ROM as
                    // specified.)
                    cpu.softReset();

                    // Since this is a soft reset, we don't want MPC to be
                    // taken from the NEXT field at the end of the cycle,
                    // setting this flag causes the main Task
                    // implementation to skip updating _mpc at the end of
                    // this instruction.
                    this.wasSoftReset = true;
                } else if (this.busData !== 0) {
                    //
                    // Dispatch to the appropriate device. The Ethernet
                    // controller is the only common device that is
                    // documented to have used STARTF, so we'll just go
                    // there directly; if other hardware is determined to
                    // be worth emulating we'll put together a more
                    // flexible dispatch.
                    //
                    if (this.busData < 4) {
                        ethernetController.startf(this.busData);
                    } else {
                        console.log("STARTF for non-Ethernet device (code " + this.busData.toString(8) + ")");
                    }
                }
                break;

            case EmulatorF1.SWMODE:
                this.swMode = true;
                break;

            case EmulatorF1.RDRAM:
                this.rdRam = true;
                break;

            case EmulatorF1.WRTRAM:
                this.wrtRam = true;
                break;

            case EmulatorF1.LOAD_ESRB:
                this.rb = (this.busData & 0xe) >>> 1;

                if (this.rb !== 0 &&
                    Configuration.systemType != SystemType.THREE_K_RAM) {
                    // Force bank 0 for machines with only 1K RAM.
                    this.rb = 0;
                }
                break;

            default:
                throw "Unhandled emulator F1 " + instruction.f1 + ".";
        }
    },

    executeSpecialFunction2Early: function (instruction) {
        switch (instruction.f2) {
            case EmulatorF2.ACSOURCE:
                // Early: modify R select field: "...it replaces the
                // two-low order bits of the R select field with the
                // complement of the SrcAC field of IR, (IR[1-2] XOR 3),
                // allowing the emulator to address its accumulators
                // (which are assigned to R0-R3)."
                this.rSelect = (this.rSelect & 0xfffc) | (((cpu.ir & 0x6000) >>> 13) ^ 3);
                break;

            case EmulatorF2.ACDEST:
            // "...causes (IR[3-4] XOR 3) to be used as the low-order
            // two bits of the RSELECT field. This address the
            // accumulators from the destination field of the
            // instruction. The selected register may be loaded or
            // read."

            // (Fall through intentional...)
            case EmulatorF2.LOAD_DNS:
                //
                // "...DNS also addresses R from (3-IR[3 - 4])..."
                //
                this.rSelect = (this.rSelect & 0xfffc) | (((cpu.ir & 0x1800) >>> 11) ^ 3);
                break;
        }
    },

    executeSpecialFunction2: function (instruction) {
        switch (instruction.f2) {
            case EmulatorF2.LOAD_IR:
                // Load IR from the bus
                cpu.ir = this.busData;

                // "IR<- also merges bus bits 0, 5, 6 and 7 into NEXT[6-9]
                // which does a first level instruction dispatch."
                this.nextModifier = (((this.busData & 0x8000) >>> 12) | ((this.busData & 0x0700) >>> 8));

                // "IR<- clears SKIP"
                this.skip = 0;
                break;

            case EmulatorF2.IDISP:
                // "The IDISP function (F2=15B) does a 16 way dispatch
                // under control of a PROM and a multiplexer. The values
                // are tabulated below:
                //
                //   Conditions             ORed onto NEXT   Comment
                //
                //   if IR[0] = 1           3-IR[8-9]        complement of SH field of IR
                //   elseif IR[1-2] = 0     IR[3-4]          JMP, JSR, ISZ, DSZ  ; dispatch selects register
                //   elseif IR[1-2] = 1     4                LDA
                //   elseif IR[1-2] = 2     5                STA
                //   elseif IR[4-7] = 0     1
                //   elseif IR[4-7] = 1     0
                //   elseif IR[4-7] = 6     16B              CONVERT
                //   elseif IR[4-7] = 16B   6
                //   else                   IR[4-7]
                //
                // NB: as always, Xerox labels bits in the opposite order
                // from modern convention; (bit 0 is the msb...)
                //
                // NOTE: The above table is accurate and functions
                // correctly; using the PROM is faster.
                //
                if ((cpu.ir & 0x8000) !== 0) {
                    this.nextModifier = (3 - ((cpu.ir & 0xc0) >>> 6));
                } else {
                    this.nextModifier = ACSROM[((cpu.ir & 0x7f00) >>> 8) + 0x80];
                }
                break;

            case EmulatorF2.ACSOURCE:
                // Late:
                // "...a dispatch is performed:
                //   Conditions             ORed onto NEXT   Comment
                //
                //   if IR[0] = 1           3-IR[8-9]        complement of SH field of IR
                //   if IR[1-2] = 3         IR[5]            the Indirect bit of R
                //   if IR[3-7] = 0         2                CYCLE
                //   if IR[3-7] = 1         5                RAMTRAP
                //   if IR[3-7] = 2         3                NOPAR -- parameterless opcode group
                //   if IR[3-7] = 3         6                RAMTRAP
                //   if IR[3-7] = 4         7                RAMTRAP
                //   if IR[3-7] = 11B       4                JSRII
                //   if IR[3-7] = 12B       4                JSRIS
                //   if IR[3-7] = 16B       1                CONVERT
                //   if IR[3-7] = 37B       17B              ROMTRAP -- used by Swat, the debugger
                //   else                   16B              ROMTRAP

                //
                // NOTE: the above table from the Hardware Manual is
                // incorrect (or at least incomplete / out of date /
                // misleading). There is considerably more that goes into
                // determining the dispatch, which is controlled by a
                // 256x8 PROM. We just use the PROM rather than
                // implementing the above logic (because it works.)
                //
                if ((cpu.ir & 0x8000) !== 0) {
                    // 3-IR[8-9] (shift field of arithmetic instruction)
                    this.nextModifier = (3 - ((cpu.ir & 0xc0) >>> 6));
                } else {
                    // Use the PROM.
                    this.nextModifier = ACSROM[((cpu.ir & 0x7f00) >>> 8)];
                }

                break;

            case EmulatorF2.ACDEST:
                // Handled in early handler, nothing to do here.
                break;

            case EmulatorF2.BUSODD:
                // "...merges BUS[15] into NEXT[9]."
                this.nextModifier |= this.busData & 0x1;
                break;

            case EmulatorF2.MAGIC:
                shifter.magic = true;
                break;

            case EmulatorF2.LOAD_DNS:
                // DNS<- does the following:
                //
                // - modifies the normal shift operations to perform
                //   Nova-style shifts (done here)
                // - addresses R from 3-IR[3-4] (destination AC)
                //   (see Early LoadDNS handler)
                // - stores into R unless IR[12] is set (done here)
                // - calculates Nova-style CARRY bit (done here)
                // - sets the SKIP and CARRY flip-flops appropriately
                //   (see Late LoadDNS handler)
                var carry = 0;

                // Also indicates modifying CARRY
                this.loadR = (cpu.ir & 0x0008) === 0;

                // At this point the ALU has already done its operation
                // but the shifter has not yet run. We need to set the
                // CARRY bit that will be passed through the shifter
                // appropriately.

                // Select carry input value based on carry control
                switch (cpu.ir & 0x30) {
                    case 0x00:
                        // Nothing; CARRY unaffected.
                        carry = this.carry;
                        break;

                    case 0x10:
                        carry = 0;  // Z
                        break;

                    case 0x20:
                        carry = 1;  // O
                        break;

                    case 0x30:
                        carry = (~this.carry) & 0x1;  // C
                        break;
                }

                // Now modify the result based on the current ALU result
                switch (cpu.ir & 0x700) {
                    case 0x000:
                    case 0x200:
                    case 0x700:
                        // COM, MOV, AND - Carry unaffected
                        break;

                    case 0x100:
                    case 0x300:
                    case 0x400:
                    case 0x500:
                    case 0x600:
                        // NEG, INC, ADC, SUB, ADD - invert the carry bit
                        if (cpu.aluC0 !== 0) {
                            carry = (~carry) & 0x1;
                        }
                        break;
                }

                // Tell the Shifter to do a Nova-style shift with the
                // given carry bit.
                shifter.setDns(true, carry);

                break;

            default:
                throw "Unhandled emulator F2 " + instruction.f2 + ".";
        }
    },

    executeSpecialFunction2Late: function (instruction) {
        switch (instruction.f2) {
            case EmulatorF2.LOAD_DNS:
                //
                // Set SKIP and CARRY flip-flops based on the final result
                // of the operation after having passed through the
                // shifter.
                //
                var result = shifter.output;
                var carry = shifter.dnsCarry;

                switch (cpu.ir & 0x7) {
                    case 0:
                        // None, SKIP is reset
                        this.skip = 0;
                        break;

                    case 1:     // SKP
                        // Always skip
                        this.skip = 1;
                        break;

                    case 2:     // SZC
                        // Skip if carry result is zero
                        this.skip = (carry === 0) ? 1 : 0;
                        break;

                    case 3:     // SNC
                        // Skip if carry result is nonzero
                        this.skip = carry;
                        break;

                    case 4:     // SZR
                        this.skip = (result === 0) ? 1 : 0;
                        break;

                    case 5:     // SNR
                        this.skip = (result !== 0) ? 1 : 0;
                        break;

                    case 6:     // SEZ
                        this.skip = (result === 0 || carry === 0) ? 1 : 0;
                        break;

                    case 7:     // SBN
                        this.skip = (result !== 0 && carry !== 0) ? 1 : 0;
                        break;
                }

                if (this.loadR) {
                    // Write carry flag back.
                    this.carry = carry;
                }
                break;
        }
    },

    toString: function () {
        return "Emulator Task [rb=" + this.rb + ", srSelect=" + this.srSelect + "]";
    }
});
