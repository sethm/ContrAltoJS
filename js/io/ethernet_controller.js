
/* This file implements the complete Alto Ethernet interface based on
 * the code in the native Contralto.
 *
 * I suggest using "ethernet_controller_abridged.js", which takes some
 * shortcuts to improve performance in Javascript and seems to work
 * more consistently.
 *
 * Authors:
 *   - Seth J. Morabito
 *   - Marcio Teixeira
 */

var InputState = {
    ReceiverOff:     0,
    ReceiverWaiting: 1,
    Receiving:       2,
    ReceiverDone:    3
};

class EthernetControllerFifo {
    constructor() {
        // Length must be power of two for wrap-around to work
        this.length     = 16;
        this.mask       = this.length - 1;
        this.buffer     = new ArrayBuffer(this.length * Uint16Array.BYTES_PER_ELEMENT);
        this.array      = new Uint16Array(this.buffer);
        this.count      = 0;
        this.writeIndex = 0;
        this.readIndex  = 0;
    }

    enqueue(data) {
        this.array[this.writeIndex++] = data;
        this.writeIndex = this.writeIndex & this.mask; // Wrap-around
        this.count++;
    }

    peek() {
        return this.array[this.readIndex];
    }

    dequeue() {
        var data = this.array[this.readIndex++];
        this.readIndex = this.readIndex & this.mask; // Wrap-around
        this.count--;
        return data;
    }

    clear() {
        this.readIndex  = 0;
        this.writeIndex = 0;
        this.count = 0;
    }

    copyTo(array, byteOffset) {
        // Unlike Contralto, the offset is specified in bytes.
        var i = this.readIndex;
        while(i != this.writeIndex) {
            var data = this.array[i++];
            i = i & this.mask; // Wrap-around
            array[byteOffset++] = (data & 0xFF00) >> 8;
            array[byteOffset++] =  data & 0x00FF;
        }
    }
}

var ethernetController = {
    address: 043,

    fifo: null,

    verbose: false,

    // Bits in Status register

    ioCmd: 0,
    dataLate: false,
    collision: false,
    crcBad: false,
    incomplete: false,
    status: 0,

    countdownWakeup: false,

    oBusy: false,
    iBusy: false,
    inGone: false,

    // FIFO scheduling

    // Transmit:
    fifoTransmitDuration: 87075,       // ~87000 nsec to transmit 16 words at 3mbit, assuming no collision
    fifoTransmitWakeupEvent: null,

    // Receive:
    inputPollPeriod: 5400,       // ~5400 nsec to receive 1 word at 3mbit
    inputPollEvent: null,

    inputState: InputState.ReceiverOff,

    maxQueuedPackets: 32,

    // Buffer to hold outgoing data to the host ethernet
    outputData:  null,
    outputIndex: 0,

    // Incoming data
    incomingPacketQueue: [],
    incomingPacketArray: null,
    incomingPacketLength: 0,
    incomingPacketIndex: 0,

    init: function() {
        "use strict";
        /* This is the constructor. */
        this.fifo = new EthernetControllerFifo();
        this.reset();

        this.fifoTransmitWakeupEvent = new Event(this.fifoTransmitDuration, null, this.outputFifoCallback.bind(this));

        /* Setting the buffer size to 600. This should be enough for:
             Ethernet source and destination (two bytes)
             Ethernet packet type (two bytes)
             PUP packet, maximum of 554 bytes (including 20 byte header), according to wikipedia
             Two byte PUP checksum
         */
        this.outputData  = new Uint8Array(new ArrayBuffer(600));

        this.incomingPacketQueue = [];

        return this;
    },

    joinPeerToPeerNetwork: function(connectionStateChangedCallback) {
        console.log("Joining the RetroWeb peer-to-peer network.");

        const ETHERNET_ADDR_BROADCAST = 0x00;

        function gotNetworkPacket(dst, src, frame) {
            this.onHostPacketReceived(frame);
        }
        this.network = new RetroWeb.BinarySwitchedNetwork(
            "Alto",
            RetroWeb.peerJSConfig,
            gotNetworkPacket.bind(this),
            connectionStateChangedCallback
        );
        this.network.joinRoom();
        this.network.broadcastId = ETHERNET_ADDR_BROADCAST;
    },

    reset: function() {
        "use strict";
        this.inputPollEvent = null;

        this.resetInterface();
    },

    setHostAddress: function(addr) {
        "use strict";
        if(typeof addr !== "number") {
            throw "Host address must be a number";
        }
        this.address = addr;
    },

    startf: function(busData) {
        "use strict";
        this.debug("Ethernet STARTF {0}", busData.toString(8));

        //
        // HW Manual, p. 54:
        // "The emulator task sets [the ICMD and OCMD flip flops] from BUS[14 - 15] with
        // the STARTF function, causing the Ethernet task to wakeup, dispatch on them
        // and then reset them with EPFCT."
        //
        this.ioCmd = busData & 0x3;
        cpu.wakeupTask(TaskType.ETHERNET);
    },

    operationDone: function() {
        return (!this.oBusy && !this.iBusy);
    },

    resetInterface: function() {
        "use strict";
        // Latch status before resetting

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
        this.collision = false;
        this.crcBad = false;
        this.incomplete = false;
        this.incomingPacketLength = 0;
        this.inGone = false;
        this.inputState = InputState.ReceiverOff;
        this.fifo.clear();

        if(typeof cpu !== 'undefined') {
            cpu.blockTask(TaskType.ETHERNET);
        }

        this.debug("Interface reset.");

        if (!this.inputPollEvent) {
            // Kick off the input poll event which will run forever.
            this.inputPollEvent = new Event(this.inputPollPeriod, null, this.inputHandler.bind(this));
            scheduler.schedule(this.inputPollEvent);
            this.debug("Starting input poll event which will run forever");
        }
    },

    peekInputFifo: function() {
        "use strict";
        if (this.fifoEmpty()) {
            this.debug("Read from empty Ethernet FIFO, returning 0.");
            return 0;
        }

        return this.readInputFifo(true);
    },

    readInputFifo: function(lookOnly) {
        "use strict";
        if (this.fifoEmpty()) {
            this.debug("Read from empty Ethernet FIFO, returning 0.");
            return 0;
        }

        var read = 0;

        if(lookOnly) {
            read = this.fifo.peek();
            /*this.debug("Peek into FIFO, returning {0} (length {1})", read.toString(8), this.fifo.count);*/
        } else {
            read = this.fifo.dequeue();
            /*this.debug("Read from FIFO, returning {0} (length now {1})", read.toString(8), this.fifo.count);*/

            if (this.fifo.count < 2) {
                if (this.inGone) {
                    //
                    // Receiver is done and we're down to the last word (the checksum)
                    // which never gets pulled from the FIFO.
                    // clear IBUSY to indicate to the microcode that we've finished.
                    //
                    this.debug("Microcode finished reading packet.");
                    this.iBusy = false;
                    cpu.wakeupTask(TaskType.ETHERNET);
                } else {
                    //
                    // Still more data, but we block the Ethernet task until it is put
                    // into the FIFO.
                    //
                    cpu.blockTask(TaskType.ETHERNET);
                }
            }
        }

        return read;
    },

    writeOutputFifo: function(data) {
        "use strict";
        if (this.fifo.count == 16) {
            this.debug("Write to full Ethernet FIFO, losing first entry.");
            this.fifo.dequeue();
        }

        this.fifo.enqueue(data);

        // If the FIFO is full, start transmitting and clear Wakeups
        if (this.fifo.count == 15) {
            if(this.oBusy) {
                this.transmitFIFO(false /* not end */);
            }
            cpu.blockTask(TaskType.ETHERNET);
        }

        this.debug("FIFO written with {0}, length now {1}", data.toString(16), this.fifo.count);
    },

    startOutput: function() {
        "use strict";
        // Sets the OBusy flip-flop in the interface
        this.oBusy = true;

        this.outputIndex = 0;

        // Enables wakeups to fill the FIFO
        cpu.wakeupTask(TaskType.ETHERNET);

        this.debug("Output started.");
    },

    startInput: function() {
        "use strict";
        this.initializeReceiver();

        this.debug("Input started. Waiting for packets.");
    },

    endTransmission: function() {
        "use strict";
        // Clear FIFO wakeup and transmit the remainder of the data in the FIFO
        this.transmitFIFO(true /* end */);
        cpu.blockTask(TaskType.ETHERNET);
        this.debug("Transmission ended.");
    },

    transmitFIFO: function(end) {
        "use strict";
        // Schedule a callback to pick up the data and shuffle it out the host interface.
        this.fifoTransmitWakeupEvent.context = end;
        this.fifoTransmitWakeupEvent.timestampNsec = this.fifoTransmitDuration;
        scheduler.schedule(this.fifoTransmitWakeupEvent);
    },

    fifoEmpty: function() {
        return (this.fifo.count === 0);
    },

    outputFifoCallback: function(timeNsec, skewNsec, context) {
        "use strict";
        var end = context;

        if (!this.oBusy) {
            // If OBUSY is no longer set then the interface was reset before
            // we got to run; abandon this operation.
            this.debug("FIFO callback after reset, abandoning output.");
            return;
        }

        // Copy FIFO to host ethernet output buffer (note: unlike ContrAlto, outputIndex counts bytes)
        this.fifo.copyTo(this.outputData, this.outputIndex);
        this.outputIndex += this.fifo.count * 2;
        this.fifo.clear();

        if (!end) {
            // Enable FIFO microcode wakeups for next batch of data
            cpu.wakeupTask(TaskType.ETHERNET);
        } else {
            // This is the last of the data, clear the OBUSY flipflop, the transmitter is done.
            this.oBusy = false;

            // Wakeup at end of transmission.  ("OUTGONE Post wakeup.")
            cpu.wakeupTask(TaskType.ETHERNET);

            /* And actually tell the host ethernet interface to send the data. */

            if(this.network) {
                var frame = this.outputData.subarray(0, this.outputIndex);
                console.log("Ethernet_controller: transmit packet of length", frame.length);

                // Send packet on the network
                var dstAddress = frame[0];
                var srcAddress = frame[1];
                this.network.sendFrame(dstAddress, srcAddress, frame);
            }
        }
    },

    initializeReceiver: function() {
        "use strict";
        // " Sets the IBusy flip flop in the interface..."
        // "...restarting the receiver... causes [the controller] to ignore the current packet and hunt
        //  for the beginning of the next packet."

        //
        // So, two things:
        //  1) Cancel any pending input packet
        //  2) Start listening for more packets if we weren't already doing so.
        //
        if(this.iBusy) {
            this.debug("Receiver initializing, dropping current activity.");
            this.incomingPacketLength = 0;
        }

        this.inputState = InputState.ReceiverWaiting;
        this.iBusy = true;

        cpu.blockTask(TaskType.ETHERNET);

        this.debug("Receiver initialized");
    },

    /// <summary>
    /// Invoked when the host ethernet interface receives a packet destined for us.
    /// NOTE: This runs on the PCap or UDP receiver thread, not the main emulator thread.
    ///       Any access to emulator structures must be properly protected.
    ///
    /// Due to the nature of the "ethernet" we're simulating, there will never be any collisions or corruption and
    /// everything is completely asynchronous with regard to all receivers, as such it's completely possible
    /// for packets to be received by the host interface when the emulated interface is already sending/receiving
    /// a 3mbit packet (something that could never happen in reality).  There is no reasonable way to change this behavior
    /// without having a distributed synchronization across emulator processes to more accurately simulate the behavior
    /// of a real ethernet, and that seems like complete overkill (and gets even more complicated if we end up using transports
    /// other than raw Ethernet in the future.)
    ///
    /// To compensate for this somewhat, we queue up received packets (to an upper limit of 32), these will either be consumed or discarded
    /// by InputHandler (which runs periodically on the emulator thread) depending on the current state of the interface.
    /// This reduces the number of dropped packets and seems to work fairly well.
    ///
    /// </summary>
    /// <param name="data"></param>
    onHostPacketReceived(frame) {
        "use strict";
        //_receiverLock.EnterReadLock();
        if (this.incomingPacketQueue.length >= this.maxQueuedPackets) {
            this.debug("Input packet queue has reached its limit of {0} packets, dropping oldest packet.", this.maxQueuedPackets);
            this.incomingPacketQueue.shift();
        }
        this.incomingPacketQueue.push(frame);

        if (this.inputState == InputState.ReceiverOff)
        {
            console.log("Ethernet_controller: receiver is off, ignoring incoming packet.");
        }
        //_receiverLock.ExitReadLock();
    },

    /// <summary>
    /// Runs the input state machine.  This runs periodically (as scheduled by the Scheduler) and:
    ///   1) Ignores incoming packets if the receiver is off.
    ///   2) Pulls incoming packets from the queue if the interface is active
    ///   3) Reads words from incoming packets into the controller's FIFO
    /// </summary>
    /// <param name="timeNsec"></param>
    /// <param name="skewNsec"></param>
    /// <param name="context"></param>
    inputHandler: function(timeNsec, skewNsec, context) {
        "use strict";

        switch(this.inputState) {
            case InputState.ReceiverOff:
                // Do nothing.
                break;

            case InputState.ReceiverWaiting:
                // Receiver is on, waiting for a new packet.  If we have one now, start an
                // input operation.

                // TODO: would it make sense to expire really old packets (say more than a couple of seconds old)
                // so that the receiver doesn't pick up ancient history the next time it runs?
                // We already cycle out packets as new ones come in, so this would only be an issue on very quiet networks.
                // (And even then I don't know if it's really an issue.)
                //_receiverLock.EnterReadLock();
                if (this.incomingPacketQueue.length > 0)
                {
                    this.incomingPacketArray = this.incomingPacketQueue.shift();
                    this.incomingPacketLength = this.incomingPacketArray.length;
                    this.incomingPacketIndex = 0;

                    // Add one word to the count for the checksum.
                    // NOTE: This is not provided by the sending emulator and is not computed here either.
                    // The microcode does not use it and any corrupted packets will be dealt with transparently by the host interface,
                    // not the emulator.
                    // We add the word to the count because the microcode expects to read it in from the input FIFO, it is then dropped.
                    //
                    this.incomingPacketLength += 2;

                    if ((this.incomingPacketLength % 2) != 0) {
                        this.debug("Invalid 3mbit packet length header (0}. Must be even.",
                            this.incomingPacketLength);
                    }

                    /*this.debug("Accepting incoming packet (length {0}).", this.incomingPacketLength);*/

                    //LogPacket(_incomingPacketLength, _incomingPacket);

                    // Move to the Receiving state.
                    this.inputState = InputState.Receiving;
                }
                //_receiverLock.ExitReadLock();
                break;
            case InputState.Receiving:
                /*this.debug("Processing word from input packet ({0} bytes left in input, {1} words in FIFO.)", this.incomingPacketLength, this.fifo.count);*/

                if (this.fifo.count >= 16) {
                    // This shouldn't happen.
                    this.debug("Input FIFO full, Scheduling next wakeup. No words added to the FIFO.");
                }

                if(this.incomingPacketLength >= 2) {
                    // Stuff 1 word into the FIFO, if we run out of data to send then we clear _iBusy further down.
                    var byte1 = this.incomingPacketArray[this.incomingPacketIndex++];
                    var byte2 = this.incomingPacketArray[this.incomingPacketIndex++];
                    this.fifo.enqueue((byte1 << 8) | byte2);

                    this.incomingPacketLength -= 2;
                }
                else if (this.incomingPacketLength == 1) {
                    // Should never happen.
                    this.debug("Packet length not multiple of 2 on receive.");
                }

                // All out of data?  Finish the receive operation.
                if (this.incomingPacketLength == 0) {
                    console.log("Ethernet_controller: received packet of length", this.incomingPacketArray.length);
                    this.inGone = true;
                    this.incomingPacketArray = null;

                    this.inputState = InputState.ReceiverDone;

                    // Wakeup Ethernet task for end of data.
                    cpu.wakeupTask(TaskType.ETHERNET);
                }

                // Wake up the Ethernet task to process data if we have
                // more than two words in the FIFO.
                if (this.fifo.count >= 2) {
                    cpu.wakeupTask(TaskType.ETHERNET);
                }
                break;
            case InputState.ReceiverDone:
                // Nothing, we just wait in this state for the receiver to be reset by the microcode.
                break;
        }

        this.inputPollEvent.timestampNsec = this.inputPollPeriod - skewNsec;
        scheduler.schedule(this.inputPollEvent);
    },

    debug() {
        if(this.verbose) {
            console.log.apply(console, arguments);
        }
    }
}.init();