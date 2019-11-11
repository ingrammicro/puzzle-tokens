@import "lib/uidialog.js";
@import "lib/utils.js";
@import "classes/DSApp.js";
@import "constants.js";


var onRunDialog = function (context) {
    UIDialog.setUp(context);
    var myless = new DSApp(context)
    myless.runDialog()
};

var onRunQuick = function (context) {
    UIDialog.setUp(context);
    var myless = new DSApp(context)
    myless.runQuick()

};
