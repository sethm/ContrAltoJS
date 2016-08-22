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

var frameId = 0;

// Main loop
function runMainLoop() {
    frameId = animFrame(runMainLoop);
    // altoSystem.run(90039);
    altoSystem.run(10);
}

function stopRunning() {
    cancelAnimationFrame(frameId);
    var startButton = document.getElementById("startButton");
    var stepButton = document.getElementById("stepButton");
    console.log("Stopping simulator.");
    startButton.disabled = false;
    stepButton.disabled = false;
}

function stepSimulator() {
    var startButton = document.getElementById("startButton");
    startButton.disabled = true;
    console.log("Starting simulator.");
    altoSystem.step();
    startButton.disabled = false;
}

function startRunning() {
    var startButton = document.getElementById("startButton");
    var stepButton = document.getElementById("stepButton");
    startButton.disabled = true;
    stepButton.disabled = true;
    console.log("Starting simulator.");
    runMainLoop();
}
