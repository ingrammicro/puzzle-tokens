@import("constants.js")
@import("lib/utils.js")
@import("lib/uidialog.js")
@import("classes/DSLayerCollector.js")

var app = undefined
var Sketch = require('sketch/dom')
var Settings = require('sketch/settings')
var Style = require('sketch/dom').Style
var Image = require('sketch/dom').Image
const path = require('path');
const Text = require('sketch/dom').Text

const alignMap = {
    left :      Text.Alignment.left,
    center :    Text.Alignment.center,
    right :     Text.Alignment.right,
    justify :   Text.Alignment.justify
}
const vertAlignMap = {
    "text-top" :       Text.VerticalAlignment.top,
    "baseline" :       Text.VerticalAlignment.center,
    "text-bottom" :    Text.VerticalAlignment.bottom
}

class DSApp {
    constructor(context) {
        this.nDoc = context.document
        this.sDoc = Sketch.fromNative(context.document)
        this.context = context
        this.UI = require('sketch/ui')
        
        this.elements = {
            styles:     {}
        }
        this.sTextStyles = {}
        this.sLayerStyles = {}

        this.less = undefined
    
        this.messages = ""

        this.errors = []

        // init global variable
        app = this

        // load settings       
        this.pathToTokensLess = Settings.settingForKey(SettingKeys.PLUGIN_PATH_TO_TOKENS_LESS)
        if(undefined==this.pathToTokensLess) this.pathToTokensLess = ''        
        this.pathToTokensLess2 = Settings.settingForKey(SettingKeys.PLUGIN_PATH_TO_TOKENS_LESS2)
        if(undefined==this.pathToTokensLess2) this.pathToTokensLess2 = ''        
        this.genSymbTokens = Settings.settingForKey(SettingKeys.PLUGIN_GENERATE_SYMBOLTOKENS)==1        
        this.showDebug = Settings.settingForKey(SettingKeys.PLUGIN_SHOW_DEBUG)==1        
        

        this._initStyles()
    }

    // Tools

    log(msg) {
        //log(msg)
        this.messages += msg + "\n"
    }

    logLayer(msg) {
        if (!Constants.LAYER_LOGGING) return
        log(msg)
    }


    logError(error) {
        this.log("[ ERROR ] " + error)
        this.errors.push(error)
    }

    stopWithError(error) {
        const UI = require('sketch/ui')
        UI.alert('Error', error)
        exit = true
    }

    // Public methods

    run() {        
        if(!this._showDialog()) return false
        this.pathToTokens = this.pathToTokensLess.substring(0, this.pathToTokensLess.lastIndexOf("/"));
        this.pathToTokens2 = this.pathToTokensLess2.substring(0, this.pathToTokensLess2.lastIndexOf("/"));

        var applied = false
        while(true){
            if( !this.loadLess()) break
            if( !this._checkLess()) break
            if( !this._showCheck()) break
            if( !this._applyLess() ) break
            if(this.genSymbTokens) this._saveElements()

            applied = true        
            this.log("Finished")
            break
        }

        // show final message
        if(this.errors.length>0){
            this._showErrors()
        }else{
            if(applied){
                this._showMessages()
            }
        }

    
        return true
    }

    // Internal

    _initStyles(){
        this.sTextStyles = {}
        this.sDoc.sharedTextStyles.forEach(function(sStyle){
            sStyle.name = sStyle.name.replace(" ",'')
            this.sTextStyles[sStyle.name] = sStyle
        },this)
        this.sLayerStyles = {}
        this.sDoc.sharedLayerStyles.forEach(function(sStyle){
            sStyle.name = sStyle.name.replace(" ",'')
            this.sLayerStyles[sStyle.name] = sStyle
        },this)
    }

    _showCheck(){        
        const dialog = new UIDialog("Review check result",NSMakeRect(0, 0, 400, 400),"Apply","")
        dialog.addTextViewBox("messages","Check results",this.messages,400)
        
        const result = dialog.run()
        dialog.finish()
        this.messages = ""

        return result
    }

    _showMessages(){        
        const dialog = new UIDialog("Completed",NSMakeRect(0, 0, 400, 400),"Ok","","")
        dialog.addTextViewBox("messages","Message Log",this.messages,400)
        const result = dialog.run()
        dialog.finish()
    }

    _showDebug(lessJSONStr){        
        const dialog = new UIDialog("Debug Information",NSMakeRect(0, 0, 600, 600),"Ok","","")
        dialog.addTextViewBox("debug","Intermediate JSON",lessJSONStr,600)
        const result = dialog.run()
        dialog.finish()
    }

    _showErrors(){
        var errorsText = this.errors.join("\n\n")

        const dialog = new UIDialog("Found errors",NSMakeRect(0, 0, 600, 600),"Who cares!","","")
        dialog.addTextViewBox("debug","",errorsText,600)
        const result = dialog.run()
        dialog.finish()
    }

    _saveElements(){
        const pathDetails = path.parse(this.sDoc.path)
        const pathToRules = pathDetails.dir + "/" + pathDetails.name + Constants.SYMBOLTOKENFILE_POSTFIX
        const json = JSON.stringify(this.elements,null,null)
        this.log("Save elements info into: "+pathToRules)
        Utils.writeToFile(json, pathToRules)
    }


    _showDialog(){
        const dialog = new UIDialog("Apply UI Tokens to Sketch styles",NSMakeRect(0, 0, 600, 180),"Apply")

        dialog.addPathInput({
            id:"pathToTokensLess",label:"Path to Design Tokens LESS file",labelSelect:"Select",
            textValue:this.pathToTokensLess,inlineHint:'e.g. /Work/ui-tokens.less',
            width:550,askFilePath:true
        })  
        dialog.addPathInput({
            id:"pathToTokensLess2",label:"Path to Design Tokens LESS file #2 (Optional)",labelSelect:"Select",
            textValue:this.pathToTokensLess2,inlineHint:'e.g. /Work/ui-tokens-custom.less',
            width:550,askFilePath:true
        })  
        dialog.addCheckbox("genSymbTokens","Generate symbols & styles description file",this.genSymbTokens)
        dialog.addCheckbox("showDebug","Show debug information",this.showDebug)


        while(true){
            const result = dialog.run()        
            if(!result) return false
    
            this.pathToTokensLess = dialog.views['pathToTokensLess'].stringValue()+""
            if(""==this.pathToTokensLess) continue
            this.pathToTokensLess2 = dialog.views['pathToTokensLess2'].stringValue()+""
            this.genSymbTokens = dialog.views['genSymbTokens'].state() == 1
            this.showDebug = dialog.views['showDebug'].state() == 1

            break
        }
    
        dialog.finish()

        Settings.setSettingForKey(SettingKeys.PLUGIN_PATH_TO_TOKENS_LESS, this.pathToTokensLess)
        Settings.setSettingForKey(SettingKeys.PLUGIN_PATH_TO_TOKENS_LESS2, this.pathToTokensLess2)
        Settings.setSettingForKey(SettingKeys.PLUGIN_GENERATE_SYMBOLTOKENS, this.genSymbTokens)
        Settings.setSettingForKey(SettingKeys.PLUGIN_SHOW_DEBUG, this.showDebug)
    

        return true
    }

    ////////////////////////////////////////////////////////////////

    _checkLess() {    
        for(const rule of this.less){
            const ruleType = this._getRulePropsType(rule.props)
            const sStyleName = this._pathToStr(rule.path)      
            rule.name = sStyleName
            //log("Check rule "+sStyleName)
            
            // Check rule
            if(ruleType.indexOf("text")>=0 && ruleType.indexOf("layer")>=0){
                this.logError("Rule \""+sStyleName +"\" has properties for both Text and Layer styles.")
                return
            }
            if(""==ruleType){
                this.logError("Rule \""+sStyleName +"\" has no valid properties")
                return
            }
            //     
            const isText = ruleType.indexOf("text")>=0
            
            // Find or create new style
            var sSharedStyle = null
            var sStyle = null

            sSharedStyle = isText?this.sTextStyles[sStyleName]:this.sLayerStyles[sStyleName]
            sStyle = sSharedStyle!=null?sSharedStyle.style:{}
             
            // Create new shared style
            const strType = isText?"Text":"Layer"
            if(!sSharedStyle){
                this.messages += "Will create new shared "+ strType + " style "+sStyleName +  "\n"
            }else{
                this.messages += "Will update shared "+ strType + " style "+sStyleName + "\n"
                sSharedStyle.sketchObject.resetReferencingInstances()
            }            
        }
        return true
    }


    _applyLess(justCheck) {    
        this.log("Started")
        for(const rule of this.less){
            const ruleType = this._getRulePropsType(rule.props)
            const sStyleName = rule.name // spcified in  _checkLess()
            log("Process rule "+sStyleName)         
            //

            if('image'==ruleType){
                this.logError("TODO - apply images")
                return
                this._applyPropsToImage(rule.props,sketchObj)
            }
            const isText = ruleType.indexOf("text")>=0
            
            // Find or create new style
            var sSharedStyle = null
            var sStyle = null

            sSharedStyle = isText?this.sTextStyles[sStyleName]:this.sLayerStyles[sStyleName]
            sStyle = sSharedStyle!=null?sSharedStyle.style:{}

            // Apply rule properties
            // drop commented property
            const validProps =  Object.keys(rule.props).filter(n => n.indexOf("__")<0)

            if(isText)
                this._applyRuleToTextStyle(rule,sSharedStyle,sStyle)
            else
                this._applyRuleToLayerStyle(rule,sSharedStyle,sStyle)
                       
             
            // Create new shared style
           if(!sSharedStyle){ 
                // change some wrong default values               
                this._tuneNewStyle(sStyle,isText)
                // create
                var SharedStyle = require('sketch/dom').SharedStyle
                sSharedStyle = SharedStyle.fromStyle({
                    name:       sStyleName,
                    style:      sStyle,
                    document:   this.nDoc
                  })
                if(isText)
                this.sTextStyles[sStyleName] = sSharedStyle
                 else
                this.sLayerStyles[sStyleName] = sSharedStyle
                this.log("[Created] new shared style "+sStyleName)
            }else{                
                sSharedStyle.sketchObject.resetReferencingInstances()
                this.log("[Updated] shared style "+sStyleName)
            }            

            this._saveTokensForStyleAndSymbols(rule.props,sSharedStyle)
        }
        return true
    }

    _tuneNewStyle(sStyle,isText){
        if(!isText){
            if(null==sStyle.borders){
                sStyle.borders = []
            }
            if(null==sStyle.fills){
                sStyle.fills = []
            }
        }

    }

    _getRulePropsType(props) {
        var res = ""
        if(null!=props['color'] || null!=props['font-family'] || null!=props['font-size']
            || null!=props['font-weight']  ||  null!=props['text-transform'] || null!=props['text-align'] || null!=props['vertical-align']
        )
            res +="text"
        if(null!=props['image'])
            res +="image"
        if(null!=props['background-color'] || null!=props[' border-color'] || null!=props['box-shadow']
            || null!=props['border-radius']
        )  res +="layer"

        return res
    }  

    loadLess() {
        const tempFolder = Utils.getPathToTempFolder()

        // check files
        if(!Utils.fileExistsAtPath(this.pathToTokensLess)){
            this.logError("Can not find .less file by path: "+this.pathToTokensLess)
            return false
        }
        // check files
        if(this.pathToTokensLess2!="" && !Utils.fileExistsAtPath(this.pathToTokensLess2)){
            this.logError("Can not find .less file by path: "+this.pathToTokensLess2)
            return false
        }

        // Copy less2json conversion script 
        const scriptPath = Utils.copyScript('nsconvert.js',tempFolder)
        if(undefined==scriptPath) return false

        // Run less2json 
        const pathToLessJSON = tempFolder + "/nsdata.less.json"
        var args = [scriptPath]
        args.push(this.pathToTokensLess)
        if(this.pathToTokensLess2!="") args.push(this.pathToTokensLess2)
        args.push(pathToLessJSON)

        const runResult = Utils.runCommand("/usr/local/bin/node",args)
        if(!runResult.result){
            this.logError(runResult.output)
            return false
        }    
        
        // load json file
        var error = null
        var lessJSONStr =  Utils.readFile(pathToLessJSON)
        try {
            this.less = JSON.parse(lessJSONStr)
        } catch (e) {
            this.logError(e)
            return false
        }

        if(this.showDebug){
            this._showDebug(lessJSONStr)
        }

        return true
    }

    // objPath: [page,artboard,layer,...,layer]
    _pathToStr(objPath){
        // clear obj path
        objPath = objPath.map(n=>n.replace(/^\./,''))
        var objPathStr = objPath.join("/")
        return objPathStr
    }

    _saveTokensForStyleAndSymbols(token,sharedStyle){
        // process all layers which are using this shared style
        for(var layer of sharedStyle.getAllInstancesLayers()){
            this._addTokenToSymbol(token,layer)
        }
        // save shared style
        this._addTokenToStyle(token,sharedStyle)
    }  


    _addTokenToStyle(token,sharedStyle){
        
        var styleInfo = null
        if (sharedStyle.name in this.elements.styles){        
            styleInfo = this.elements.styles[sharedStyle.name]
        }else{
            styleInfo = {
                tokens: {}
            }
            this.elements.styles[sharedStyle.name] = styleInfo
        }

        for(var tokenName of Object.keys(token.__lessTokens)){
            styleInfo.tokens[tokenName] = true
        }


    }

    _addTokenToSymbol(token,slayer){

        var nlayer = slayer.sketchObject.parentSymbol()
        if(null==nlayer){
            return false
        }
        const symbolLayer = Sketch.fromNative(nlayer)

        //
        var symbolInfo = null
        if(symbolLayer.name in this.elements){
            symbolInfo = this.elements[ symbolLayer.name ]
        }else{
            symbolInfo = {
                layers:{}             
            }
            this.elements[ symbolLayer.name ] = symbolInfo
        }

        for(var tokenName of Object.keys(token.__lessTokens)){
            var layerInfo = null
            if(slayer.name in symbolInfo.layers){
                layerInfo =  symbolInfo.layers[slayer.name]                 
            }else{
                layerInfo = {
                    tokens: {}
                }
                symbolInfo.layers[slayer.name] = layerInfo
            }
            layerInfo.tokens[tokenName] = true
        }

        return true
    }



    _applyFillGradient(token, obj,colorsRaw) {
        // parse string in format: linear-gradient(#00000,#F0000);
        const i1 = colorsRaw.indexOf("(");
        const i2 = colorsRaw.lastIndexOf(")");
        if(i1<0 || i2<0){
            return this.logError("Wrong gradient format: "+colorsRaw+". Can't find ( or )")
        }
        const colors = colorsRaw.substring(i1+1,i2).split(",")
        if(colors.length!=2){
            return this.logError("Wrong gradient format: "+colorsRaw+". Can't find two colors")
        }

        var colorFrom = Utils.stripStr(colors[0])
        var colorTo = Utils.stripStr(colors[1])

        const gradientTypes={
            'linear-gradient':      Style.GradientType.Linear,
            'radial-gradient':      Style.GradientType.Radial,
            'angular':              Style.GradientType.Angular
        }
        const gradientTypeSrc = colorsRaw.substring(0,colorsRaw.indexOf("(") )
        if(""==gradientTypeSrc){
            return this.logError("Wrong gradient format: "+colorsRaw+". Can't find gradient type")
        }

        if(!(gradientTypeSrc in gradientTypes)){
            return this.logError('Uknown gradient type: '+gradientTypeSrc)
        }

        var fill = {
            fill: Style.FillType.Gradient,
            gradient: {
                gradientType:  gradientTypes[gradientTypeSrc],
                from: { x: 0.5, y: 0},
                to: { x: 0.5, y: 1},
                stops:[
                    { color: colorFrom, position: 0},
                    { color: colorTo, position: 1}
                ]
            }
        }
        obj.slayer.style.fills = [fill]

    }
 
    _applyFillGradientProcessColor(token,colorType){
        var color = token['fill-'+colorType+'-color']
        var opacity = token['fill-'+colorType+'-color-opacity']

        if('transparent'==color){
            var opacity = "0%"
            color =  "#FFFFFF" + Utils.opacityToHex(opacity)
        }else{
            if(undefined!=opacity) color = color + Utils.opacityToHex(opacity)                
        }
        return color
    }

    _applyShadow(rule,sStyle, isInner, shadowCSS) {
        
        var shadows = []
        if(shadowCSS!="" && shadowCSS!="none"){
            var shadow = Utils.splitCSSShadow(shadowCSS)    
            shadow.enabled = true
            shadow.type = 'Shadow'
            shadows = [shadow]
        }else{
           //obj.slayer.style.shadows = []
        }

        if(isInner)
            sStyle.innerShadows = shadows
        else   
            sStyle.shadows = shadows

    }

    _applyShapeRadius(rule, sSharedStyle, sStyle) {
        const token = rule.props

        if(null==sSharedStyle) return true

        var radius = token['border-radius']
        const layers = sSharedStyle.getAllInstancesLayers()

        for(var l of layers){

            if(radius!=""){               
                const points =  l.points    
                if(Array.isArray(radius)){                
                    for (let x=0; x < points.length; ++x ) {
                        points[x].cornerRadius =  parseFloat(radius[x])
                    }
                }else{
                    for (let x=0; x < points.length; ++x ) {
                        points[x].cornerRadius =  parseFloat(radius)
                    }
                }
            }    
            //this._addTokenToSymbol(token,l)
        }

        return true 
    } 

    _applyBorderStyle(rule, sStyle){
        const token = rule.props
        
        var border = {
        }
        
        if(('border-color' in token) && ''==token['border-color']){
            border = undefined
        }else{

            // process color
            if(('border-color' in token)){
                var color = token['border-color']
                var opacity = token['border-color-opacity']
                if(undefined!=opacity) color = color + Utils.opacityToHex(opacity)
                border.color = color        
            }

            // process width
            if('border-width' in token){
                border.thickness = token['border-width'].replace("px","")
            }

            // process position
            if('border-position' in token){
                var conversion = {
                    'center':     Style.BorderPosition.Center,
                    'inside':     Style.BorderPosition.Inside,
                    'outside':    Style.BorderPosition.Outside
                }
                if( !(token['border-position'] in conversion) ){
                    return this.logError('Wrong border-position')
                }

                border.position = conversion[ token['border-position'] ]
            }
        }
       
       
        // save new border in style
       sStyle.borders = border?[border]:[]

    }

    _getObjTextData(obj){
        var orgTextStyle =   obj.slayer.style.sketchObject.textStyle()        
        const textAttribs = orgTextStyle.attributes()
        
        const textTransformAttribute = textAttribs.MSAttributedStringTextTransformAttribute
        const colorAttr = textAttribs.NSColor
        const kernAttr = textAttribs.NSKern

        var attributes = {
            'NSFont' : textAttribs.NSFont.copy(),
            'NSParagraphStyle': textAttribs.NSParagraphStyle.copy()
        };
        if(colorAttr) 
            attributes['NSColor'] = colorAttr.copy()
        if(textTransformAttribute) 
            attributes['MSAttributedStringTextTransformAttribute'] = textTransformAttribute.copy()
        if(kernAttr) 
            attributes['NSKern'] = kernAttr.copy()

        return {
            'attributes':attributes,
            'orgTextStyle':orgTextStyle
        }
    }

    ////////////////////////////////////////////////////////////////////////////
        
    _applyRuleToLayerStyle(rule, sSharedStyle,sStyle) {        
        const token = rule.props
        // SET COLOR
        var backColor = token['background-color']
        if(backColor!=null){
            if(backColor.indexOf("gradient")>0){
                return this._applyFillGradient(rule, sStyle, color)
            }else if(backColor!=""){
                if('transparent'==backColor){
                    var opacity = "0%"
                    backColor =  "#FFFFFF" + Utils.opacityToHex(opacity)
                }if(backColor.startsWith("#")){
                    var opacity = token['opacity']
                    if(undefined!=opacity) backColor = backColor + Utils.opacityToHex(opacity)                                
                }


                var fill = {
                    color: backColor,
                    fill: Style.FillType.Color
                }
                sStyle.fills = [fill]            
            }else{
                sStyle.fills = []
            }
        }

        // SET SHADOW
        var boxShadow = token['box-shadow']
        if(boxShadow!=null){
            this._applyShadow(rule,sStyle,false,boxShadow)
        }

        // SET BORDER
        if(('border-color' in token) || ('border-width' in token) || ('border-position' in token))
            this._applyBorderStyle(rule,sStyle)        


        // SET BORDER RADIUS
        if('border-radius' in token)
            this._applyShapeRadius(rule,sSharedStyle,sStyle)

    }
    


    _applyRuleToTextStyle(rule,sSharedStyle,sStyle){
        const token = rule.props

         // read token attribues
         var fontSize = token['font-size']
         var fontFace = token['font-family']
         var color = token['color']
         var fontWeight = token['font-weight']
         var transform = token['text-transform']
         var lineHeight = token['line-height']
         var align = token['text-align']
         var verticalAlign = token['vertical-align']
         
         //// SET FONT SIZE
         if(undefined!=fontSize){                      
            sStyle.fontSize = parseFloat(fontSize.replace("px",""))
         }
         //// SET FONT SIZE
         if(undefined!=fontFace){  
            let firstFont = fontFace.split(',')[0]
            firstFont = firstFont.replace(/[""]/gi,'')
            sStyle.fontFamily = firstFont             
         }           
         if(undefined!=align){                                  
            if(!(align in alignMap)){
                return this.logError("Wrong align '"+align+"' for rule "+rule.name)
            }
            sStyle.alignment = alignMap[align]
         }
         if(undefined!=verticalAlign){                                  
            if(!(verticalAlign in vertAlignMap)){
                return this.logError("Wrong vertical-align' '"+verticalAlign+"' for rule "+rule.name)
            }
            sStyle.verticalAlignment = vertAlignMap[verticalAlign]
         }

         //// SET LINE HEIGHT
         if(undefined!=lineHeight){
             if(null==sStyle.fontSize){
                 return this.logError("Can not apply line-height without font-size for rule "+rule.name)
             }
            sStyle.lineHeight = Math.round(parseFloat(lineHeight) * sStyle.fontSize)
         }else{
             //obj.slayer.style.lineHeight = null
         }
         //// SET FONT WEIGHT
         if(undefined!=fontWeight){
             var weightKey = "label"
             const weights = [
                 {label:  'extra-light',sketch: 3,css:    200},
                 {label: 'light',sketch: 4,css:    300},                
                 {label:  'regular',sketch: 5,css:    400},
                 {label:  'medium',sketch: 6,css:    500},
                 {label:  'semi-bold',sketch: 8,css:    600},
                 {label:  'semibold',sketch: 8,css:    600},
                 {label:  'bold',sketch: 9,css:    700}
             ]
 
             // for numeric weight we support it uses css format
             if(!isNaN(fontWeight)){
                 weightKey = 'css'
                 fontWeight = fontWeight * 1
             }
 
             var finalWeight = undefined
             for(var w of weights){
                 if(w[weightKey] == fontWeight){
                     finalWeight = w.sketch
                     break
                 }
             }
             if(undefined==finalWeight){
                 return this.logError('Wrong font weigh for rule '+rule.name)
             }
             
             sStyle.fontWeight = finalWeight
         }
 
          // SET TEXT COLOR
          if(undefined!=color){
             let opacity = token['opacity']
             let opacityHEX = undefined!=opacity?Utils.opacityToHex(opacity):''
 
             sStyle.textColor = color + opacityHEX
         }
         // SET TEXT TRANSFORM
         if(undefined!=transform){
            sStyle.textTransform = transform
         }

         var textShadow = token['text-shadow']
         if(textShadow!=null){
            this._applyShadow(rule,sStyle,false,textShadow)
        }
    }


    _applyPropsToImage(token, obj) {        
        var imageName = token['image']

        if(imageName!=""){          
            if('transparent'==imageName){                
                obj.slayer.style.opacity = 0
            }else{
                let path = this.pathToTokens + "/" + imageName

                var fileManager = [NSFileManager defaultManager];
                if (! [fileManager fileExistsAtPath: path]) {
                    return this.logError('Image not found on path: '+path)
                }

                let parent = obj.slayer.parent
                let frame = new Rectangle(obj.slayer.frame)
                let oldConstraints =   obj.nlayer.resizingConstraint()
                obj.slayer.remove()

                let simage =  new Image({
                    frame:frame,
                    name:obj.name,
                    image: path
                  })
                parent.layers.push(simage)
                
                obj.slayer = simage
                obj.nlayer = simage.obj
                
                obj.slayer.frame.width  = simage.image.nsimage.size().width / 4
                obj.slayer.frame.height  = simage.image.nsimage.size().height / 4

                obj.nlayer.resizingConstraint = oldConstraints

                /*
                let image = [[NSImage alloc] initWithContentsOfFile:path];
                obj.slayer.image = image                
                obj.slayer.style.opacity = 1
                if(path.includes('@2x')){
                    obj.slayer.frame.width  = image.size().width  / 2
                    obj.slayer.frame.height  = image.size().height / 2  
                }else{
                    obj.slayer.frame.width  = image.size().width
                    obj.slayer.frame.height  = image.size().height    
                }*/
            }            
        }

        return true // we don't need to sync changes with shared style here
    } 


}
