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
    usecToNsec: 1000,
};

var DiskActivityType = {
    IDLE: 0,
    READ: 1,
    WRITE: 2,
    SEEK: 3
};

var SECLATE = 0x10;
var NOTREADY = 0x20;
var STROBE = 0x40;
var SEEKFAIL = 0x80;
var SECTOR_DURATION = Math.round((40.0 / 12.0) * conversion.msecToNsec);
var WORD_DURATION = Math.round(SECTOR_DURATION / SECTOR_WORD_COUNT);
var SECLATE_DURATION = 86.0 * conversion.usecToNsec;

var diskController = {
    recMap: [0, 2, 3, 1],

    kDataRead: 0,
    kDataWrite: 0,
    kDataWriteLatch: false,
    kAdr: 0,
    kCom: 0,
    kStat: 0,
    xferOff: true,
    wdInhib: true,
    bClkSource: false,
    wffo: false,
    sendAdr: false,
    seclateEnable: false,

    // Transfer bit
    dataXfer: false,

    // Current Sector
    sector: 0,

    lastDiskActivity: DiskActivityType.READ,

    destCylinder: 0,
    seeking: false,

    // Selected disk
    disk: 0,
    // bit clock flag
    diskBitCounterEnable: false,

    // WDINIT signal
    wdInit: false,

    syncWordWritten: false,

    // Variable, and updated depending on current sector / seek sector
    seekDuration: 0,

    drives: [new DiabloDrive(), new DiabloDrive()],

    setKdata: function (value) {
        this.kDataWrite = value;
        this.kDataWriteLatch = true;
    },

    setKadr: function (value) {
        this.kAdr = value;
        this.recNo = 0;
        this.syncWordWritten = false;

        // "In addition, it causes the head address bit to be loaded
        // from KDATA[13]."
        this.selectedDrive().setHead((this.kDataWrite & 0x4) >>> 2);

        // "0 normally, 1 if the command is to terminate immediately
        // after the correct cylinder position is reached (before
        // any data is transferred)."
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

        if ((this.kDataWrite & 0x1) !== 0) {
            this.initSeek(0);
        }
    },

    setKcom: function (value) {
        this.kCom = value;
        this.xferOff = (this.kCom & 0x10) === 0x10;
        this.wdInhib = (this.kCom & 0x08) === 0x08;
        this.bClkSource = (this.kCom & 0x04) === 0x04;
        this.wffo = (this.kCom & 0x02) === 0x02;
        this.sendAdr = (this.kCom & 0x01) === 0x01;

        this.diskBitCounterEnable = this.wffo;

        // Update WDINIT state based on wdInhib
        if (this.wdInhib) {
            this.wdInit = true;
        }

        if ((this.sendAdr & (this.kDataWrite & 0x2)) !== 0) {
            this.seeking = false;
        }
    },

    getKstat: function () {
        return (this.kStat | 0x0f00) & 0xffff;
    },

    recno: function () {
        return this.recMap[this.recNo];
    },

    ready: function () {
        return this.drives[this.disk].isLoaded() && !this.seeking;
    },

    fatalError: function () {
        return ((this.kStat & SECLATE) !== 0 ||
        (this.kStat & SEEKFAIL) !== 0 ||
        (this.kStat & NOTREADY) !== 0 ||
        (!this.ready()));
    },

    reset: function () {
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
        this.seclateEnable = false;

        this.wdInhib = true;
        this.xferOff = true;

        this.wdInit = false;

        this.syncWordWritten = false;

        this.diskBitCounterEnable = false;
        this.sectorWordIndex = 0;

        this.drives[0].reset();
        this.drives[1].reset();

        //Create events to be reused during execution
        this.sectorEvent = new Event(0, null, this.sectorCallback);
        this.wordEvent = new Event(WORD_DURATION, null, this.wordCallback);
        this.seclateEvent = new Event(SECLATE_DURATION, null, this.seclateCallback);
        this.seekEvent = new Event(this.seekDuration, null, this.seekCallback);

        // And schedule the first sector pulse
        scheduler.schedule(this.sectorEvent);
    },

    sectorCallback: function (timeNsec, skewNsec, context) {
        var d = diskController;

        var drive = d.selectedDrive();

        if (system.diskTrace) {
            console.log("Sector Callback for C/H/S=" +
                        drive.cylinder + "/" + drive.head + "/" + drive.sector);
        }

        d.sector = (d.sector + 1) % 12;
        d.kStat = ((d.kStat & 0x0fff) | (d.sector << 12));

        if (drive.isLoaded()) {
            d.kStat &= (~NOTREADY & 0xffff);
        } else {
            d.kStat |= NOTREADY;
        }

        d.sectorWordIndex = 0;
        d.sectorWordWritten = false;

        d.kDataRead = 0;

        drive.setSector(d.sector);

        if ((d.kStat & STROBE) === 0) {
            cpu.wakeupTask(TaskType.DISK_SECTOR);

            d.seclate = false;
            d.seclateEnable = true;
            d.kStat &= (~SECLATE & 0xffff);

            // Schedule a disk word wakeup to spin the disk
            d.wordEvent.timestampNsec = WORD_DURATION;
            scheduler.schedule(d.wordEvent);

            // Schedule SECLATE trigger
            d.seclateEvent.timestampNsec = SECLATE_DURATION;
            scheduler.schedule(d.seclateEvent);
        } else {
            d.sectorEvent.timestampNsec = SECTOR_DURATION - skewNsec;
            scheduler.schedule(d.sectorEvent);
        }
    },

    wordCallback: function (timeNsec, skewNsec, context) {
        var d = diskController;

        d.spinDisk();

        if (d.sectorWordIndex < SECTOR_WORD_COUNT) {
            d.wordEvent.timestampNsec = WORD_DURATION - skewNsec;
            scheduler.schedule(d.wordEvent);
        } else {
            d.sectorEvent.timestampNsec = skewNsec;
            scheduler.schedule(d.sectorEvent);
        }
    },

    seclateCallback: function (timeNsec, skewNsec, context) {
        var d = diskController;

        if (d.seclateEnable) {
            d.seclate = true;
            d.kStat |= SECLATE;
        }
    },

    clearStatus: function () {
        this.kStat &= 0xff4b;
        this.seclate = false;
    },

    incrementRecord: function () {
        // "Advances the shift registers holding the KADR register so that they present the
        //  number and read/write/check status of the next record to the hardware."
        // "RECORD" in this context indicates the sector field corresponding to the 2 bit
        // "action" field in the KADR register (i.e. one of Header, Label, or Data.)
        // INCRECNO shifts the data over two bits to select from Header->Label->Data.

        this.kAdr = (this.kAdr << 2);

        this.recNo++;

        this.syncWordWritten = false;

        if (this.recNo > 3) {
            // Sanity check
            throw "Unexpected INCRECORD past rec 3.";
        }
    },

    strobe: function () {
        if (!this.sendAdr) {
            throw "STROBE while SENDADR bit of KCOM not 1. Unexpected";
        }

        this.initSeek((this.kDataWrite & 0x0ff8) >>> 3);
    },

    initSeek: function (destCylinder) {
        if (system.diskTrace) {
            console.log("Seeking to cylinder " + destCylinder);
        }

        if (!this.selectedDrive().isLoaded() || destCylinder > (this.selectedDrive().pack.geometry.cylinders - 1)) {
            this.kStat |= SEEKFAIL;
            this.seeking = false;
            this.lastDiskActivity = DiskActivityType.IDLE;
        } else if (destCylinder !== this.selectedDrive().cylinder) {
            // Start a seek
            this.destCylinder = destCylinder;

            // Clear the fail bit.
            this.kStat &= (~SEEKFAIL & 0xffff);

            // Set seek bit.
            this.kStat |= STROBE;
            this.seeking = true;


            this.seekDuration = Math.round(this.calculateSeekTime() /
                                           (Math.abs(this.destCylinder - this.selectedDrive().cylinder) + 1));

            this.seekEvent.timestampNsec = this.seekDuration;
            scheduler.schedule(this.seekEvent);

            this.lastDiskActivity = DiskActivityType.SEEK;
        } else {
            // Clear the fail bit.
            this.kStat &= (~SEEKFAIL & 0xffff);
        }
    },

    calculateSeekTime: function () {
        // TODO: Calucate real seek time
        // var dt = Math.abs(this.destCylinder - this.selectedDrive().cylinder);

        // For now, just be fast
        var seekTimeMsec = 1.0;

        return (seekTimeMsec * conversion.msecToNsec);
    },

    spinDisk: function () {
        //
        // Roughly:  If transfer is enabled:
        //   Select data word based on elapsed time in this sector.
        //   On a new word, wake up the disk word task if not inhibited.
        //
        // If transfer is not enabled BUT the disk word task is enabled,
        // we will still wake up the disk word task if the appropriate clock
        // source is selected.
        //
        // We simulate the movement of a sector under the heads by dividing
        // the sector into word-sized timeslices.  Not all of these slices
        // will actually contain valid data -- some are empty, used by the microcode
        // for lead-in or inter-record delays, but the slices are still used to
        // keep things in line time-wise; the real hardware uses a crystal-controlled clock
        // to generate these slices during these periods (and the clock comes from the
        // drive itself when actual data is present).  For our purposes, the two clocks
        // are one and the same.
        //

        //
        // Pick out the word that just passed under the head.  This may not be
        // actual data (it could be the pre-header delay, inter-record gaps or sync words)
        // and we may not actually end up doing anything with it, but we may
        // need it to decide whether to do anything at all.
        //

        var diskWord = this.selectedDrive().readWord(this.sectorWordIndex);

        var bWakeup = false;

        //
        // If the word task is enabled AND the write ("crystal") clock is enabled
        // then we will wake up the word task now.
        //

        if (!this.seclate && !this.wdInhib && !this.bClkSource) {
            bWakeup = true;
        }

        //
        // If the clock is enabled OR the WFFO bit is set (go ahead and run the bit clock)
        // and we weren't late reading this sector,  then we will wake up the word task
        // and read in the data if transfers are not inhibited.
        //
        if (!this.seclate && (this.wffo || this.diskBitCounterEnable)) {
            if (!this.xferOff) {
                if (!this.isWrite()) {
                    // Read
                    this.kDataRead = diskWord.data;
                    this.lastDiskActivity = DiskActivityType.READ;
                } else {
                    // Write
                    if (this.kDataWriteLatch) {
                        this.kDataRead = this.kDataWrite;
                        this.kDataWriteLatch = false;
                    }

                    if (this.syncWordWritten) {
                        // Commit actual data to disk now that the sync word has been laid down.
                        this.selectedDrive().writeWord(this.sectorWordIndex, this.kDataWrite);
                        this.lastDiskActivity = DiskActivityType.WRITE;
                    }
                }
            }

            if (!this.wdInhib) {
                bWakeup = true;
            }
        }

        //
        // If the WFFO bit is cleared (wait for the sync word to be read)
        // then we check the word for a "1" (the sync word) to enable
        // the clock.  This occurs late in the cycle so that the NEXT word
        // (not the sync word) is actually read.
        //

        if (!this.isWrite() && !this.wffo && diskWord.data == 1) {
            this.diskBitCounterEnable = true;
        } else if (this.isWrite() && this.wffo && this.kDataWrite == 1 && !this.syncWordWritten) {

            this.syncWordWritten = true;

            // "Adjust" the write index to the start of the data area
            // for our current record. This is cheating.
            switch (this.recNo) {
                case 0:
                    this.sectorWordIndex = HEADER_OFFSET;
                    break;
                case 1:
                    this.sectorWordIndex = LABEL_OFFSET;
                    break;
                case 2:
                    this.sectorWordIndex = DATA_OFFSET;
                    break;
            }
        }

        if (bWakeup) {
            cpu.wakeupTask(TaskType.DISK_WORD);
        }

        this.sectorWordIndex++;
    },

    isWrite: function () {
        return ((this.kAdr & 0x00c0) >>> 6) == 2 || ((this.kAdr & 0x00c0) >>> 6) == 3;
    },

    seekCallback: function (timeNsec, skewNsec, context) {
        if (system.diskTrace) {
            console.log("Seek Callback!");
        }
        var d = diskController;
        var drive = d.selectedDrive();

        if (drive.cylinder < d.destCylinder) {
            drive.setCylinder(drive.cylinder + 1);
        } else if (d.selectedDrive().cylinder > d.destCylinder) {
            drive.setCylinder(drive.cylinder - 1);
        }

        if (d.selectedDrive().cylinder === d.destCylinder) {
            d.kStat &= (~STROBE & 0xffff);
            d.seeking = false;
        } else {
            d.seekEvent.timestampNsec = d.seekDuration - skewNsec;
            scheduler.schedule(d.seekEvent);
            d.lastDiskActivity = DiskActivityType.SEEK;
        }
    },

    selectedDrive: function () {
        return this.drives[this.disk];
    }


};
