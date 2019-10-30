@import "lib/uidialog.js";
@import "lib/utils.js";
@import "classes/DSPreviewer.js";
@import "constants.js";

var onRun = function(context) {  
  const sketch = require('sketch')
  const Settings = require('sketch/settings') 
  const document = sketch.fromNative(context.document)
  const UI = require('sketch/ui')
  
  UIDialog.setUp(context);

  var app = new DSPreviewer(context)
  app.run()

};

