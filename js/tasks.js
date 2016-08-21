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

        if (instruction.memoryAccess) {
            if (!memoryBus.ready(instruction.memoryOperation)) {
                // Suspend operation for this cycle.
                return InstructionCompletion.MEMORY_WAIT;
            }
        }

        // If we have a modified next field from the last instruction, make sure it gets applied to this one.
        nextModifier = this.nextModifier;
        this.nextModifier = 0;

        this.srSelect = this.rSelect = instruction.rselect;

        // Give tasks the chance to modify parameters early on (like RSELECT)
        this.executeSpecialFunction2Early(instruction);

        // Select BUS data.
        if (!instruction.constantAccess) {
            // Normal BUS data (not constant ROM access).
            switch (instruction.bs) {
            case BusSource.READ_R:
                this.busData = cpu.r[this.rSelect];
                break;
            case BusSource.LOAD_R:
                // "Loading R forces the BUS to 0 so that an ALU
                // function of 0 and T may be executed simultaneously"
                this.busData = 0;
                this.loadR = true;
                break;
            case BusSource.NONE:
                // "Enables no source to the BUS, leaving it all ones"
                this.busData = 0xffff;
                break;

            case BusSource.TASK_SPECIFIC_1:
            case BusSource.TASK_SPECIFIC_2:
                this.busData = this.getBusSource(instruction.bs);
                break;

            case BusSource.READ_MD:
                this.busData = memoryBus.readMD();
                break;

            case BusSource.READ_MOUSE:
                this.busData = mouse.pollMouseBits();
                break;

            case BusSource.READ_DISP:
                // "The high-order bits of IR cannot be read directly,
                // but the displacement field of IR (8 low order
                // bits), may be read with the <-DISP bus source. If
                // the X field of the instruction is zero (i.e. it
                // specifies page 0 addressing) then the DISP field of
                // the instruction is put on BUS[8-15] and BUS[0-7] is
                // zeroed. If the X field of the instruction is
                // nonzero (i.e. it specifies PC-relative or
                // base-register addressing) then the DISP field is
                // sign-extended and put on the bus." NB: the "X"
                // field of the NOVA instruction is IR[6-7]

                this.busData = cpu.ir & 0xff;

                if ((cpu.ir & 0x300) != 0) {
                    if ((cpu.ir & 0x80) == 0x80) {
                        this.busData |= 0xff00;
                    }
                }
                break;

            default:
                throw "Unhandled bus source " + instruction.bs;
            }
        } else {
            this.busData = instruction.constantValue;
        }


        // Constant ROM access:
        //
        // "The constant memory is gated to the bus by F1=7, F2=7, or
        // BS>4. The constant memory is addressed by the (8 bit)
        // concatenation of RSELECT and BS. The intent in enabling
        // constants with BS>4 is to provide a masking facility,
        // particularly for the <-MOUSE and <-DISP bus sources. This
        // works because the processor bus ANDs if more than one
        // source is gated to it. Up to 32 such mask contans can be
        // provided for each of the four bus sources > 4."
        //
        // This is precached by the MicroInstruction object.
        if (instruction.constantAccessOrBS4) {
            this.busData &= instruction.constantValue;
        }

        //
        // If there was a RDRAM operation last cycle, we AND in the
        // uCode RAM data here.
        //
        if (this.rdRam) {
            this.busData &= uCodeMemory.readRam();
            this.rdRam = false;
        }

        //
        // Let F1s that need to modify bus data before the ALU runs do
        // their thing (this is used by the emulator RSNF and Ethernet
        // EILFCT)
        //
        this.executeSpecialFunction1Early(instruction);

        // Do ALU operation.
        //
        // Small optimization: if we're just taking bus data across
        // the ALU, we won't go through the alu.execute call; this is
        // a decent performance gain for a bit more ugly code...
        if (instruction.ALUF != AluFunction.Bus) {
            aluData = alu.execute(instruction.aluf, this.busData, cpu.t, this.skip);
        } else {
            aluData = this.busData;
            alu.carry = 0;
        }

        //
        // If there was a WRTRAM operation last cycle, we write the
        // uCode RAM here using the results of this instruction's ALU
        // operation and the M register from the last instruction.
        //
        if (this.wrtRam) {
            uCodeMemory.writeRam(aluData, cpu.m);
            this.wrtRam = false;
        }

        //
        // If there was an SWMODE operation last cycle, we set the
        // flag to ensure it takes effect at the end of this cycle.
        //
        if (this.swMode)
        {
            this.swMode = false;
            swMode = true;
        }

        //
        // Do Special Functions
        //
        switch (instruction.f1) {
        case SpecialFunction1.NONE:
            // Do nothing
            break;

        case SpecialFunction1.LOAD_MAR:
            memoryBus.loadMAR(aluData,
                              this.taskType,
                              (Configuration.systemType == SystemType.ALTO_I) ?
                              false : instruction.f2 == SpecialFunction2.STORE_MD);
            break;

        case SpecialFunction1.TASK:
            //
            // If the first uOp executed after a task switch contains
            // a TASK F1, it does not take effect. This is observed on
            // the real hardware, and does not appear to be
            // documented. It also doensn't appear to affect the
            // execution of the standard Alto uCode in any significant
            // way, but is included here for correctness.
            //
            if (!this.firstInstructionAfterSwitch)
            {
                // Yield to other more important tasks
                completion = InstructionCompletion.TASK_SWITCH;
            }
            break;

        case SpecialFunction1.BLOCK:
            // Technically this is to be invoked by the hardware
            // device associated with a task. That logic would be
            // circuituous and unless there's a good reason not to
            // that is discovered later, I'm just going to directly
            // block the current task here.
            cpu.blockTask(this.taskType);

            block = true;
            break;

        case SpecialFunction1.LLSH1:
            shifter.setOperation(ShifterOp.SHIFT_LEFT, 1);
            break;

        case SpecialFunction1.LRSH1:
            shifter.setOperation(ShifterOp.SHIFT_RIGHT, 1);
            break;

        case SpecialFunction1.LLCY8:
            shifter.setOperation(ShifterOp.ROTATE_LEFT, 8);
            break;

        case SpecialFunction1.CONSTANT:
            // Ignored here; handled by constant ROM access logic above.
            break;

        default:
            this.executeSpecialFunction1(instruction);
            break;
        }

        switch (instruction.f2) {
        case SpecialFunction2.NONE:
            // Nothing
            break;
        case SpecialFunction2.BUSEQ0:
            if (this.busData == 0) {
                this.nextModifier = 1;
            }
            break;

        case SpecialFunction2.SHLT0:
            // Handled below, after the shifter runs
            break;

        case SpecialFunction2.SHEQ0:
            // Same as above
            break;

        case SpecialFunction2.BUS:
            // Select bits 6-15 (bits 0-9 in modern parlance) of the bus
            this.nextModifier = this.busData & 0x3ff;
            break;

        case SpecialFunction2.ALUCY:
            // ALUC0 is the carry produced by the ALU during the most
            // recent microinstruction that loaded L. It is *not* the
            // carry produced during the execution of the
            // microinstruction that contains the ALUCY function.
            this.nextModifier = cpu.aluC0;
            break;

        case SpecialFunction2.STORE_MD:
            // Special case for XMAR on non-Alto I machines: if F1 is
            // a LoadMAR we do nothing here; the handler for LoadMAR
            // will load the correct bank.
            if (Configuration.systemType == SystemType.ALTO_I) {
                memoryBus.loadMD(this.busData);
            } else if(instruction.F1 != SpecialFunction1.LoadMAR) {
                memoryBus.loadMD(this.busData);
            }
            break;
        case SpecialFunction2.CONSTANT:
            // Ignored here; handled by Constant ROM access logic above
            break;
        default:
            // Let the specific task implementation handle it.
            this.executeSpecialFunction2(instruction);
            break;
        }

        //
        // Do the shifter operation if we're doing an operation that
        // requires the shifter output (loading R, doing a LoadDNS,
        // modifying NEXT based on the shifter output.)
        //
        if (this.loadR || instruction.needShifterOutput) {
            // A crude optimization:  if there's no shifter operation,
            // we bypass the call to DoOperation and stuff L in Shifter.Output ourselves.
            if (shifter.op == ShifterOp.NONE) {
                shifter.output = cpu.l;
            } else {
                shifter.doOperation(cpu.l, cpu.t);
            }
        }

        //
        // Handle NEXT modifiers that rely on the Shifter output.
        //
        switch(instruction.f2) {
        case SpecialFunction2.SHLT0:
            //
            // Note:
            // "the value of SHIFTER OUTPUT is determined by the value
            // of L as the microinstruction *begins* execution and the
            // shifter function specified during the *current*
            // microinstruction.
            //
            // Since we haven't modifed L yet, and we've calculated
            // the shifter output above, we're good to go here.
            //

            // Originally: 'if (shifter.output < 0)', but JavaScript
            // has no 16-bit types, wheeee.
            if ((shifter.output & 0x8000) == 0x8000)  {
                this.nextModifier = 1;
            }
            break;

        case SpecialFunction2.SHEQ0:
            // See note above.
            if (shifter.output == 0) {
                this.nextModifier = 1;
            }
            break;
        }

        //
        // Write back to registers:
        //
        // Do writeback to selected R register from shifter output.
        //
        if (this.loadR) {
            cpu.r[this.rSelect] = shifter.output;
        }

        // Do writeback to selected S register from M
        if (this.loadS) {
            cpu.s[rb][srSelect] = cpu.m;
        }

        // Load T
        if (instruction.LoadT) {
            // Does this operation change the source for T?
            cpu.t = instruction.loadTFromALU ? aluData : this.busData;

            //
            // Control RAM: "...the control RAM address is specified
            // by the control RAM address register... which is loaded
            // from the ALU output whenver T is loaded from its
            // source."
            //
            uCodeMemory.loadControlRamAddress(aluData);
        }

        // Load L (and M) from ALU outputs.
        if (instruction.loadL) {
            cpu.l = aluData;

            // Only RAM-related tasks can modify M.  (Currently only the Emulator.)
            if (this.taskType == TaskType.EMULATOR) {
                cpu.m = aluData;
            }

            // Save ALUC0 for use in the next ALUCY special function.
            cpu.aluC0 = alu.carry;
        }

        //
        // Execute special functions that happen late in the cycle
        //
        this.executeSpecialFunction2Late(instruction);

        //
        // Switch banks if the last instruction had an SWMODE F1; this
        // depends on the value of the NEXT field in this instruction.
        // (And apparently the modifier applied to NEXT in this
        // instruction -- MADTEST expects this.)
        //
        if (swMode) {
            uCodeMemory.switchMode((instruction.next | nextModifier), this.taskType);
        }

        //
        // Do task-specific BLOCK behavior if the last instruction had a BLOCK F1.
        //
        if (block) {
            this.executeBlock();
        }

        //
        // Select next address, using the address modifier from the
        // last instruction. (Unless a soft reset occurred during this
        // instruction)
        //
        if (!this.softReset) {
            this.mpc = (instruction.next | nextModifier);
        }

        this.firstInstructionAfterSwitch = false;

        return completion;
    },

    executeBlock: function() {
        // Nothing by default
    },

    onTaskSwitch: function() {
        // Nothing by default
    },

    executeInstruction: function(instruction) {
        return this.baseExecuteInstruction(instruction);
    },

    // Stub functions that will do nothing, if not implemented by
    // overriding objects.

    executeSpecialFunction1Early: function(instruction) {
    },

    executeSpecialFunction1: function(instrcution) {
    },

    executeSpecialFunction2Early: function(instruction) {
    },

    executeSpecialFunction2: function(instruction) {
    },

    executeSpecialFunction2Late: function(instruction) {
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
        instruction = uCodeMemory.getInstruction(this.mpc, this.taskType);
        return this.executeInstruction(instruction);
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
        case EmulatorBusSource.LOAD_S_LOCATION:
            this.loadS = true;
            return 0xffff;
            break;
        default:
            throw "Unhandled bus source " + bs;
        }
    },

    executeSpecialFunction1Early: function(instruction) {
        switch(instruction.f1) {
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

    executeSpecialFunction1: function(instruction) {
        switch(instruction.f1) {
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
            if ((this.busData & 0x8000) != 0) {
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
                this.softReset = true;
            } else if(this.busData != 0) {
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
                    console.log("STARTF for non-Ethernet device (code "
                                + this.busData.toString(8) + ")");
                }
            }
            break;

        case EmulatorF1.SWMODE:
            thsi.swMode = true;
            break;

        case EmulatorF1.RDRAM:
            this.rdRam = true;
            break;

        case EmulatorF1.WRTRAM:
            this.wrtRam = true;
            break;

        case EmulatorF1.LOAD_ESRB:
            this.rb = (this.busData & 0xe) >>> 1;

            if (this.rb != 0 &&
                Configuration.systemType != SystemType.THREE_K_RAM) {
                // Force bank 0 for machines with only 1K RAM.
                this.rb = 0;
            }
            break;

        default:
            throw "Unhandled emulator F1 " + instruction.f1 + ".";
        }
    },

    executeSpecialFunction2Early: function(instruction) {
        switch (instruction.f2)
        {
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

    executeSpecialFunction2: function(instruction) {
        switch (instruction.f2) {
        case EmulatorF2.LOAD_IR:
            // Load IR from the bus
            cpu.ir = this.busData;

            // "IR<- also merges bus bits 0, 5, 6 and 7 into NEXT[6-9]
            // which does a first level instruction dispatch."
            this.nextModifier = (((this.busData & 0x8000) >>> 12) |
                                 ((this.busData & 0x0700) >>> 8));

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
            if ((cpu.ir & 0x8000) != 0)
            {
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
            if ((cpu.ir & 0x8000) != 0) {
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
            this.loadR = (cpu.ir & 0x0008) == 0;

            // At this point the ALU has already done its operation
            // but the shifter has not yet run. We need to set the
            // CARRY bit that will be passed through the shifter
            // appropriately.

            // Select carry input value based on carry control
            switch(cpu.ir & 0x30) {
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
                if (cpu.aluC0 != 0) {
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

    executeSpecialFunction2Late: function(instruction) {
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
                this.skip = (carry == 0) ? 1 : 0;
                break;

            case 3:     // SNC
                // Skip if carry result is nonzero
                this.skip = carry;
                break;

            case 4:     // SZR
                this.skip = (result == 0) ? 1 : 0;
                break;

            case 5:     // SNR
                this.skip = (result != 0) ? 1 : 0;
                break;

            case 6:     // SEZ
                this.skip = (result == 0 || carry == 0) ? 1 : 0;
                break;

            case 7:     // SBN
                this.skip = (result != 0 && carry != 0) ? 1 : 0;
                break;
            }

            if (this.loadR)
            {
                // Write carry flag back.
                this.carry = carry;
            }
            break;
        }
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
