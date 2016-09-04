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


var DiskBusSource = {
    READ_KSTAT: 3,
    READ_KDATA: 4
};

var DiskF1 = {
    STROBE: 9,
    LOAD_KSTAT: 10,
    INCRECNO: 11,
    CLRSTAT: 12,
    LOAD_KCOMM: 13,
    LOAD_KADR: 14,
    LOAD_KDATA: 15
};

var DiskF2 = {
    INIT: 8,
    RWC: 9,
    RECNO: 10,
    XFRDAT: 11,
    SWRNRDY: 12,
    NFER: 13,
    STROBON: 14
};

var DiskTask = function(taskType) {
    return {
        taskType: taskType,

        onTaskSwitch: function () {
            if (this.taskType == TaskType.DISK_SECTOR) {
                diskController.seclateEnable = false;
            }
        },

        getBusSource: function (bs) {
            switch (bs) {
                case DiskBusSource.READ_KSTAT:
                    return diskController.getKstat();
                case DiskBusSource.READ_KDATA:
                    return diskController.kDataRead;
                default:
                    throw "Unhandled bus source " + bs;
            }
        },

        executeSpecialFunction1: function (instruction) {
            switch (instruction.f1) {
                case DiskF1.LOAD_KDATA:
                    diskController.setKdata(this.busData);
                    break;

                case DiskF1.LOAD_KADR:
                    diskController.setKadr(this.busData & 0xff);
                    break;

                case DiskF1.LOAD_KCOMM:
                    diskController.setKcom((this.busData & 0x7c00) >>> 10);
                    break;

                case DiskF1.CLRSTAT:
                    diskController.clearStatus();
                    break;

                case DiskF1.INCRECNO:
                    diskController.incrementRecord();
                    break;

                case DiskF1.LOAD_KSTAT:
                    // "KSTAT[12-15] are loaded from BUS[12-15].  (Actually BUS[13] is ORed onto
                    //  KSTAT[13].)"

                    // From the schematic (and ucode source, based on the values it actually uses for BUS[13]), BUS[13]
                    // is also inverted.  So there's that, too.

                    // build BUS[12-15] with bit 13 flipped.

                    var modifiedBusData = (this.busData & 0xb) | ((~this.busData) & 0x4);
                    diskController.kStat = (diskController.getKstat() & 0xfff4) | modifiedBusData;
                    break;

                case DiskF1.STROBE:
                    diskController.strobe();
                    break;

                default:
                    throw "Unhandled disk special function 1 " + instruction.f1;
            }
        },

        executeSpecialFunction2: function (instruction) {
            switch (instruction.f2) {
                case DiskF2.INIT:
                    this.nextModifier |= this.getInitModifier(instruction);
                    break;

                case DiskF2.RWC:
                    var command = (diskController.kAdr & 0x00c0) >>> 6;
                    this.nextModifier |= this.getInitModifier(instruction);

                    switch (command) {
                        case 0:
                            // read, no modification
                            break;
                        case 1:
                            // check, OR in 2
                            this.nextModifier |= 0x2;
                            break;

                        case 2:
                        case 3:
                            // write, OR in 3
                            this.nextModifier |= 0x3;
                            break;
                    }
                    break;

                case DiskF2.XFRDAT:
                    this.nextModifier |= this.getInitModifier(instruction);

                    if (diskController.dataXfer) {
                        this.nextModifier |= 0x1;
                    }
                    break;

                case DiskF2.RECNO:
                    this.nextModifier |= this.getInitModifier(instruction);
                    this.nextModifier |= diskController.recno();
                    break;

                case DiskF2.NFER:
                    this.nextModifier |= this.getInitModifier(instruction);

                    if (!diskController.fatalError()) {
                        this.nextModifier |= 0x1;
                    }
                    break;

                case DiskF2.STROBON:
                    this.nextModifier |= this.getInitModifier(instruction);
                    if ((diskController.getKstat() & STROBE) !== 0) {
                        this.nextModifier |= 0x1;
                    }
                    break;

                case DiskF2.SWRNRDY:
                    this.nextModifier |= this.getInitModifier(instruction);

                    if (!diskController.ready()) {
                        this.nextModifier |= 0x1;
                    }
                    break;
                default:
                    throw "Unhandled disk special function 2 " + instruction.f2;
            }
        },

        executeBlock: function () {
            if (this.taskType == TaskType.DISK_WORD) {
                diskController.wdInit = false;
            }
        },

        getInitModifier: function (instruction) {
            //
            // "NEXT<-NEXT OR (if WDTASKACT AND WDINIT) then 37B else 0."
            //

            //
            // A brief discussion of the INIT signal since it isn't really
            // covered in the Alto Hardware docs in any depth (and in fact
            // is completely skipped over in the description of RWC, a
            // rather important detail!) This is where the Alto ref's
            // suggestion to have the uCode *and* the schematic on hand is
            // really quite a valid recommendation.
            //
            // WDINIT is initially set whenever the WDINHIB bit (set via
            // KCOM<-) is cleared (this is the WDALLOW signal). This
            // signals that the microcode is "INITializing" a data
            // transfer (so to speak). During this period, INIT or RWC
            // instructions in the Disk Word task will OR in 37B to the
            // Next field, causing the uCode to jump to the requisite
            // initialization paths. WDINIT is cleared whenever a BLOCK
            // instruction occurs during the Disk Word task, causing INIT
            // to OR in 0 and RWC to or in 0, 2 or 3 (For read, check, or
            // write respectively.)
            //

            if (this.taskType == TaskType.DISK_WORD && diskController.wdInit) {
                return 0x1f;
            } else {
                return 0x0;
            }
        },

        toString: function() {
            if (this.taskType == TaskType.DISK_SECTOR) {
                return "Disk Sector Task";
            } else {
                return "Disk Word Task";
            }
        }
    };
};

var diskSectorTask = extend(Task, new DiskTask(TaskType.DISK_SECTOR));
var diskWordTask = extend(Task, new DiskTask(TaskType.DISK_WORD));
