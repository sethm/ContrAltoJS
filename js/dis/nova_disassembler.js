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
    MEM: 0x0000,
    LDA: 0x2000,
    STA: 0x4000,
    ALTO_SPEC_1: 0x6000,
    ALTO_SPEC_2: 0x7000
};

var AlcFunctions = {
    COM: 0x000,
    NEG: 0x100,
    MOV: 0x200,
    INC: 0x300,
    ADC: 0x400,
    SUB: 0x500,
    ADD: 0x600,
    AND: 0x700
};

var ShiftMode = {
    NONE: 0x00,
    L:    0x40,
    R:    0x80,
    S:    0xc0
};

var AlcCarry = {
    NONE: 0x00,
    Z:    0x10,
    O:    0x20,
    C:    0x30
};

var AlcSkip = {
    NONE: 0x0,
    SKP:  0x1,
    SZC:  0x2,
    SNC:  0x3,
    SZR:  0x4,
    SNR:  0x5,
    SEZ:  0x6,
    SBN:  0x7
};

var MemFunction = {
    JMP: 0x0000,
    JSR: 0x0800,
    ISZ: 0x1000,
    DSZ: 0x1800
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

    disassembleMem: function(address, instructionWord) {
        var result = [];

        var func = instructionWord & 0x1800;
        var indirect = (instructionWord & 0x400) != 0;
        var index = instructionWord & 0x300;
        var disp = instructionWord & 0xff;

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
                throw "Unexpected index type"
        }

        return result.join("");
    },

    disassembleLoadStore: function(address, instructionWord) {
        var result = [];

        var ac = (instructionWord & 0x1800) >>> 11;
        var indirect = (instructionWord & 0x400) != 0;
        var index = instructionWord & 0x300;
        var disp = instructionWord & 0xff;

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

        return result.join("");
    },

    disassembleAlc: function(address, instructionWord) {
        var result = [];

        return result.join("");
    },

    dumpMem: function(startAddress, endAddress) {
        for (var i = startAddress; i < endAddress; i++) {
            var word = memoryBus.readFromBus(i, TaskType.EMULATOR, false);

            // TODO: This is just sanity checking. Remove it.
            if (word > 0xffff) {
                throw "Should never read a word greater than ffff"
            }

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