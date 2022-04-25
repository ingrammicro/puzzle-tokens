@import "lib/uidialog.js";
@import "lib/utils.js";
@import "classes/DSApp.js";
@import "constants.js";


var onRunDialog = function (context) {
    UIDialog.setUp(context);
    var myless = new DSApp(context)
    myless.init()    
    myless.runDialog()
}

var onRunDialogOnlyStyles = function (context) {
    UIDialog.setUp(context);
    var myless = new DSApp(context)
    myless.onlyUpdateStyles = true
    myless.init()
    myless.runDialog()
}

var onRunQuick = function (context) {
    UIDialog.setUp(context);
    var myless = new DSApp(context)
    myless.onlyUpdateStyles = Settings.settingForKey(SettingKeys.PLUGIN_LAST_ONLY_UPDATE) === true
    myless.init()
    myless.runQuick()
}