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

var conversion = {
    msecToNsec: 1000000,
    usecToNsec: 1000
};

var DiskActivityType = {
    IDLE:  0,
    READ:  1,
    WRITE: 2,
    SEEK:  3
};

var diskController = {

    SECLATE:  0x10,
    NOTREADY: 0x20,
    STROBE:   0x40,
    SEEKFAIL: 0x80,

    recMap: [0, 2, 3, 1],

    kDataRead: 0,
    kDataWrite: 0,
    kDataWriteLatch: false,
    kAdr: 0,
    kCom: 0,
    kStat: 0,
    xferOff: false,
    wdInhib: false,
    bClkSource: false,
    wffo: false,
    sendAdr: false,

    // Transfer bit
    dataXfer: false,

    // Current Sector
    sector: 0,

    destCylinder: 0,
    seekDuration: 0,
    seeking: false,

    // Selected disk
    disk: 0,
    // bit clock flag
    diskBitCounterEnable: false,

    // WDINIT signal
    wdInit: false,

    syncWordWritten: false,

    sectorDuration: (40.0 / 12.0) * conversion.msecToNsec,

    wordDuration: function() {
        return this.sectorDuration / DiabloDrive.sectorWordCount;
    },

    seclateDuration: 86.0 * conversion.usecToNsec,

    // Variable, and updated depending on current sector / seek sector
    seekDuration: 0,

    drives: [new DiabloDrive(), new DiabloDrive()],

    getKdata: function() {
        this.debugRead = false;
        return this.kDataRead;
    },

    setKdata: function(value) {
        this.kDataWrite = value;
        this.kDataWriteLatch = true;
    },

    getKadr: function() {
        return this.kAdr;
    },

    getKstat: function() {
        return this.kstat;
    },

    setKadr: function(value) {
        console.log("setKadr");
        this.kAdr = value;
        this.recNo = 0;
        this.syncWordWritten = false;

        // "In addition, it causes the head address bit to be loaded
        // from KDATA[13]."
        var newHead = (this.kDataWrite & 0x4) >>> 2;
        this.selectedDrive().head = newHead;

        this.dataXfer = (this.kAdr & 0x2) != 0x2;

        //
        // Select disk from bit 14 of KDATA.
        // The HW reference claims that the drive is selected by bit
        // 14 of KDATA XOR'd with bit 15 of KADR but I can find no
        // evidence in the schematics that this is actually so. Page
        // 18 of the controller schematic ("DISK ADDRESSING") shows
        // that the current DATA(14) (KDATA bit 14) value is gated
        // into the DISK select lines (running to the drive) whenever
        // a KADR<- F1 is executed. It is possible that the HW ref is
        // telling the truth but the XORing is done by the Sector Task
        // uCode and not the hardware, but where this is actually
        // occurring is not obvious. At any rate: The below behavior
        // appears to work correctly, so I'm sticking with it.
        //

        this.disk = ((this.kDataWrite & 0x2) >>> 1);

        if ((this.kDataWrite & 0x1) != 0) {
            this.initSeek(0);
        }
    },

    getKcom: function() {
        return this.kCom;
    },

    setKcom: function(value) {
        this.kCom = value;

        this.xferOff = (this.kCom & 0x10) === 0x10;
        this.wdInhib = (this.kCom & 0x08) === 0x08;
        this.bClkSource = (this.kCom & 0x04) === 0x04;
        this.wffo = (this.kCom & 0x02) === 0x02;
        this.sendAdr = (this.kCom & 0x01) === 0x01;

        this.diskBitounterEnable = this.wffo;

        // Update WDINIT state based on wdInhib
        if (this.wdInhib) {
            this.wdInit = true;
        }

        if (this.sendAdr & (this.kDataWrite & 0x2) != 0) {
            this.seeking = false;
        }
    },

    getKstat: function() {
        return (this.kStat | 0x0f00);
    },

    setKstat: function(value) {
        this.kStat = value;
    },

    recno: function() {
        return this.recMap[this.recNo];
    },

    ready: function() {
        return this.drives[this.disk].isLoaded &&  !this.seeking;
    },

    fatalError: function() {
        return ((this.kStat & this.SECLATE) != 0 ||
                (this.kStat & this.SEEKFAIL) != 0 ||
                (this.kStat & this.NTREADY) != 0 ||
                (!this.ready()));
    },

    reset: function() {
        this.clearStatus();

        this.recNo = 0;
        this.sector = 0;
        this.disk = 0;
        this.kStat = 0;
        this.kDataRead = 0;
        this.kDataWrite = 0;
        this.kDataWriteLatch = false;
        this.sendAdr = false;
        this.seeking = false;

        this.wdInhib = true;
        this.xferOff = true;

        this.wdInit = false;

        this.syncWordWritten = false;

        this.diskBitCounterEnable = false;
        this.sectorWordIndex = 0;

        this.drives[0].reset();
        this.drives[1].reset();

        this.sectorEvent = new Event(0, null, this.sectorCallback);
        this.wordEvent = new Event(this.wordDuration(), null, this.wordCallback);
        this.seclateEvent = new Event(this.seclateDuration, null, this.seclateCallback);
        this.seekEvent = new Event(this.seekDuration, null, this.seekCallback);

        scheduler.schedule(this.sectorEvent);
    },

    clearStatus: function() {
    },

    selectedDrive: function() {
        return this.drives[this.disk];
    },

    disableSeclate: function() {
        this.seclateEnable = false;
    },

    spinDisk: function() {

    },

    // Callbacks

    sectorCallback: function(timeNsec, skewNsec, context) {
       console.log("DiskController: sectorCallback");
        var d = diskController;

        d.sector = (d.sector + 1) % 12;

        d.kStat = (d.kStat & 0xffff) | (d.sector << 12);

        if (d.drives[d.disk].isLoaded) {
            d.kStat &= (~(d.NOTREADY) & 0xffff);
        } else {
            d.kStat |= d.NOTREADY;
        }

        d.sectorWordIndex = 0;
        d.sectorWordWritten = false;

        d.kDataRead = 0;

        d.selectedDrive().sector = d.sector;

        if ((d.kStat & d.STROBE) == 0) {
            console.log("Waking up sector task for C/H/S "
                        + d.selectedDrive().cylinder + "/"
                        + d.selectedDrive().head + "/"
                        + d.sector);
            cpu.wakeupTask(TaskType.DISK_SECTOR);

            d.seclate = false;
            d.seclateEnable = true;
            d.kStat &= (~(d.SECLATE) & 0xffff);

            // Schedule a disk word wakup to spin the disk
            d.wordEvent.timestampNsec = d.wordDuration();
            scheduler.schedule(d.wordEvent);

            // Schedule SECLATE trigger
            d.seclateEvent.timestampNsec = d.seclateDuration;
            scheduler.schedule(d.seclateEvent);
        } else {
            d.sectorEvent.timestampNsec = d.secturDuration - skewNsec;
            scheduler.schedule(d.sectorEvent);
        }
    },

    wordCallback: function(timeNsec, skewNsec, context) {
        console.log("DiskController: wordCallback");
        var d = diskController;

        d.spinDisk();

        if(d.sectorWodIndex < DiabloDrive.sectorWordCount) {
            d.wordEvent.timestampNsec = d.wordDuration - skewNsec;
            scheduler.schedule(d.wordEvent);
        } else {
            d.sectorEvent.timestampNsec = skewNsec;
            scheduler.schedule(d.sectorEvent);
        }
    },

    seclateCallback: function(timeNsec, skewNsec, context) {
        console.log("DiskController: seclateCallback");
        var d = diskController;

        if (d.seclateEnable) {
            d.seclate = true;
            d.kStat |= d.SECLATE;
            console.log("SECLATE for sector " + d.sector);
        }
    },

    seekCallback: function(timeNsec, skewNsec, context) {
        console.log("DiskController: seekCallback");
    }

};
