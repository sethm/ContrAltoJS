
// NOT IMPLEMENTED
var ethernetController = {
    address: 043,
    countdownWakeup: false,
    dataLate: false,
    collision: false,
    incomplete: false,
    fifo: [],

    ioCmd: 0,
    oBusy: false,
    iBusy: false,

    reset: function() {
    },

    startf: function(busData) {
        this.ioCmd = busData & 0x3;
        cpu.wakeupTask(TaskType.ETHERNET);
    },

    operationDone: function() {
        return (!this.oBusy && !this.iBusy);
    },

    resetInterface: function() {
        this.status = 0xffc0;
        if (this.dataLate) {
            this.status |= 0x20;
        }

        if (this.collision) {
            this.status |= 0x10;
        }

        if (this.crcBad) {
            this.status |= 0x08;
        }

        // WAT? TODO: Copied verbatim, what the heck is going on here
        this.status |= (((~0 & 0x3) << 1) & 0xffff);

        if (this.incomplete) {
            this.status |= 0x01;
        }

        this.ioCmd = 0;
        this.oBusy = false;
        this.iBusy = false;
        this.dataLate = false;
        this.crcBad = false;
        this.incomplete = false;
        this.fifo = [];

        cpu.blockTask(TaskType.ETHERNET);

    },

    readInputFifo: function() {

        if (this.fifo.length === 0) {
            return 0;
        }

        var read = this.fifo.shift();

        if (this.fifo.count < 2) {
            if (this.inGone) {
                this.iBusy = false;
                cpu.wakeupTask(TaskType.ETHERNET);
            }
        } else {
            cpu.blockTask(TaskType.ETHERNET);
        }

        return 0;
    },

    peekInputFifo: function() {
        if (this.fifo.length === 0) {
            return 0;
        }

        return this.fifo.peek();
    },

    writeOutputFifo: function(busData) {
        this.fifo.push(busData);
    },

    startOutput: function() {
        "use strict";
        this.oBusy = true;
        cpu.wakeupTask(TaskType.ETHERNET);
    },

    startInput: function() {
    },

    endTransmission: function() {
        "use strict";
        this.fifo = [];
        cpu.blockTask(TaskType.ETHERNET);
    },

    fifoEmpty: function() {
        return (this.fifo.length === 0);
    }

};