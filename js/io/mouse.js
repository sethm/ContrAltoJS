

var mouse = {

    currentX: 0,
    currentY: 0,
    newX: 0,
    newY: 0,

    mouseBits: 0x0,

    pollMouseBits: function() {
        // Move the mouse closer to X, Y

        if (this.currentX > this.newX && this.currentY > this.newY) {
            // Move up-left
            this.mouseBits = 4;
            this.currentX--;
            this.currentY--;
            console.log("Moving mouse up-left. " +
                        "currentX=" + this.currentX + ", currentY=" + this.currentY +
                        ", newX=" + this.newX + ", newY=" + this.newY);
        } else if (this.currentX < this.newX && this.currentY > this.newY) {
            // Move up-right
            this.mouseBits = 7;
            this.currentX++;
            this.currentY--;
            console.log("Moving mouse up-right. " +
                        "currentX=" + this.currentX + ", currentY=" + this.currentY +
                        ", newX=" + this.newX + ", newY=" + this.newY);
        } else if (this.currentX > this.newX && this.currentY < this.newY) {
            // move down-left
            this.mouseBits = 5;
            this.currentX--;
            this.currentY++;
            console.log("Moving mouse down-left. " +
                        "currentX=" + this.currentX + ", currentY=" + this.currentY +
                        ", newX=" + this.newX + ", newY=" + this.newY);
        } else if (this.currentX < this.newX && this.currentY < this.newY) {
            // move down-right
            this.mouseBits = 8;
            this.currentX++;
            this.currentY++;
            console.log("Moving mouse down-right. " +
                        "currentX=" + this.currentX + ", currentY=" + this.currentY +
                        ", newX=" + this.newX + ", newY=" + this.newY);
        } else if (this.currentX == this.newX && this.currentY < this.newY) {
            // move down
            this.mouseBits = 2;
            this.currentY++;
            console.log("Moving mouse down. " +
                        "currentX=" + this.currentX + ", currentY=" + this.currentY +
                        ", newX=" + this.newX + ", newY=" + this.newY);
        } else if (this.currentX == this.newX && this.currentY > this.newY) {
            // move up
            this.mouseBits = 1;
            this.currentY--;
            console.log("Moving mouse up. " +
                        "currentX=" + this.currentX + ", currentY=" + this.currentY +
                        ", newX=" + this.newX + ", newY=" + this.newY);
        } else if (this.currentX > this.newX && this.currentY == this.newY) {
            // move left
            this.mouseBits = 3;
            this.currentX--;
            console.log("Moving left. " +
                        "currentX=" + this.currentX + ", currentY=" + this.currentY +
                        ", newX=" + this.newX + ", newY=" + this.newY);
        } else if (this.currentX < this.newX && this.currentY == this.newY) {
            // move right
            this.mouseBits = 6;
            this.currentX++;
            console.log("Moving right. " +
                        "currentX=" + this.currentX + ", currentY=" + this.currentY +
                        ", newX=" + this.newX + ", newY=" + this.newY);
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
        return 0xffff;
    },

    load: function(address, data, task, extendedMemoryReference) {
        // Nothing
    },

    toString: function() {
        return "Mouse";
    },

    mouseMove: function(x, y) {
        mouse.newX = x;
        mouse.newY = y;
    },

    addresses: [
        new MemoryRange(0xfe18, 0xfe1b)
    ]


};
