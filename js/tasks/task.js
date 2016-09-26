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
    DISK_SECTOR:     4,
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

var DisplayWordF2 = {
    LOAD_DDR:   8
};

var DisplayHorizontalF2 = {
    EVENTFIELD: 8,
    SETMODE:    9
};

var DisplayVerticalF2 = {
    EVENFIELD:  8
};

var CursorF2 = {
    LOAD_XPREG: 8,
    LOAD_CSR:   9
};

var EthernetBusSource = {
    EIDFCT: 4
};

var EthernetF1 = {
    EILFCT: 11,
    EPFCT:  12,
    EWFCT:  13
};

var EthernetF2 = {
    EODFCT: 8,
    EOSFCT: 9,
    ERBFCT: 10,
    EEFCT:  11,
    EBFCT:  12,
    ECBFCT: 13,
    EISFCT: 14
};

//
// Base Task implementation used by all tasks
//

var Task = {

    rdRam: false,
    rb: 0,
    swMode: false,
    wrtMode: false,
    wakeup: false,
    nextModifier: 0,
    skip: 0,
    busData: 0,
    rSelect: 0,
    srSelect: 0,
    loadS: false,
    loadR: false,
    wrtRam: false,
    wasSoftReset:false,

    baseReset: function () {
        this.mpc = this.taskType;
        this.rdRam = false;
        this.rb = 0;
        this.rSelect = 0;
        this.srSelect = 0;
        this.firstInstructionAfterSwitch = false;
        this.swMode = false;
        this.wrtRam = false;
        this.wakeup = false;
        this.nextModifier = 0;
        this.skip = 0;
    },

    reset: function () {
        return this.baseReset();
    },

    softReset: function () {
        this.mpc = this.taskType;
    },

    // Removes the Wakeup signal for this task
    blockTask: function () {
        this.wakeup = false;
    },

    // Sets the wakeup signal for this task
    wakeupTask: function () {
        this.wakeup = true;
    },

    // Execute a single microinstruction.
    //
    // Returns an 'InstructionCompletion' indicating whether this
    // instruction calls for a task switch or not.
    executeNext: function () {
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
    baseExecuteInstruction: function (instruction) {
        cpu.lastInstruction = instruction;

        if (system.instTrace) {
            console.log("> MPC=" + this.mpc.toString(8) +
                        " NEXTMOD=" + this.nextModifier +
                        " SKIP=" + this.skip.toString(8) +
                        " T=" + cpu.t.toString(8) +
                        " " + instruction);
        }

        var completion = InstructionCompletion.NORMAL;

        var swMode = false;
        var block = false;
        var aluData = 0;

        this.loadR = false;
        this.loadS = false;
        this.rSelect = 0;
        this.srSelect = 0;
        this.busData = 0;
        this.wasSoftReset = false;

        shifter.reset();

        if (instruction.memoryAccess) {
            if (!memoryBus.ready(instruction.memoryOperation)) {
                // Suspend operation for this cycle.
                return InstructionCompletion.MEMORY_WAIT;
            }
        }

        // If we have a modified next field from the last instruction, make sure it gets applied to this one.
        var nextModifier = this.nextModifier;
        this.nextModifier = 0;

        this.srSelect = this.rSelect = instruction.rselect;

        // Give tasks the chance to modify parameters early on (like RSELECT)
        this.executeSpecialFunction2Early(instruction);

        // Select BUS data.
        if (instruction.constantAccess) {
            this.busData = instruction.constantValue;
        } else {
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

                    if ((cpu.ir & 0x300) !== 0) {
                        if ((cpu.ir & 0x80) == 0x80) {
                            this.busData |= 0xff00;
                        }
                    }
                    break;

                default:
                    throw "Unhandled bus source " + instruction.bs;
            }
        }


        // Constant ROM access:
        //
        // "The constant memory is gated to the bus by F1=7, F2=7, or
        // BS>4. The constant memory is addressed by the (8 bit)
        // concatenation of RSELECT and BS. The intent in enabling
        // constants with BS>4 is to provide a masking facility,
        // particularly for the <-MOUSE and <-DISP bus sources. This
        // works because the processor bus ANDs if more than one
        // source is gated to it. Up to 32 such mask constants can be
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
        if (instruction.aluf != AluFunction.BUS) {
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
        if (this.swMode) {
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
                // Do MAR or XMAR reference based on whether F2 is MD<- (for Alto IIs), indicating an extended memory reference.
                memoryBus.loadMAR(aluData, this.taskType,
                    (Configuration.systemType == SystemType.ALTO_I) ?
                        false : (instruction.f2 == SpecialFunction2.STORE_MD));
                break;

            case SpecialFunction1.TASK:
                //
                // If the first uOp executed after a task switch contains
                // a TASK F1, it does not take effect. This is observed on
                // the real hardware, and does not appear to be
                // documented. It also doesn't appear to affect the
                // execution of the standard Alto uCode in any significant
                // way, but is included here for correctness.
                //
                if (!this.firstInstructionAfterSwitch) {
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
                if (this.busData === 0) {
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
                } else if (instruction.f1 != SpecialFunction1.LOAD_MAR) {
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
        switch (instruction.f2) {
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
                // has no 16-bit signed types, wheeee.
                if ((shifter.output & 0x8000) === 0x8000) {
                    this.nextModifier = 1;
                }
                break;

            case SpecialFunction2.SHEQ0:
                // See note above.
                if (shifter.output === 0) {
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
            cpu.s[this.rb][this.srSelect] = cpu.m;
        }

        // Load T
        if (instruction.loadT) {
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

        // Note we're using the local 'swMode' and 'nextModifier' here intentionally,
        // not the global ones.
        if (swMode) {
            uCodeMemory.switchMode((instruction.next | nextModifier) & 0xffff, this.taskType);
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
        // Note we're using the local 'nextModifier' here intentionally, not the global one.
        if (!this.wasSoftReset) {
            this.mpc = (instruction.next | nextModifier) & 0xffff;
        }

        this.firstInstructionAfterSwitch = false;

        return completion;
    },

    executeBlock: function () {
        // Nothing by default
    },

    onTaskSwitch: function () {
        // Nothing by default
    },

    executeInstruction: function (instruction) {
        return this.baseExecuteInstruction(instruction);
    },

    // Stub functions that will do nothing, if not implemented by
    // overriding objects.

    executeSpecialFunction1Early: function (instruction) {
    },

    executeSpecialFunction1: function (instruction) {
    },

    executeSpecialFunction2Early: function (instruction) {
    },

    executeSpecialFunction2: function (instruction) {
    },

    executeSpecialFunction2Late: function (instruction) {
    }

};

var displayWordTask = extend(Task, {
    taskType: TaskType.DISPLAY_WORD,

    executeSpecialFunction2: function(instruction) {
        switch(instruction.f2) {
            case DisplayWordF2.LOAD_DDR:
                displayController.loadDdr(this.busData);
                break;
            default:
                throw "Unhandled display word F2 " + instruction.f2;
         }
    },

    executeBlock: function() {
        displayController.setDwtBlock(true);

        if (!displayController.dhtBlocked) {
            cpu.wakeupTask(TaskType.DISPLAY_HORIZ);
        }
    },

    toString: function() {
        return "Display Word Task";
    }
});

var displayHorizontalTask = extend(Task, {
    taskType: TaskType.DISPLAY_HORIZ,

    onTaskSwitch: function() {
        this.wakeup = false;
    },

    executeSpecialFunction2: function(instruction) {
        switch(instruction.f2) {
            case DisplayHorizontalF2.EVENTFIELD:
                this.nextModifier |= (displayController.evenField ? 1 : 0);
                break;
            case DisplayHorizontalF2.SETMODE:
                displayController.setMode(this.busData);

                if ((this.busData & 0x8000) !== 0) {
                    this.nextModifier |= 1;
                }
                break;
            default:
                throw "Unhandled display horizontal F2 " + instruction.f2;
        }
    },

    executeBlock: function() {
        displayController.setDhtBlock(true);
    },

    toString: function() {
        return "Display Horizontal Task";
    }
});

var displayVerticalTask = extend(Task, {
    taskType: TaskType.DISPLAY_VERT,

    onTaskSwitch: function() {
        this.wakeup = false;
    },

    executeSpecialFunction2: function(instruction) {
        switch(instruction.f2) {
            case DisplayVerticalF2.EVENFIELD:
                this.nextModifier |= displayController.evenField ? 1 : 0;
                break;
            default:
                throw "Unandled display vertical f2 " + instruction.f2;
        }
    },

    toString: function() {
        return "Display Vertical Task";
    }
});

var cursorTask = extend(Task, {
    taskType: TaskType.CURSOR,

    onTaskSwitch: function() {
        this.wakeup = false;
    },

    executeSpecialFunction2: function(instruction) {
        switch(instruction.f2) {
            case CursorF2.LOAD_XPREG:
                displayController.loadXpreg(this.busData);
                break;
            case CursorF2.LOAD_CSR:
                displayController.loadCsr(this.busData);
                break;
            default:
                throw "Unhandled cursor F2 " + instruction.f2;
        }

    },

    toString: function() {
        return "Cursor Task";
    }
});

var memoryRefreshTask = extend(Task, {
    taskType: TaskType.MEMORY_REFRESH,

    executeSpecialFunction1Early: function(instruction) {
        if (Configuration.systemType == SystemType.ALTO_I &&
            instruction.f1 == SpecialFunction1.LOAD_MAR &&
            this.rSelect == 31) {
            this.blockTask();
        }
    },

    toString: function() {
        return "Memory Refresh Task";
    }
});

var ethernetTask = extend(Task, {
    taskType: TaskType.ETHERNET,

    executeInstruction: function(instruction) {

        // The Ethernet task only remains awake if there are pending data wakeups
        if (ethernetController.countdownWakeup) {
            // The resulting [Countdown] wakeup is cleared when the ether task next runs.
            ethernetController.countdownWakeup = false;
            this.wakeup = false;
        }

        return this.baseExecuteInstruction(instruction);
    },


    getBusSource: function(bs) {
        switch (bs) {
            case EthernetBusSource.EIDFCT:
                // Input Data Function. Gates the contents of the FIFO to BUS[0-15], and
                // increments the read pointer at the end of the cycle.
                return ethernetController.readInputFifo();
            default:
                throw "Unimplemented ethernet bus source";
        }
    },

    executeSpecialFunction1Early: function(instruction) {
        switch (instruction.f1) {
            case EthernetF1.EILFCT:
                // Early: Input Look Function. Gates the contents of the FIFO to BUS[0-15] but does
                // not increment the read pointer.
                this.busData &= ethernetController.peekInputFifo();
                break;
        }
    },

    executeSpecialFunction1: function(instruction) {
        switch (instruction.f1) {
            case EthernetF1.EILFCT:
                // nothing; handled in early handler
                break;
            case EthernetF1.EPFCT:
                // Post Function. Gates interface status to BUS[8-15]. Resets the interface at
                // the end of the cycle and removes wakeup for this task.
                this.busData &= ethernetController.status;
                ethernetController.resetInterface();
                this.wakeup = false;
                break;
            case EthernetF1.EWFCT:
                // Countdown Wakeup Function. Sets a flip flop in the interface that will
                // cause a wakeup to the Ether task on the next tick of SWAKMRT. This
                // function must be issued in the instruction after a TASK. The resulting
                // wakeup is cleared when the Ether task next runs.
                ethernetController.countdownWakeup = true;
                break;
            default:
                throw "Unimplemented Ethernet F1";
        }
    },

    executeSpecialFunction2: function(instruction) {
        switch (instruction.f2) {
            case EthernetF2.EODFCT:
                // Output Data Function. Loads the FIFO from BUS[0-15], then increments the
                // write pointer at the end of the cycle.
                ethernetController.writeOutputFifo(this.busData);
                break;

            case EthernetF2.EOSFCT:
                // Output Start Function. Sets the OBusy flip flop in the interface, starting
                // data wakeups to fill the FIFO for output. When the FIFO is full, or EEFct has
                // been issued, the interface will wait for silence on the Ether and begin
                // transmitting.
                ethernetController.startOutput();
                break;

            case EthernetF2.ERBFCT:
                // Reset Branch Function. This command dispatch function merges the ICMD
                // and OCMD flip flops, into NEXT[6-7]. These flip flops are the means of
                // communication between the emulator task and the Ethernet task. The
                // emulator task sets them from BUS[14-15] with the STARTF function, causing
                // the Ethernet task to wakeup, dispatch on them and then reset them with
                // EPFCT.
                this.nextModifier = (ethernetController.ioCmd << 2) & 0xffff;
                break;

            case EthernetF2.EEFCT:
                ethernetController.endTransmission();
                break;

            case EthernetF2.EBFCT:
                if (ethernetController.dataLate ||
                    ethernetController.ioCmd !== 0 ||
                    ethernetController.operationDone())
                {
                    this.nextModifier |= 0x4;
                }

                if (ethernetController.collision) {
                    this.nextModifier |= 0x8;
                }
                break;

            case EthernetF2.ECBFCT:
                // Countdown Branch Function. ORs a one into NEXT[7] if the FIFO is not
                // empty.
                if (!ethernetController.fifoEmpty()) {
                    this.nextModifier |= 0x4;
                }
                break;

            case EthernetF2.EISFCT:
                // Input Start Function. Sets the IBusy flip flop in the interface, causing it to
                // hunt for the beginning of a packet: silence on the Ether followed by a
                // transition. When the interface has collected two words, it will begin
                // generating data wakeups to the microcode.
                ethernetController.startInput();
                break;
            default:
                throw "Unimplemented Ethernet F2";
        }
    }
});

var parityTask = extend(Task, {
    taskType: TaskType.PARITY,
});
