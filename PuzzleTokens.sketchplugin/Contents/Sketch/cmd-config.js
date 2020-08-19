@import "lib/uidialog.js";
@import "lib/utils.js";
@import "constants.js";


var onRun = function (context) {
    const sketch = require('sketch')
    const Settings = require('sketch/settings')
    const document = sketch.fromNative(context.document)
    const UI = require('sketch/ui')

    UIDialog.setUp(context);

    // Read settings
    let logDebug = Settings.settingForKey(SettingKeys.PLUGIN_LOGDEBUG_ENABLED) == 1
    let showJSON = Settings.settingForKey(SettingKeys.PLUGIN_SHOW_JSON) == 1
    let showDoubleStyle = Settings.settingForKey(SettingKeys.PLUGIN_SHOW_DOUBLESTYLES) == 1
    let genSymbTokens = Settings.settingForKey(SettingKeys.PLUGIN_GENERATE_SYMBOLTOKENS) == 1
    let gaEnabled = !Settings.settingForKey(SettingKeys.PLUGIN_GA_DISABLED)
    let nodeJSPAth = Settings.settingForKey(SettingKeys.PLUGIN_NODEJS_PATH)
    if (undefined == nodeJSPAth) nodeJSPAth = ""
    let sassModulePath = Settings.settingForKey(SettingKeys.PLUGIN_SASSMODULE_PATH)
    if (undefined == sassModulePath) sassModulePath = ""

    // Build dialog
    const dialog = new UIDialog("Configure", NSMakeRect(0, 0, 400, 340), "Save", "Edit Puzzle Tokens common configuration settings.")

    dialog.addLeftLabel("", "Apply Options")
    dialog.addCheckbox("showDoubleStyle", "Warn about style name duplicates", showDoubleStyle)
    dialog.addCheckbox("showJSON", "Show internal JSON data", showJSON)
    dialog.addCheckbox("logDebug", "Enable debug logging", logDebug)

    dialog.addDivider()
    dialog.addLeftLabel("", "Path to Node.js")
    dialog.addTextInput("nodeJSPAth", "", nodeJSPAth, Constants.NODEJS_PATH, 350)
    dialog.addLeftLabel("", "Path to SASS Module", 40)
    dialog.addTextInput("sassModulePath", "", sassModulePath, Constants.DEF_SASSMODULE_PATH, 350)
    dialog.y -= 20

    dialog.addDivider()
    dialog.addLeftLabel("", "Integration with Puzzle Publisher", 40)
    dialog.addCheckbox("genSymbTokens", "Generate symbols & styles file", genSymbTokens)
    dialog.y -= 20

    dialog.addDivider()
    dialog.addLeftLabel("", "Privacy", 40)
    dialog.addCheckbox("gaEnabled", "Share analytics with PT developer", gaEnabled)
    dialog.addHint("gaEnabledHint", "Help improve Puzzle Tokens by automatically sending usage data. Usage data is collected anonymously and cannot be used to identify you.", 40)

    // Run event loop
    while (true) {
        const result = dialog.run()
        if (!result) {
            dialog.finish()
            return false
        }
        showDoubleStyle = dialog.views['showDoubleStyle'].state() == 1
        logDebug = dialog.views['logDebug'].state() == 1
        showJSON = dialog.views['showJSON'].state() == 1
        genSymbTokens = dialog.views['genSymbTokens'].state() == 1
        gaEnabled = dialog.views['gaEnabled'].state() == 1
        nodeJSPAth = dialog.views['nodeJSPAth'].stringValue() + ""
        sassModulePath = dialog.views['sassModulePath'].stringValue() + ""

        break
    }
    dialog.finish()

    // Save updated settings
    Settings.setSettingForKey(SettingKeys.PLUGIN_LOGDEBUG_ENABLED, logDebug)
    Settings.setSettingForKey(SettingKeys.PLUGIN_SHOW_DOUBLESTYLES, showDoubleStyle)
    Settings.setSettingForKey(SettingKeys.PLUGIN_SHOW_JSON, showJSON)
    Settings.setSettingForKey(SettingKeys.PLUGIN_GENERATE_SYMBOLTOKENS, genSymbTokens)
    Settings.setSettingForKey(SettingKeys.PLUGIN_GA_DISABLED, !gaEnabled)
    Settings.setSettingForKey(SettingKeys.PLUGIN_NODEJS_PATH, nodeJSPAth)
    Settings.setSettingForKey(SettingKeys.PLUGIN_SASSMODULE_PATH, sassModulePath)

    return true

};

