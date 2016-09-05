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

var AltoIoTable = {
    0x6210: "MUL",
    0x6211: "DIV",
    0x6203: "RCLK",
    0x6204: "SIO",
    0x6205: "BLT",
    0x6206: "BLKS",
    0x6207: "SIT",
    0x6208: "JMPRAM",
    0x6209: "RDRAM",
    0x620a: "WRTRAM",
    0x620c: "VERSION",
    0x620d: "DREAD",
    0x620e: "DWRITE",
    0x620f: "DEXCH",
    0x6212: "DIAGNOSE1",
    0x6213: "DIAGNOSE2",
    0x6214: "BITBLT",
    0x6215: "XMLDA",
    0x6216: "XMSTA"
};

var InstructionClass = {
    MEM:         0x0000,
    LDA:         0x2000,
    STA:         0x4000,
    ALTO_SPEC_1: 0x6000,
    ALTO_SPEC_2: 0x7000
};

var AlcFunctions = {
    0x000: "COM",
    0x100: "NEG",
    0x200: "MOV",
    0x300: "INC",
    0x400: "ADC",
    0x500: "SUB",
    0x600: "ADD",
    0x700: "AND"
};

var AlcShift = {
    0x00: "",
    0x40: "L",
    0x80: "R",
    0xc0: "S"
};

var AlcCarry = {
    0x00: "",
    0x10: "Z",
    0x20: "O",
    0x30: "C"
};

var AlcSkip = {
    0x0: "",
    0x1: "SKP",
    0x2: "SZC",
    0x3: "SNC",
    0x4: "SZR",
    0x5: "SNR",
    0x6: "SEZ",
    0x7: "SBN"
};

var MemFunction = {
    0x0000: "JMP",
    0x0800: "JSR",
    0x1000: "ISZ",
    0x1800: "DSZ"
};

var MemIndex = {
    PAGEZERO:    0x000,
    PCRELATIVE:  0x100,
    AC2RELATIVE: 0x200,
    AC3RELATIVE: 0x300
};

var novaDisassembler = {
    // Returns a string containing the disassembled instruction
    disassembleInstruction: function(address, instructionWord) {
        switch (instructionWord & 0xe000) {
            case InstructionClass.MEM:
                return this.disassembleMem(address, instructionWord);
            case InstructionClass.LDA:
            case InstructionClass.STA:
                return this.disassembleLoadStore(address, instructionWord);
            case InstructionClass.ALTO_SPEC_1:
            case InstructionClass.ALTO_SPEC_2:
                return this.disassembleAltoSpecific(address, instructionWord);
            default:
                return this.disassembleAlc(address, instructionWord);
        }
    },

    // Sign extend a 8-bit number to JS's 64-bit representation
    signExtendByte: function(num) {
        if ((num & 0x80) !== 0) {
            return -(256 - num);
        }

        return num;
    },

    disassembleMem: function(address, instructionWord) {
        var result = [];

        var func = MemFunction[instructionWord & 0x1800];
        var indirect = (instructionWord & 0x400) !== 0;
        var index = instructionWord & 0x300;
        var disp = this.signExtendByte(instructionWord & 0xff);

        switch (index) {
            case MemIndex.PAGEZERO:
                result.push(func);
                if (indirect) { result.push("@"); }
                result.push(" ");
                result.push(disp.toString(8));
                break;
            case MemIndex.PCRELATIVE:
                result.push(func);
                if (indirect) { result.push("@"); }
                result.push(" .+");
                result.push(disp.toString(8));
                result.push("   ;(");
                result.push((disp + address).toString(8));
                result.push(")");
                break;
            case MemIndex.AC2RELATIVE:
                result.push(func);
                if (indirect) { result.push("@"); }
                result.push(" AC2+");
                result.push(disp.toString(8));
                break;
            case MemIndex.AC3RELATIVE:
                result.push(func);
                if (indirect) { result.push("@"); }
                result.push(" AC3+");
                result.push(disp.toString(8));
                break;
            default:
                throw "Unexpected index type";
        }

        return result.join("");
    },

    disassembleLoadStore: function(address, instructionWord) {
        var result = [];

        var ac = (instructionWord & 0x1800) >>> 11;
        var indirect = (instructionWord & 0x400) !== 0;
        var index = instructionWord & 0x300;
        var disp = this.signExtendByte(instructionWord & 0xff);

        var inst = ((instructionWord & 0x6000) === InstructionClass.LDA) ? "LDA" : "STA";

        switch (index) {
            case MemIndex.PAGEZERO:
                result.push(inst);
                if (indirect) { result.push("@"); }
                result.push(" ");
                result.push(ac);
                result.push(",");
                result.push(disp.toString(8));
                break;
            case MemIndex.PCRELATIVE:
                result.push(inst);
                if (indirect) { result.push("@"); }
                result.push(" ");
                result.push(ac);
                result.push(",.+");
                result.push(disp.toString(8));
                result.push("   ;(");
                result.push((disp + address).toString(8));
                result.push(")");
                break;
            case MemIndex.AC2RELATIVE:
                result.push(inst);
                if (indirect) { result.push("@"); }
                result.push(" ");
                result.push(ac);
                result.push(",AC2+");
                result.push(disp.toString(8));
                break;
            case MemIndex.AC3RELATIVE:
                result.push(inst);
                if (indirect) { result.push("@"); }
                result.push(" ");
                result.push(ac);
                result.push(",AC3+");
                result.push(disp.toString(8));
                break;
            default:
                throw "Unexpected index type";
        }

        return result.join("");
    },

    disassembleAltoSpecific: function(address, instructionWord) {
        var result = [];

        // Check for alto-specific instructions that do not use DISP field
        if (AltoIoTable[instructionWord] !== undefined) {
            result.push(AltoIoTable[instructionWord]);
        } else {
            var topBits = (instructionWord & 0xff00);

            switch (topBits) {
                case 0x6000:
                    result.push("CYCLE ");
                    result.push((instructionWord & 0xf).toString(8));
                    break;

                case 0x6900:
                    result.push("JSRII ");
                    result.push((instructionWord & 0xff).toString(8));
                    result.push("   ;(");
                    result.push((address + (instructionWord & 0xff)).toString(8));
                    result.push(")");
                    break;

                case 0x6a00:
                    result.push("JSRIS ");
                    result.push((instructionWord & 0xff).toString(8));
                    break;

                case 0x6e00:
                    result.push("CONVERT ");
                    result.push((instructionWord & 0xff).toString(8));
                    break;

                default:
                    // Unimplemented, treat as a TRAP to either ROM or RAM
                    result.push("TRAP");
                    break;
            }
        }

        return result.join("");
    },

    disassembleAlc: function(address, instructionWord) {
        var result = [];

        var srcAC = (instructionWord & 0x6000) >>> 13;
        var dstAC = (instructionWord & 0x1800) >>> 11;
        var func = AlcFunctions[instructionWord & 0x700];
        var shift = AlcShift[instructionWord & 0xc0];
        var carry = AlcCarry[instructionWord & 0x30];
        var noLoad = ((instructionWord & 0x8) !== 0);
        var skip = AlcSkip[instructionWord & 0x7];

        result.push(func);
        result.push(shift);
        result.push(carry);
        if (noLoad) { result.push("#"); }
        result.push(" ");
        result.push(srcAC);
        result.push(",");
        result.push(dstAC);

        if (skip !== "") {
            result.push(",");
            result.push(skip);
        }

        return result.join("");
    },

    dumpMem: function(startAddress, endAddress) {
        for (var i = startAddress; i < endAddress; i++) {
            var word = memoryBus.readFromBus(i, TaskType.EMULATOR, false);

            var result = [];

            result.push(this.toOctalWord(i));
            result.push(this.toOctalWord(word));
            result.push(this.disassembleInstruction(i, word));

            console.log(result.join("   "));
        }
    },

    toOctalWord: function(num) {
        var str = "" + num.toString(8);
        var padding = "000000";

        return padding.substring(0, 6 - str.length) + str;
    }
};

var altoDebugger = {
    decodeKblk: function() {
        // Find the KBLK at 0521 and decode it.

        // "Pointer to first disk command block"
        var dcbp = memoryBus.readFromBus(0521, TaskType.EMULATOR, false);
        // "Status at the beginning of the current sector"
        var sectorStatus = memoryBus.readFromBus(0522, TaskType.EMULATOR, false);
        // "Disk address of most-recently started disk command"
        var lastAddr = memoryBus.readFromBus(0523, TaskType.EMULATOR, false);
        // "Sector interrupt bit mask"
        var imask = memoryBus.readFromBus(0524, TaskType.EMULATOR, false);


        console.log("KBLK:");
        console.log(">>> Address of first Disk Command Block: " + dcbp.toString(8));
        console.log(">>> Status of current sector: ");
        this.decodeStatusWord(sectorStatus);


        while (dcbp !== 0) {
            console.log(">>> DCB At Address " + dcbp.toString(8));
            this.decodeStatusWord(memoryBus.readFromBus(dcbp + 1, TaskType.EMULATOR, false));
            this.decodeAddress(memoryBus.readFromBus(dcbp + 9));

            // Get NEXT dcbp
            dcbp = memoryBus.readFromBus(dcbp, TaskType.EMULATOR, false);
        }
    },

    decodeStatusWord: function(statusWord) {
        console.log("    > Sector Number: " + ((statusWord >>> 12) & 0xf));
        console.log("    > Completion: " + (statusWord & 3));
        console.log("    > Checksum Err: " + ((statusWord >>> 2) & 1));
        console.log("    > No Transfer: " + ((statusWord >>> 3) & 1));
        console.log("    > Late Processing: " + ((statusWord >>> 4) & 1));
        console.log("    > Disk Unit Not Rdy: " + ((statusWord >>> 5) & 1));

    },

    decodeAddress: function(addrWord) {
        console.log(">>> Disk Address: C/H/S = " +
                    ((addrWord & 0x0ff8) >> 3) + "/" +
                    ((addrWord & 0x0004) >> 2) + "/" +
                    ((addrWord & 0xf000) >>> 12));
    },

    novaRegisters: function() {
        for (var i = 0; i <= 7; i++) {
            console.log("R[" + i + "]: " + cpu.r[i].toString(8));
        }
    }

};

