var canvas = document.getElementById("altoDisplay");
var ctx = canvas.getContext("2d");
ctx.font="20px Courier";
ctx.fillText("Display not yet connected",240,50);

// Main loop

function stopRunning() {
    var startButton = document.getElementById("startButton");
    startButton.disabled = false;
    console.log("Stop Running clicked.");
}

function startRunning() {
    var startButton = document.getElementById("startButton");
    startButton.disabled = true;
    console.log("Start Running clicked.");
}
