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

var STEPS_PER_FRAME = 98000;

var system = new altoSystem();

var display = document.getElementById("altoDisplay");

/* Set keyboard events on canvas and make it focusable */
display.addEventListener("keydown", keyboard.keyDown, false);
display.addEventListener("keyup", keyboard.keyUp, false);
display.setAttribute("tabindex", "0");
display.addEventListener('mousedown', function(event){this.focus();});
display.focus();

display.addEventListener("mousemove", mouseMove, false);
display.addEventListener("mousedown", mouseDown, false);
display.addEventListener("mouseup", mouse.mouseUp, false);
display.oncontextmenu = function() {
    return false;
};

var diskChooser = document.getElementById("diskChooser");
var bootButton = document.getElementById("bootButton");
var stopButton = document.getElementById("stopButton");
var resetButton = document.getElementById("resetButton");
var pointerLockCheckbox = document.getElementById("pointerLockCheckbox");

diskChooser.onchange = function(e) {
    loadSystemWithDisk();
    system.reset();
};

function mouseMove(e) {
    // Use relative mouse positioning when pointer is captured

    if(isPointerLocked()) {
        mouse.mouseMoveRelative(e.movementX, e.movementY);
        return false;
    } else if(pointerLockCheckbox.checked) {
        // Mouse not yet captured, ignore motion.
        return false;
    }

    // Use absolute mouse positioning otherwise

    var rect = display.getBoundingClientRect();

    mouse.mouseMove(Math.ceil((e.clientX - rect.left) / (rect.right - rect.left) * display.width),
                    Math.ceil((e.clientY - rect.top) / (rect.bottom - rect.top) * display.height));
    return false;
}

function mouseDown(e) {
    if(pointerLockCheckbox.checked && !isPointerLocked()) {
        requestPointerLock(display);
    }

    mouse.mouseDown(e);
}

/* Pointer Lock API Support (very useful for games that rely on relative mouse positioning) */

function requestPointerLock(element) {
    element.requestPointerLock = element.requestPointerLock ||
                                 element.mozRequestPointerLock ||
                                 element.webkitRequestPointerLock;
    // Ask the browser to lock the pointer
    element.requestPointerLock();
}

function isPointerLocked() {
    return document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement;
}

if ("onpointerlockchange" in document) {
  document.addEventListener('pointerlockchange', pointerLockChange, false);
} else if ("onmozpointerlockchange" in document) {
  document.addEventListener('mozpointerlockchange', pointerLockChange, false);
}
function pointerLockChange() {
    if(!pointerLockCheckbox.checked || isPointerLocked()) {
        display.style.cursor = "none";
    } else {
        display.style.cursor = "pointer";
    }
}

// Main loop
function runMainLoop() {
    if (system.profiling) {
        /* Running through the JavaScript profiler I learned that Date.now() is
         * actually a rather slow function. Replacing it with performance.now()
         * gave some improvement, but the best gains came from not calling timing
         * functions at all (unless system.profiling is enabled) */
        var startTime = performance.now();

        system.run(STEPS_PER_FRAME);
        altoDisplay.render();

        var endTime = performance.now();
        var clockNS = Math.ceil(((endTime - startTime) / STEPS_PER_FRAME) * conversion.msecToNsec);
        console.log("Avg Step = " + clockNS + " ns. (" + Math.ceil((170 / clockNS) * 100) + "% a real Alto)");
    } else {
        system.run(STEPS_PER_FRAME);
        altoDisplay.render();
    }
    frameId = animFrame(runMainLoop);
}

function stopRunning() {
    cancelAnimationFrame(frameId);

    diskChooser.disabled = false;
    bootButton.disabled = false;
    stopButton.disabled = true;
    resetButton.disabled = false;
}

function resetSimulator() {
    this.stopRunning();
    system.reset();
}

function stepSimulator() {
    bootButton.disabled = true;
    system.step();
    bootButton.disabled = false;
    altoDisplay.render();
}

function enableDiskTrace() {
    var traceCheckbox = document.getElementById("diskTrace");

    if (traceCheckbox) {
        system.diskTrace = traceCheckbox.checked;
    }
}

var stepCount = 0;

function novaStepSimulator() {
    bootButton.disabled = true;
    // To prevent runaway execution.
    var maxStepsAllowed = 2000000;
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
    console.log("    PC=" + cpu.r[6].toString(8));
    console.log("    R0=" + cpu.r[3].toString(8));
    console.log("    R1=" + cpu.r[2].toString(8));
    console.log("    R2=" + cpu.r[1].toString(8));
    console.log("    R3=" + cpu.r[0].toString(8));

    bootButton.disabled = false;
    altoDisplay.render();
}

function startRunning() {
    diskChooser.disabled = true;
    bootButton.disabled = true;
    stopButton.disabled = false;
    resetButton.disabled = true;

    runMainLoop();
}

function loadSystemWithDisk() {
    "use strict";
    var diskName = diskChooser.options[diskChooser.selectedIndex].value;

    console.log("Choosing disk image: "  + diskName);

    system.loadPack("http://www.loomcom.com/jsalto/images/" + diskName);
}

window.onload = function() {
    loadSystemWithDisk();

    bootButton.disabled = false;
    stopButton.disabled = true;
    resetButton.disabled = false;
};
