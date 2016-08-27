/*
 JsAlto Xerox Alto Emulator
 Copyright (C) 2016  Seth J. Morabito

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Affero General Public License for more details.

 You should have received a copy of the GNU Affero General Public License
 along with this program.  If not, see
 <http://www.gnu.org/licenses/>.
*/

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

var system = new altoSystem("http://www.loomcom.com/jsalto/images/diag.dsk");

// Main loop
function runMainLoop() {
    frameId = animFrame(runMainLoop);
    system.run(1000);
    altoDisplay.displayLastFrame();
}

function stopRunning() {
    cancelAnimationFrame(frameId);
    var startButton = document.getElementById("startButton");
    var stepButton = document.getElementById("stepButton");
    console.log("Stopping simulator.");
    startButton.disabled = false;
    stepButton.disabled = false;
}

function resetSimulator() {
    this.stopRunning();
    console.log("Resetting simulator");
    system.reset();
}
function stepSimulator() {
    var startButton = document.getElementById("startButton");
    startButton.disabled = true;
    console.log("Stepping simulator.");
    system.step();
    startButton.disabled = false;
    altoDisplay.displayLastFrame();
}

function startRunning() {
    var startButton = document.getElementById("startButton");
    var stepButton = document.getElementById("stepButton");
    startButton.disabled = true;
    stepButton.disabled = true;
    console.log("Starting simulator.");
    runMainLoop();
}
