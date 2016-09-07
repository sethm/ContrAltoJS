MOUSE_LEFT_BUTTON   = 0x04;
MOUSE_RIGHT_BUTTON  = 0x02;
MOUSE_MIDDLE_BUTTON = 0x01;


var mouse = {

    currentX: 0,
    currentY: 0,
    newX: 0,
    newY: 0,

    mouseButtons: 0x0,
    mouseBits: 0x0,

    pollMouseBits: function() {
        // Move the mouse closer to X, Y

        if (this.currentX > this.newX && this.currentY > this.newY) {
            // Move up-left
            this.mouseBits = 4;
            this.currentX--;
            this.currentY--;
        } else if (this.currentX < this.newX && this.currentY > this.newY) {
            // Move up-right
            this.mouseBits = 7;
            this.currentX++;
            this.currentY--;
        } else if (this.currentX > this.newX && this.currentY < this.newY) {
            // move down-left
            this.mouseBits = 5;
            this.currentX--;
            this.currentY++;
        } else if (this.currentX < this.newX && this.currentY < this.newY) {
            // move down-right
            this.mouseBits = 8;
            this.currentX++;
            this.currentY++;
        } else if (this.currentX == this.newX && this.currentY < this.newY) {
            // move down
            this.mouseBits = 2;
            this.currentY++;
        } else if (this.currentX == this.newX && this.currentY > this.newY) {
            // move up
            this.mouseBits = 1;
            this.currentY--;
        } else if (this.currentX > this.newX && this.currentY == this.newY) {
            // move left
            this.mouseBits = 3;
            this.currentX--;
        } else if (this.currentX < this.newX && this.currentY == this.newY) {
            // move right
            this.mouseBits = 6;
            this.currentX++;
        } else if (this.currentX == this.newX && this.currentY == this.newY) {
            // No change
            this.mouseBits = 0;
        }

        return this.mouseBits;
    },

    reset: function() {
        this.currentX = 0;
        this.currentY = 0;
        this.newX = 0;
        this.newY = 0;
    },

    read: function(address, task, extendedMemoryReference) {
        return (~this.mouseButtons) & 0xffff;
    },

    load: function(address, data, task, extendedMemoryReference) {
        // Nothing
    },

    toString: function() {
        return "Mouse";
    },

    mouseMove: function(x, y) {

        mouse.newX = Math.ceil(x / 4);
        mouse.newY = y;
    },

    mouseDown: function(e) {
        console.log("Mouse Down. Button = " + e.button);
        switch (e.button) {
            case 0: // left
                mouse.mouseButtons |= MOUSE_LEFT_BUTTON;
                break;
            case 1: // middle
                mouse.mouseButtons |= MOUSE_MIDDLE_BUTTON;
                break;
            case 2: // right
                mouse.mouseButtons |= MOUSE_RIGHT_BUTTON;
                break;
        }

        return false;
    },

    mouseUp: function(e) {
        console.log("Mouse Up. Button = " + e.button);
        switch (e.button) {
            case 0: // left
                mouse.mouseButtons ^= MOUSE_LEFT_BUTTON;
                break;
            case 1: // middle
                mouse.mouseButtons ^= MOUSE_MIDDLE_BUTTON;
                break;
            case 2: // right
                mouse.mouseButtons ^= MOUSE_RIGHT_BUTTON;
                break;
        }

        return false;
    },

    addresses: [
        new MemoryRange(0xfe18, 0xfe1b)
    ]


};
