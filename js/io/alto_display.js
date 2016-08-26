var altoDisplay = {

    buffer: undefined,

    reset: function() {
        this.buffer = document.createElement("canvas");
        this.buffer.width = 606;
        this.buffer.height = 808;
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
        console.log("Draw cursor word. scanline=" + scanline);
        var ctx = this.buffer.getContext("2d");
        if (cursorWord != 0) {
            console.log("cursorWord=" + cursorWord.toString(16));
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