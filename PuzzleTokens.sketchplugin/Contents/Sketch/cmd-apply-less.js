@import "lib/uidialog.js";
@import "lib/utils.js";
@import "classes/DSApp.js";
@import "constants.js";


function runApp(context, isQuick = false) {
    UIDialog.setUp(context);
    var myless = new DSApp(context)

    if (isQuick)
        myless.runQuick()
    else
        myless.runDialog()
}

var onRunDialog = function (context) {
    runApp(context)
};

var onRunQuick = function (context) {
    runApp(context, true)

};
