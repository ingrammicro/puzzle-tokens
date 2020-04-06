@import "lib/uidialog.js";
@import "lib/utils.js";
@import "classes/DSExporter.js";
@import "constants.js";

var onRun = function (context) {
    const document = Sketch.fromNative(context.document)

    UIDialog.setUp(context);

    var app = new DSExporter(context)
    app.run()

};

