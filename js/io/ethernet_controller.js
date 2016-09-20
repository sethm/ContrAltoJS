/* This file implements the Alto Ethernet interface. The implementation here differs
 * from the implementation used in Contralto. Contralto simulates a sixteen word
 * FIFO queue and appears to stop and wake the Ethernet task at the correct intervals
 * at which real 3mbit Ethernet bytes would arrive.
 *
 * There are no timers in Javascript with high enough resolution to simulate this, so
 * this implementation does not simulate the FIFO queue or byte timing; instead words
 * are read and written to byte arrays and the Ethernet microcode task is coerced into
 * writing or reading whole Ethernet frames in one go.
 *
 * This implementation seems to work, and is much simpler and more legible than the
 * original, but since it causes the Ethernet task to run longer than it would in a
 * real Alto, it is possible it may cause unforeseen issues. - MLT
 */

function joinNetwork() {
    ethernetController.joinPeerToPeerNetwork();
    document.getElementById("joinNetworkButton").disabled = true;
}

var InputState = {
    ReceiverOff:     0,
    ReceiverWaiting: 1,
    Receiving:       2,
    ReceiverDone:    3
};

var ethernetController = {
    /* TODO: Generate address based on other Altos already on the network */
    address: 43,
    countdownWakeup: false,
    dataLate: false,
    collision: false,
    incomplete: false,
    isFifoEmpty: true,
    ioCmd: 0,
    oBusy: false,
    iBusy: false,

    verbose: false,

    inputState: InputState.ReceiverOff,

    outgoingFrameBuffer: null,
    outgoingFrameLength: 0,
    incomingFrameQueue: [],
    incomingFrameArray: null,
    incomingFrameIndex: 0,


    init: function() {
        /* This is the constructor. */

        /* Setting the buffer size to 600. This should be enough for:
             Ethernet source and destination (two bytes)
             Ethernet packet type (two bytes)
             PUP packet, maximum of 554 bytes (including 20 byte header), according to wikipedia
             Two byte PUP checksum
         */

        this.outgoingFrameBuffer = new ArrayBuffer(600);
        this.outgoingFrameArray  = new Uint8Array(this.outgoingFrameBuffer);
        this.incomingFrameQueue  = [];

        if(typeof RetroWeb === "undefined") {
            console.log("RetroWeb networking components not found. No networking will be available.");
            this.network = null;
            return;
        }

        return this;
    },

    joinPeerToPeerNetwork: function() {
        console.log("Joining the RetroWeb peer-to-peer network.");

        const ETHERNET_ADDR_BROADCAST = 0x00;

        function stateChangedCallback(state) {
            document.getElementById("joinNetworkButton").innerText = state;
        }
        function gotNetworkPacket(dst, src, frame) {
            this.incomingFrameQueue.push(frame);
            this.beginReadingFrame();
        }
        this.network = new RetroWeb.BinarySwitchedNetwork(
            "Alto",
            RetroWeb.peerJSConfig,
            gotNetworkPacket.bind(this),
            stateChangedCallback.bind(this)
        );
        this.network.joinRoom();
        this.network.broadcastId = ETHERNET_ADDR_BROADCAST;
    },

    reset: function() {
    },

    startf: function(busData) {
        this.ioCmd = busData & 0x3;
        cpu.wakeupTask(TaskType.ETHERNET);
    },

    operationDone: function() {
        return (!this.oBusy && !this.iBusy);
    },

    fifoEmpty: function() {
        return this.isFifoEmpty;
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
        this.isFifoEmpty = true;
        this.inputState = InputState.ReceiverOff;

        cpu.blockTask(TaskType.ETHERNET);

        this.abortCurrentFrame();
    },

    /* ************************ Output functions ************************* */

    startOutput: function() {
        "use strict";

        // Sets the OBusy flip-flop in the interface
        this.oBusy = true;

        // When outputing, pretend the fifo is always empty
        this.isFifoEmpty = true;

        // Prepare to write new frame
        this.outgoingFrameLength = 0;

        // Enables wakeups to start writing data
        cpu.wakeupTask(TaskType.ETHERNET);
    },

    writeOutputFifo: function(busData) {
        this.outgoingFrameArray[this.outgoingFrameLength++] = (busData & 0xFF00) >> 8;
        this.outgoingFrameArray[this.outgoingFrameLength++] =  busData & 0x00FF;
    },

    endTransmission: function() {
        "use strict";
        cpu.blockTask(TaskType.ETHERNET);

        var frame = this.outgoingFrameArray.subarray(0, this.outgoingFrameLength);

        this.debug("Ethernet_controller: transmit packet of length ", this.outgoingFrameLength);

        if(this.network) {
            // Send packet on the network
            var dstAddress = frame[0];
            var srcAddress = frame[1];
            this.network.sendFrame(dstAddress, srcAddress, frame);
        }

        // Signal we are done
        this.oBusy = false;
        cpu.wakeupTask(TaskType.ETHERNET);
    },

    /* ************************ Input functions ************************* */

    startInput: function() {
        this.debug("Ethernet_controller: startInput:");

        // " Sets the IBusy flip flop in the interface..."
        // "...restarting the receiver... causes [the controller] to ignore the current packet and hunt
        //  for the beginning of the next packet."

        //
        // So, two things:
        //  1) Cancel any pending input packet
        //  2) Start listening for more packets if we weren't already doing so.
        //
        if(this.iBusy) {
            this.abortCurrentFrame();
        }

        this.inputState = InputState.ReceiverWaiting;
        this.iBusy = true;

        if(this.incomingFrameQueue.length) {
            this.beginReadingFrame();
        } else {
            cpu.blockTask(TaskType.ETHERNET);
        }
    },

    beginReadingFrame: function() {
        if(this.inputState !== InputState.ReceiverWaiting) {
            return;
        }

        var frame = this.incomingFrameQueue.shift();

        this.debug("Ethernet_controller: receiving packet of length ", frame.length);

        this.inputState = InputState.Receiving;

        this.incomingFrameArray = frame;
        this.incomingFrameIndex = 0;

        // When reading a frame, pretend the FIFO always has data
        this.isFifoEmpty = false;

        cpu.wakeupTask(TaskType.ETHERNET);
    },

    peekInputFifo: function(isRead) {
        if(this.inputState !== InputState.Receiving) {
            return 0;
        }

        var byte1 = this.incomingFrameArray[this.incomingFrameIndex];
        var byte2 = this.incomingFrameArray[this.incomingFrameIndex+1];

        return (byte1 << 8) | byte2;
    },

    readInputFifo: function() {
        if(this.inputState !== InputState.Receiving) {
            return 0;
        }

        var read = this.peekInputFifo(true);

        // Advance to next word
        this.incomingFrameIndex += 2;

        // When we have read the last word clear IBUSY to indicate to the microcode
        // that we've finished.
        if(this.incomingFrameIndex == this.incomingFrameArray.length) {
            this.iBusy = false;
            this.inputState = InputState.ReceiverDone;
            cpu.wakeupTask(TaskType.ETHERNET);
        }
        return read;
    },

    abortCurrentFrame: function() {
        if(this.incomingFrameArray && this.inputState !== InputState.ReceiverDone) {
            this.debug("Read aborted. ", this.incomingFrameIndex, " out of ", this.incomingFrameArray.length, "bytes read from previous packet");
        }
    },

    debug() {
        if(this.verbose) {
            console.log.apply(console, arguments);
        }
    }
}.init();