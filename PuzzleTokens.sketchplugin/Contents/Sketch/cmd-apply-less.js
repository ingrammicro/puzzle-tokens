@import "lib/uidialog.js";
@import "lib/utils.js";
@import "classes/DSApp.js";
@import "constants.js";

var onRun = function(context) {  
  const sketch = require('sketch')
  const Settings = require('sketch/settings') 
  const document = sketch.fromNative(context.document)
  const UI = require('sketch/ui')
  
  UIDialog.setUp(context);

  var myless = new DSApp(context)
  myless.run()

};

