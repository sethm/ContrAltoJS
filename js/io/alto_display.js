altoDisplay = {
    drawWord: function(scanline, word, displayWord, lowRes) {
        console.log("DRAWING WORD TO BUFFER. SCANLINE=" + scanline);
    },

    drawCursorWord: function(scanline, cursorXLatched, whiteOnBlack, cursorRegLatched) {
        console.log("DRAWING CURSOR WORD. SCANLINE=" + scanline);
    },

    render: function() {
        console.log("RENDERING COMPLETED FRAME");
    }
};