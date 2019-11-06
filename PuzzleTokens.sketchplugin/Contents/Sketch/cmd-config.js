@import "lib/uidialog.js";
@import "lib/utils.js";
@import "constants.js";


var onRun = function(context) {  
  const sketch = require('sketch')
  const Settings = require('sketch/settings') 
  const document = sketch.fromNative(context.document)
  const UI = require('sketch/ui')
  
  UIDialog.setUp(context);

  // Read settings
  let showDebug = Settings.settingForKey(SettingKeys.PLUGIN_SHOW_DEBUG)==1       
  let genSymbTokens = Settings.settingForKey(SettingKeys.PLUGIN_GENERATE_SYMBOLTOKENS)==1         

  // Build dialog
  const dialog = new UIDialog("Configure",NSMakeRect(0, 0, 400, 120),"Save","Edit Puzzle Tokens common configuration settings.")
  
  dialog.addLabel("","Apply Options")
  dialog.addCheckbox("showDebug","Show debug information",showDebug)

  dialog.addDivider()
  dialog.addLabel("","Integration with Puzzle Publisher",40)
  dialog.addCheckbox("genSymbTokens","Generate symbols & styles file",genSymbTokens)  


  // Run event loop
  while(true){
    const result = dialog.run()        
    if(!result){
        dialog.finish()
        return false
    }
    showDebug = dialog.views['showDebug'].state() == 1
    genSymbTokens = dialog.views['genSymbTokens'].state() == 1

    break
}
dialog.finish()

// Save updated settings
Settings.setSettingForKey(SettingKeys.PLUGIN_SHOW_DEBUG, showDebug)
Settings.setSettingForKey(SettingKeys.PLUGIN_GENERATE_SYMBOLTOKENS, genSymbTokens)    

return true

};

