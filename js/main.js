var canvas = document.getElementById("altoDisplay");
var ctx = canvas.getContext("2d");
ctx.font="20px Courier";
ctx.fillText("Display not yet connected",240,50);

// The general strategy here is to allow the back end of the processor
// to progress for 1/60th of a second worth of steps for each frame of
// animation we draw. At 170ns per step, that equals 98039 clock
// cycles per frame drawn.

var animFrame = window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame   ||
        window.mozRequestAnimationFrame      ||
        window.oRequestAnimationFrame        ||
        window.msRequestAnimationFrame       ||
        null;

var running = false;
var started = false;
var frameId = 0;

// Main loop
function runMainLoop() {
    console.log("Updating and drawing...");
    frameId = animFrame(runMainLoop);
    altoSystem.run(20);
}

function stopRunning() {
    running = false;
    started = false;
    cancelAnimationFrame(frameId);
    var startButton = document.getElementById("startButton");
    startButton.disabled = false;
    console.log("Stop Running clicked.");
}

function startRunning() {
    var startButton = document.getElementById("startButton");
    startButton.disabled = true;
    console.log("Start Running clicked.");
    runMainLoop();
}
