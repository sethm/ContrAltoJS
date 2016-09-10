var altoDisplay = {

    WIDTH: 608,

    HEIGHT: 808,

    context: undefined,

    imgData: undefined,

    reset: function() {
        var canvas = document.getElementById("altoDisplay");
        console.log("Resetting Alto Display");
        this.context = canvas.getContext("2d");
        this.imgData = this.context.createImageData(this.WIDTH, this.HEIGHT);
    },

    drawWord: function(scanline, wordOffset, word, lowRes) {
        if (lowRes) {
            throw "ERROR: LOW RES NOT YET IMPLEMENTED";
        }

        var address = ((scanline * 38 * 16 * 4) + (wordOffset * 16 * 4));

        var i, j;

        for (i = 0, j = 0; i < (16 * 4); i += 4, j++) {
            var bit = (word >>> (15 - j)) & 1;
            var color = (bit === 1) ? 255 : 0;

            this.imgData.data[address + i] = color;
            this.imgData.data[address + i + 1] = color;
            this.imgData.data[address + i + 2] = color;
            this.imgData.data[address + i + 3] = 255;
        }
    },

    drawCursorWord: function(scanline, xoffset, whiteOnBlack, cursorWord) {

        var address = ((scanline * 38 * 16 * 4)) + ((xoffset / 4) * 16);

        // TODO: Merge cursor into existing scanline - this clobbers it.

        for (i = 0, j = 0; i < (16 * 4); i += 4, j++) {
            var bit = (cursorWord >>> (15 - j)) & 1;

            if (bit === 1) {
                this.imgData.data[address + i    ] = 0;
                this.imgData.data[address + i + 1] = 0;
                this.imgData.data[address + i + 2] = 0;
                this.imgData.data[address + i + 3] = 255;
            }
        }
    },

    render: function() {
        this.context.putImageData(this.imgData, 0, 0);
    }
};