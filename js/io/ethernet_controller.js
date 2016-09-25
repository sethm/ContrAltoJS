
/* The full Ethernet controller as it exists in Contralto
 * is not implemented.
 *
 * See "ethernet_controller_abridged.js" for the current,
 * preliminary and highly experimental implementation */

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

        // The bits in the status are active low, according to Alto Hardware Manual, Aug 76,
        // so when the condition is NOT TRUE, we need to SET the corresponding bits.

        if (!this.dataLate) {
            this.status |= 0x20;
        }

        if (!this.collision) {
            this.status |= 0x10;
        }

        if (!this.crcBad) {
            this.status |= 0x08;
        }

        if (!this.incomplete) {
            this.status |= 0x01;
        }

        /* From the Contralto code:
         *
         *   this.status |= (((~0 & 0x3) << 1) & 0xffff);
         *
         * The above expression resolves to 0x06, setting the two bits that aren't
         * set by the other conditions. These must be the IOCMD bits, because the
         * original Contralto code says:
         *
         *    TODO: we're clearing the IOCMD bits here early -- validate why this works.
         *
         * Note that setting the bits CLEARS the state (because the status bits are
         * active low), so the comment makes sense. Not sure why that line was so
         * obscure. I think someone was having a bit of fun with us :) -- MLT
         */
        this.status |= (0x04 | 0x02);

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