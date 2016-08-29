var altoDisplay = {

    buffer: undefined,

    reset: function() {
        this.buffer = document.createElement("canvas");
        this.buffer.width = 606;
        this.buffer.height = 808;
        var canvas = document.getElementById("altoDisplay");
        if (canvas) {
            var ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, 606, 808);
            ctx.drawImage(this.buffer, 0, 0);
        }
    },

    drawWord: function(scanline, word, displayWord, lowRes) {
        var ctx = this.buffer.getContext("2d");

        var offsetX = word * 16;
        var offsetY = scanline;

        ctx.clearRect(offsetX, offsetY, 16, 1);

        // There must be a better way than this! This is absurd.
        ctx.fillStyle = "#fff";
        for (var i = 0; i < 16; i++) {
            var bit = (displayWord >> i) & 1;
            if (bit == 1) {
                ctx.fillRect(offsetX + i, offsetY, 1, 1);
            }
        }
    },

    drawCursorWord: function(scanline, xoffset, whiteOnBlack, cursorWord) {
        var ctx = this.buffer.getContext("2d");

        ctx.fillStyle = "#000";
        for (var i = 0; i < 16; i++) {
            var bit = (cursorWord >> i) & 1;
            if (bit == 0) {
                ctx.fillRect(xoffset + i, scanline, 1, 1);
            }
        }

    },

    render: function() {

    },

    displayLastFrame: function() {
        var canvas = document.getElementById("altoDisplay");
        var ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, 606, 808);
        ctx.drawImage(this.buffer, 0, 0);
    }
};