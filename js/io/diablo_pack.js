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

var DiabloDiskType = {
    DIABLO_31: 0,
    DIABLO_44: 1
};

var DiskGeometry = function(cylinders, heads, sectors) {
    this.cylinders = cylinders;
    this.heads = heads;
    this.sectors = sectors;
};

var DiabloDiskSector = function(header, label, data) {
    if (header.length != 4 || label.length != 16 || data.length != 512) {
        throw "Invalid header/label/data length : " + header.length + "/" + label.length + "/" + data.length;
    }

    this.header = this.getUshortArray(header);
    this.label = this.getUshortArray(label);
    this.data = this.getUshortArray(data);
};

DiabloDiskSector.prototype = {
    getUshortArray: function(byteArray) {
        if (byteArray.length % 2 != 0) {
            throw "Array length must be even";
        }

        var ushortArray = [];

        var offset = 0;

        for (var i = 0; i < byteArray.length; i++) {
            ushortArray[i] = (byteArray[offset] | (byteArray[offset + 1] << 8)) & 0xffff;
            offset += 2;
        }

        return ushortArray;
    }
};

var DiabloPack = function(type) {
    this.diskType = type;
    this.packName = null;
    if (this.diskType == DiabloDiskType.DIABLO_31) {
        this.geometry = new DiskGeometry(203, 2, 12);
    } else {
        this.geometry = new DiskGeometry(406, 2, 12);
    }

    this.sectors = [];

    this.sectorCount = this.geometry.cylinders * this.geometry.heads * this.geometry.sectors;
};

DiabloPack.prototype = {
    loaded: false,

    load: function(url, reverseByteOrder, loadedCallback) {

        var cyl, track, sec, offset, secNum;

        var req = new XMLHttpRequest();
        req.open("GET", url, true);
        req.responseType = "arraybuffer";

        var pack = this;

        req.onload = function(event) {
            var arrayBuffer = req.response;
            if (arrayBuffer) {
                var byteArray = new Uint8Array(arrayBuffer);

                // Great, we have a raw byte stream of the disk image now.
                pack.packName = "FIXME";

                offset = 0;
                secNum = 0;
                for (cyl = 0; cyl < pack.geometry.cylinders; cyl++) {
                    for (track = 0; track < pack.geometry.heads; track++) {
                        for (sec = 0; sec < pack.geometry.sectors; sec++) {

                            // We're reading a single sector of data out of the image.
                            var header = byteArray.subarray(offset + 2, offset + 6);
                            var label = byteArray.subarray(offset + 6, offset + 22);
                            var data = byteArray.subarray(offset + 22, offset + 534);

                            if (reverseByteOrder) {
                                pack.swapBytes(header);
                                pack.swapBytes(label);
                                pack.swapBytes(data);
                            }

                            if (pack.sectors[cyl] === undefined) {
                                pack.sectors[cyl] = [];
                            }

                            if (pack.sectors[cyl][track] === undefined) {
                                pack.sectors[cyl][track] = [];
                            }

                            pack.sectors[cyl][track][sec] = new DiabloDiskSector(header, label, data);

                            offset += 534;
                        }
                    }
                }
            }

            loadedCallback();
        };

        req.send();
    },

    save: function() {
        // No-op for now, until we come up with a better solution.
    },

    getSector: function(cylinder, track, sector) {
        return this.sectors[cylinder][track][sector];
    },

    swapBytes: function(data) {
        for (var i = 0; i < data.length; i += 2) {
            var t = data[i];
            data[i] = data[i + 1];
            data[i + 1] = t;
        }
    }

};