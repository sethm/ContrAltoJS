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

window.addEventListener("keydown", keyboard.keyDown, false);
window.addEventListener("keyup", keyboard.keyUp, false);

var display = document.getElementById("altoDisplay");

display.addEventListener("mousemove", mouseMove, false);
display.addEventListener("mousedown", mouse.mouseDown, false);
display.addEventListener("mouseup", mouse.mouseUp, false);

function mouseMove(e) {
    var rect = display.getBoundingClientRect();
    mouse.mouseMove(Math.round(e.clientX - rect.left),
                    Math.round(e.clientY - rect.top));
    return false;
}

// Main loop
function runMainLoop() {
    frameId = animFrame(runMainLoop);
    system.run(85000);
    altoDisplay.render();
}

function stopRunning() {
    cancelAnimationFrame(frameId);
    var startButton = document.getElementById("startButton");
    var stepButton = document.getElementById("stepButton");
    startButton.disabled = false;
    stepButton.disabled = false;
}

function resetSimulator() {
    this.stopRunning();
    system.reset();
}

function stepSimulator() {
    var startButton = document.getElementById("startButton");
    startButton.disabled = true;
    system.step();
    startButton.disabled = false;
    altoDisplay.render();
}

function enableAltoTrace() {
    "use strict";
    var traceCheckbox = document.getElementById("trace");

    if (traceCheckbox) {
        system.instTrace = traceCheckbox.checked;
    }
}

function enableDiskTrace() {
    "use strict";
    var traceCheckbox = document.getElementById("diskTrace");

    if (traceCheckbox) {
        system.diskTrace = traceCheckbox.checked;
    }
}

var stepCount = 0;

function novaStepSimulator() {
    var startButton = document.getElementById("startButton");
    startButton.disabled = true;
    // To prevent runaway execution.
    var maxStepsAllowed = 20000000;
    system.step();

    while (cpu.currentTask !== undefined && cpu.currentTask.mpc != 020 && stepCount < maxStepsAllowed) {
        system.step();
        stepCount++;
    }

    // Print some useful debugging information about the state of the simulator.
    var instruction = memoryBus.readFromBus(cpu.r[6], TaskType.EMULATOR, false);

    console.log("[" + stepCount + "] Stopped at memory location=" + cpu.r[6].toString(8) + " (" +
                instruction.toString(8) +  ") : " +
                novaDisassembler.disassembleInstruction(cpu.r[6], instruction));
    console.log("    PC=" + cpu.r[6].toString(8))
    console.log("    R0=" + cpu.r[3].toString(8));
    console.log("    R1=" + cpu.r[2].toString(8));
    console.log("    R2=" + cpu.r[1].toString(8));
    console.log("    R3=" + cpu.r[0].toString(8));

    startButton.disabled = false;
    altoDisplay.render();
}

function startRunning() {
    var startButton = document.getElementById("startButton");
    var stepButton = document.getElementById("stepButton");
    startButton.disabled = true;
    stepButton.disabled = true;
    runMainLoop();
}
