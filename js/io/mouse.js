MOUSE_LEFT_BUTTON   = 0x04;
MOUSE_RIGHT_BUTTON  = 0x02;
MOUSE_MIDDLE_BUTTON = 0x01;

MOUSE_MAX_X = 606 - 16;
MOUSE_MAX_Y = 808;


var mouse = {

    currentX: 0,
    currentY: 0,

    newX: 0,
    newY: 0,

    mouseButtons: 0x0,
    mouseBits: 0x0,

    pollMouseBits: function() {
        // Move the mouse closer to X, Y

        if (mouse.currentX > mouse.newX && mouse.currentY > mouse.newY) {
            // Move up-left
            mouse.mouseBits = 4;
            mouse.currentX--;
            mouse.currentY--;
        } else if (mouse.currentX < mouse.newX && mouse.currentY > mouse.newY) {
            // Move up-right
            mouse.mouseBits = 7;
            mouse.currentX++;
            mouse.currentY--;
        } else if (mouse.currentX > mouse.newX && mouse.currentY < mouse.newY) {
            // move down-left
            mouse.mouseBits = 5;
            mouse.currentX--;
            mouse.currentY++;
        } else if (mouse.currentX < mouse.newX && mouse.currentY < mouse.newY) {
            // move down-right
            mouse.mouseBits = 8;
            mouse.currentX++;
            mouse.currentY++;
        } else if (mouse.currentX == mouse.newX && mouse.currentY < mouse.newY) {
            // move down
            mouse.mouseBits = 2;
            mouse.currentY++;
        } else if (mouse.currentX == mouse.newX && mouse.currentY > mouse.newY) {
            // move up
            mouse.mouseBits = 1;
            mouse.currentY--;
        } else if (mouse.currentX > mouse.newX && mouse.currentY == mouse.newY) {
            // move left
            mouse.mouseBits = 3;
            mouse.currentX--;
        } else if (mouse.currentX < mouse.newX && mouse.currentY == mouse.newY) {
            // move right
            mouse.mouseBits = 6;
            mouse.currentX++;
        } else if (mouse.currentX == mouse.newX && mouse.currentY == mouse.newY) {
            // No change
            mouse.mouseBits = 0;
        }

        // Sanity checking
        if (mouse.currentX > MOUSE_MAX_X) {
            mouse.currentX = MOUSE_MAX_X;
        }

        if (mouse.currentX < 0) {
            mouse.currentX = 0;
        }

        if (mouse.currentY > MOUSE_MAX_Y) {
            mouse.currentY = MOUSE_MAX_Y;
        }

        if (mouse.currentY < 0) {
            mouse.currentY = 0;
        }

        return mouse.mouseBits;
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
        // This is where the cursor really is, in memory
        var memX = memoryBus.readFromBus(0426, TaskType.EMULATOR, false);
        var memY = memoryBus.readFromBus(0427, TaskType.EMULATOR, false);

        mouse.currentX = memX;
        mouse.currentY = memY;

        // This is where the web browser has positioned the cursor.
        mouse.newX = x;
        mouse.newY = y;
    },

    mouseMoveRelative: function(relx, rely) {
        mouse.newX = mouse.currentX + relx;
        mouse.newY = mouse.currentY + rely;
    },

    mouseDown: function(e) {
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

        e.stopPropagation();
        e.preventDefault();
        return false;
    },

    mouseUp: function(e) {
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

        e.stopPropagation();
        e.preventDefault();
        return false;
    },

    addresses: [
        new MemoryRange(0xfe18, 0xfe1b)
    ]


};
