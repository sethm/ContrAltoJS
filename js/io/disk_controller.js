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

var Drive = function() {
    this.headerOffset = 44;

    this.sectorWordCount = 269 + this.headerOffset + 34;

    this.reset = function() {};
};

var diskController = {

    sectorDuration: (40.0 / 12.0) * conversion.msecToNsec,

    WORD_DURATION: this.sectorDuration / Drive.sectorWordCount,

    seclateDuration: 86.0 * conversion.usecToNsec,

    // Variable, and updated depending on current sector / seek sector
    seekDuration: 0,

    drives: [new Drive(), new Drive()],

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
        this.wordEvent = new Event(this.wordDuration, null, this.wordCallback);
        this.seclateEvent = new Event(this.seclateDuration, null, this.seclateCallback);
        this.seekEvent = new Event(this.seekDuration, null, this.seekCallback);

        scheduler.schedule(this.sectorEvent);
    },

    clearStatus: function() {
    },

    // Callbacks

    sectorCallback: function(timeNsec, skewNsec, context) {
        // TODO : Implemenet more
        scheduler.schedule(diskController.sectorEvent);
    },

    wordCallback: function(timeNsec, skewNsec, context) {
        console.log("DiskController: wordCallback");
    },

    seclateCallback: function(timeNsec, skewNsec, context) {
        console.log("DiskController: seclateCallback");
    },

    seekCallback: function(timeNsec, skewNsec, context) {
        console.log("DiskController: seekCallback");
    }

};
