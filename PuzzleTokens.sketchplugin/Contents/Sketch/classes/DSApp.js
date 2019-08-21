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


class DSApp {
    constructor(context) {
        this.nDoc = context.document
        this.jDoc = Sketch.fromNative(context.document)
        this.context = context
        this.UI = require('sketch/ui')
        
        this.pages = {}
        this.elements = {
            styles:     {}
        }

        this.less = undefined
    
        this.errors = []

        // init global variable
        app = this

        // load settings       
        this.pathToTokensLess = Settings.settingForKey(SettingKeys.PLUGIN_PATH_TO_TOKENS_LESS)
        if(undefined==this.pathToTokensLess) this.pathToTokensLess = ''        
        this.pathToSketchStylesJSON = Settings.settingForKey(SettingKeys.PLUGIN_PATH_TO_SKETCHSTYLES_LESS)
        if(undefined==this.pathToSketchStylesJSON) this.pathToSketchStylesJSON = ''
        this.genSymbTokens = Settings.settingForKey(SettingKeys.PLUGIN_GENERATE_SYMBOLTOKENS)==1        

        
    }

    // Tools

    log(msg) {
        if (!Constants.LOGGING) return
        log(msg)
    }

    logLayer(msg) {
        if (!Constants.LAYER_LOGGING) return
        log(msg)
    }


    logError(error) {
        log("[ ERROR ] " + error)
        this.errors.push(error)
    }

    stopWithError(error) {
        const UI = require('sketch/ui')
        UI.alert('Error', error)
        exit = true
    }

  
    _initPages() {
        const layerCollector  = new DSLayerCollector() 
        this.pages = layerCollector.collectPages()
    }


    // Public methods

    run() {
        if(!this._showDialog()) return false
        this.pathToTokens = this.pathToTokensLess.substring(0, this.pathToTokensLess.lastIndexOf("/"));

        this._initPages()


        if( !this.loadLess()) return false        
        if( !this._applyLess() ) return false

        if(this.genSymbTokens) this._saveElements()

        // show final message
        if(this.errors.length>0){
            this.UI.alert('Found errors',this.errors.join("\n\n"))
        }else{
            this.UI.message('Tokens applied')
        }
    
        return true
    }

    // Internal


    _saveElements(){
        /*
        const pathToRules = this.pathToSketchStylesJSON.substring(0, this.pathToSketchStylesJSON.lastIndexOf("/"))
             + "/" + this.doc.name + "." + Constants.SYMBOLTOKENFILE_POSTFIX
        */
        const pathDetails = path.parse(this.jDoc.path)
        const pathToRules = pathDetails.dir + "/" + pathDetails.name + Constants.SYMBOLTOKENFILE_POSTFIX
        log(pathToRules)
        const json = JSON.stringify(this.elements,null,null)
        Utils.writeToFile(json, pathToRules)
    }


    _showDialog(){
        const dialog = new UIDialog("Apply UI Tokens to Sketch styles",NSMakeRect(0, 0, 600, 180),"Apply")

        dialog.addPathInput({
            id:"pathToTokensLess",label:"Path to Design Tokens (LESS file)",labelSelect:"Select",
            textValue:this.pathToTokensLess,inlineHint:'e.g. /Work/ui-tokens.less',
            width:550,askFilePath:true
        })  
        dialog.addPathInput({
            id:"pathToSketchStylesJSON",label:"Path to Sketch Styles (JSON file)",labelSelect:"Select",
            textValue:this.pathToSketchStylesJSON,inlineHint:'e.g. ~/Work/sketch-styles.json',
            width:550,askFilePath:true
        })
        dialog.addCheckbox("genSymbTokens","Generate symbols & styles description file",this.genSymbTokens)


        while(true){
            const result = dialog.run()        
            if(!result) return false
    
            this.pathToTokensLess = dialog.views['pathToTokensLess'].stringValue()+""
            if(""==this.pathToTokensLess) continue
            this.pathToSketchStylesJSON = dialog.views['pathToSketchStylesJSON'].stringValue()+""
            if(""==this.pathToSketchStylesJSON) continue
            this.genSymbTokens = dialog.views['genSymbTokens'].state() == 1

            break
        }
    
        dialog.finish()

        Settings.setSettingForKey(SettingKeys.PLUGIN_PATH_TO_TOKENS_LESS, this.pathToTokensLess)
        Settings.setSettingForKey(SettingKeys.PLUGIN_PATH_TO_SKETCHSTYLES_LESS, this.pathToSketchStylesJSON)
        Settings.setSettingForKey(SettingKeys.PLUGIN_GENERATE_SYMBOLTOKENS, this.genSymbTokens)
    

        return true
    }

    _getTokensText(){
        var tokensStr = ''

        tokensStr = tokensStr + Utils.readFile(this.pathToTokensLess)

        return tokensStr
    }


    _applyLess() {
        var tokensStr = Utils.readFile(this.pathToSketchStylesJSON)
        var tokens = JSON.parse(tokensStr)

        for(var tokenName of Object.keys(tokens)){
            // skip comments
            if(tokenName.indexOf("__")==0) continue          

            // work with token
            var token = tokens[tokenName]

            // skip token without sketch path
            if(!('sketch' in  token)) continue          

            // fill token attribute values from LESS file
            token.__lessTokens = {}
            var ok = true
            for(var attrName of Object.keys(token)){
                if(attrName.indexOf("__")==0) continue

                var attrValue= token[attrName]
                if(''==attrValue || attrValue.indexOf("__")==0) continue

                if(attrValue.indexOf(";")>=0){
                    // transform "@radius;@radius;0;0"
                    var lessValue = []
                    for(var elem of attrValue.split(';')){
                        if(elem.indexOf("@")==0){
                            token.__lessTokens[elem] = true
                            elem = this._getLessVar(elem)                            
                            if(undefined==elem){
                                ok = false
                                continue
                            }                                                 
                        }                        
                        lessValue.push(elem)
                    }
                    if(!ok) continue
                    token[attrName] = lessValue
                }else if(attrValue.indexOf("@")==0){
                    token.__lessTokens[attrValue] = true
                    var lessValue = this._getLessVar(attrValue)                            
                    if(undefined==lessValue){
                        ok = false
                        continue
                    }
                    token[attrName] = lessValue
                }
            }
            if(!ok) continue

            var sketchPaths = token['sketch']
            if(!Array.isArray(sketchPaths))
                sketchPaths = [sketchPaths]

            for(var sketchPath of sketchPaths){
                if(sketchPath.indexOf("__")==0) continue //Path to Sketch object undefined
                var sketchObj = this._getObjByPath(sketchPath)
                if(undefined==sketchObj){
                    this.logError("Can not find Sketch layer by path: "+sketchPath)
                    continue
                }

                // Apply Styles
                if(
                    ('font-size' in token) || ('text-color' in token)
                    || ('font-weight' in token) || ('text-transform' in token) || ('font-face' in token)
                )
                    this._applyTextStyle(token,tokenName,sketchObj)               
                if('fill-color' in token)
                    this._applyFillColor(token,tokenName,sketchObj,token['fill-color'])
                if('fill-from-color' in token)
                    this._applyFillGradient(token,tokenName,sketchObj)
                if('shadow' in token)
                   this._applyShadow(token,tokenName,sketchObj, false, token['shadow'])
                if('inner-shadow' in token)
                   this._applyShadow(token,tokenName,sketchObj, true, token['inner-shadow'])
                if(('border-color' in token) || ('border-width' in token) || ('border-position' in token))
                    this._applyBorderStyle(token,tokenName,sketchObj)                        
                if('shape-radius' in token)
                    this._applyShapeRadius(token,tokenName,sketchObj)
                if('image' in token)
                    this._applyImage(token,tokenName,sketchObj)
            }

        }
        
        return true
    }

    loadLess() {
        const tempFolder = Utils.getPathToTempFolder()

        // Copy less2json conversion script 
        const scriptPath = Utils.copyScript('nsconvert.js',tempFolder)
        if(undefined==scriptPath) return false

        // Run less2json 
        const pathToLessJSON = tempFolder + "/nsdata.less.json"
        var args = [scriptPath]
        args.push(this.pathToTokensLess)
        args.push(pathToLessJSON)

        const runResult = Utils.runCommand("/usr/local/bin/node",args)

        if(!runResult.result){
            this.UI.alert('Can not transform LESS file to JSON', runResult.output)
            return false
        }    
        
        // load json file
        var error = null
        var lessJSONStr = NSString.stringWithContentsOfURL_encoding_error(NSURL.fileURLWithPath_isDirectory(pathToLessJSON, false), NSUTF8StringEncoding, error);

        this.less = JSON.parse(lessJSONStr)
        return true
    }

    _getObjByPath(objPath){
        var objects = undefined        

        const symbSeparator = '///'
        if(objPath.indexOf(symbSeparator)>0){
            // search in Page //// Symbol //// Layer / Layer
            const top = objPath.split(symbSeparator)
            if(top.length!=3){
                this.logError("Wrong format of sketch symbol path. Should be Page///Symbol///Layer/Layer")
                return undefined
            }
            const pageName = top[0]
            const symbolName = top[1]
            const layerPath = top[2]

            if(!(pageName in this.pages)){
                this.logError("Failed to find page with name '"+pageName+"'")
                return undefined
            }
            const page = this.pages[pageName]        
            if(!(symbolName in page.childs)){
                this.logError("Failed to find symbol with name '"+symbolName+"' in page '"+pageName+"'")
                return undefined
            }    
            const symbolObj = page.childs[symbolName]            
            objects = symbolObj.childs
            objPath = layerPath
        }else{            
            objects = this.pages
        }

        log(objPath)
        var names = objPath.split('/') 
        var obj = undefined
        for(var objName of names){
            obj = objects[objName]
            if(undefined==obj) break
            objects = obj.childs
        }

        if (undefined == obj) {
            return undefined
        }

        return obj
    }

    _syncSharedStyle(token,tokenName,obj){
        if(!obj.slayer.sharedStyle){
            //return this.logError('No shared style for some of "'+tokenName+'" styles')
            var SharedStyle = require('sketch/dom').SharedStyle
            obj.slayer.sharedStyle = SharedStyle.fromStyle({
                name:       tokenName,
                style:      obj.slayer.style,
                document:   this.ocDoc
              })
        }else{
            obj.slayer.sharedStyle.style = obj.slayer.style
        }
        obj.slayer.sharedStyle.sketchObject.resetReferencingInstances()


        this._addStyleTokenToSymbol(token,obj.slayer)
        

        return true
    }

    _addStyleTokenToSymbol(token,styleSLayer){
        const sharedStyle = styleSLayer.sharedStyle
        // process all layers which are using this shared style
        for(var layer of sharedStyle.getAllInstancesLayers()){
            this._addTokenToSymbol(token,layer)
        }
        // save shared style
        this._addTokenToStyle(token,styleSLayer)
    }  


    _addTokenToStyle(token,styleSLayer){
        const sharedStyle = styleSLayer.sharedStyle
        
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
    
    
    _getLessVar(lessName){
        // cut first @
        if(lessName.indexOf("@")==0) 
            lessName = lessName.substring(1,lessName.length)

        var lessVar = this.less[lessName]
        if (undefined == lessVar) {
            this.logError("Can not find less variable for '" + lessName + "'")
            return undefined
        }
        return lessVar
    }    
 
    _applyFillColor(token, tokenName, obj, color) {
        
        if(color!=""){
            if('transparent'==color){
                var opacity = "0%"
                color =  "#FFFFFF" + Utils.opacityToHex(opacity)
            }else{
                var opacity = token['fill-color-opacity']
                if(undefined!=opacity) color = color + Utils.opacityToHex(opacity)                
            }

            var fill = {
                color: color,
                fill: Style.FillType.Color
            }
            obj.slayer.style.fills = [fill]
            
        }else{
            obj.slayer.style.fills = []
        }

        return this._syncSharedStyle(token,tokenName,obj)        
    }


    _applyFillGradient(token, tokenName, obj) {
        var colorFrom = this._applyFillGradientProcessColor(token,'from')
        var colorTo = this._applyFillGradientProcessColor(token,'to')
    
        const gradientTypes={
            'linear':       Style.GradientType.Linear,
            'radial':       Style.GradientType.Radial,
            'angular':      Style.GradientType.Angular
        }

        const gradientTypeSrc = 'fill-gradient-type' in token?token['fill-gradient-type']:'linear'
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

        return this._syncSharedStyle(token,tokenName,obj)        
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

    _applyShadow(token, tokenName, obj, isInner, shadowCSS) {
        
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
            obj.slayer.style.innerShadows = shadows
        else   
            obj.slayer.style.shadows = shadows

        return this._syncSharedStyle(token,tokenName,obj)        
    }

    _applyShapeRadius(token, tokenName, styleObj) {

        var radius = token['shape-radius']
        const layers = styleObj.slayer.sharedStyle.getAllInstancesLayers()

        for(var l of layers){
            this.log(' _applyShapeRadius() process layer: '+l.name + (l.parent?(" parent: "+l.parent.name):""))

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
            this._addTokenToSymbol(token,l)
        }

        
        //this._addTokenToSymbol(token,obj.slayer)
        //return this._syncSharedStyle(tokenName,obj)        
        return true // we don't need to sync changes with shared style here
    } 


    _applyImage(token, tokenName, obj) {        
        var imageName = token['image']

        if(imageName!=""){          
            if('transparent'==imageName){                
                obj.slayer.style.opacity = 0
            }else{
                let path = this.pathToTokens + "/" + imageName
                //'/Users/baza/Ingram/Themes/ingram-micro-brand-aligned/design-tokens/images/panel-logo@2x.png'
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
                obj.nlayer = simage.sketchObject
                
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

        //return this._syncSharedStyle(tokenName,obj)        
        return true // we don't need to sync changes with shared style here
    } 

    _applyBorderStyle(token,tokenName, obj){
        
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
                border.thickness = token['border-width']
            }

            // process position
            if('border-position' in token){
                var conversion = {
                    'center':     Style.BorderPosition.Center,
                    'inside':     Style.BorderPosition.Inside,
                    'outside':    Style.BorderPosition.Outside
                }
                if( !(token['border-position'] in conversion) ){
                    return this.logError('Wrong border-position for token: '+tokenName)
                }

                border.position = conversion[ token['border-position'] ]
            }
        }
       
       
        // save new border in style
        obj.slayer.style.borders = border?[border]:[]


        return this._syncSharedStyle(token,tokenName,obj)
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


    _applyTextStyle(token,tokenName, obj){
        // read token attribues
        var fontSize = token['font-size']
        var fontFace = token['font-face']
        var color = token['text-color']
        var fontWeight = token['font-weight']
        var transform = token['text-transform']
        var lineHeight = token['line-height']
        
        //// SET FONT SIZE
        if(undefined!=fontSize){                      
            obj.slayer.style.fontSize = parseFloat(fontSize.replace("px",""))
        }        
        //// SET FONT SIZE
        if(undefined!=fontFace){  
            let firstFont = fontFace.split(',')[0]
            firstFont = firstFont.replace(/[""]/gi,'')
            obj.slayer.style.fontFamily = firstFont
            log('firstFont:'+firstFont)
        }           
        //// SET LINE HEIGHT
        if(undefined!=lineHeight){                      
            obj.slayer.style.lineHeight = Math.round(parseFloat(lineHeight) * obj.slayer.style.fontSize)
        }else{
            //obj.slayer.style.lineHeight = null
        }
        //// SET FONT WEIGHT
        if(undefined!=fontWeight){
            var weightKey = "label"
            const weights = [
                {
                    label:  'extra-light',
                    sketch: 3,
                    css:    200
                },
                {
                    label: 'light',
                    sketch: 4,
                    css:    300
                },                
                {
                    label:  'regular',
                    sketch: 5,
                    css:    400
                },
                {
                    label:  'medium',   
                    sketch: 6,
                    css:    500
                },
                {
                    label:  'semi-bold',
                    sketch: 8,
                    css:    600
                },
                {
                    label:  'semibold',
                    sketch: 8,
                    css:    600
                },
                {   
                    label:  'bold',
                    sketch: 9,
                    css:    700
                }
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
                log("weightKey="+weightKey+"  fontWeight="+fontWeight)
                return this.logError('Wrong font weight for token: '+tokenName)
            }
            
            obj.slayer.style.fontWeight = finalWeight
        }

         // SET TEXT COLOR
         if(undefined!=color){
            let opacity = token['text-color-opacity']
            let opacityHEX = undefined!=opacity?Utils.opacityToHex(opacity):''

            obj.slayer.style.textColor = color + opacityHEX
        }
        // SET TEXT TRANSFORM
        if(undefined!=transform){
            obj.slayer.style.textTransform = transform
        }
    
        return this._syncSharedStyle(token,tokenName,obj)

    }

}
