
var diskController = {

    reset: function() {
        scheduler.schedule(new Event(123, null, this.sectorCallback));
    },

    sectorCallback: function(timeNsec, skewNsec, context) {
        console.log("DiskController: sector callback");
    }
};
