

var mouse = {
    pollMouseBits: function() {
        // TODO: Implement
        return 0;
    },

    reset: function() {
        "use strict";
    },

    read: function(address, task, extendedMemoryReference) {
        "use strict";
        return 0xffff;
    },

    load: function(address, data, task, extendedMemoryReference) {
        // Nothing
    },

    toString: function() {
        return "Mouse";
    },

    addresses: [
        new MemoryRange(0xfe18, 0xfe1b)
    ]

};
