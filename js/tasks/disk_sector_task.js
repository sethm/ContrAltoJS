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

var diskSectorTask = extend(Task, {
    taskType: TaskType.DISK_SECTOR,

    onTaskSwitch: function() {
        console.log("Switching to DiskSectorTask");
        diskController.disableSeclate();
    },

    getBusSource: function(bs) {
        switch(bs) {
        case DiskBusSource.READ_KSTAT:
            return diskController.getKstat();
        case DiskBusSource.READ_KDATA:
            return diskController.getKdata();
        default:
            throw "Unhandled bus source " + bs;
        };
    },

    executeSpecialFunction1: function(instruction) {
        console.log("DiskSectorTask executeSpecialFunction1");

        switch (instruction.f1) {
        case DiskF1.LOAD_KDATA:
            console.log("Loading KDATA");
            diskController.setKdata(this.busData);
            break;

        case DiskF1.LOAD_KADR:
            console.log("Loading KADR");
            diskController.setKadr(this.busData & 0xff);
            break;

        case DiskF1.LOAD_KCOMM:
            console.log("Loading KCOMM");
            diskController.setKcom(this.busData & 0x7c00 >>> 10);
            break;

        case DiskF1.CLRSTAT:
            console.log("Clearing Status");
            diskController.clearStatus();
            break;

        case DiskF1.INCRECNO:
            diskController.incrementRecord();
            break;

        case DiskF1.LOAD_KSTAT:
            console.log("LOAD KSTAT");
            var modifiedBusData = (this.busData & 0xb) | ((~this.busData & 0x4));
            diskController.setKstat((diskController.getKstat() & 0xfff4) | modifiedBusData);
            break;

        case DiskF1.STROBE:
            diskController.strobe();
            break;

        default:
            throw "Unhandled disk special function 1 " + instruction.f1;
        }

    },

    reset: function() {
        this.baseReset();
    }
});
