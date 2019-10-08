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
        
        this.layers = {}
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
        this.pathToTokensLess2 = Settings.settingForKey(SettingKeys.PLUGIN_PATH_TO_TOKENS_LESS2)
        if(undefined==this.pathToTokensLess2) this.pathToTokensLess2 = ''        
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

  
    _initLayers() {
        const layerCollector  = new DSLayerCollector() 
        this.layers = layerCollector.collectLayers()
    }


    // Public methods

    run() {
        if(!this._showDialog()) return false
        this.pathToTokens = this.pathToTokensLess.substring(0, this.pathToTokensLess.lastIndexOf("/"));
        this.pathToTokens2 = this.pathToTokensLess2.substring(0, this.pathToTokensLess2.lastIndexOf("/"));

        while(true){
            this._initLayers()

            if( !this.loadLess()) break
            if( !this._applyLess() ) break
            if(this.genSymbTokens) this._saveElements()

            break
        }

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
        const pathDetails = path.parse(this.jDoc.path)
        const pathToRules = pathDetails.dir + "/" + pathDetails.name + Constants.SYMBOLTOKENFILE_POSTFIX
        const json = JSON.stringify(this.elements,null,null)
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


        while(true){
            const result = dialog.run()        
            if(!result) return false
    
            this.pathToTokensLess = dialog.views['pathToTokensLess'].stringValue()+""
            if(""==this.pathToTokensLess) continue
            this.pathToTokensLess2 = dialog.views['pathToTokensLess2'].stringValue()+""
            this.genSymbTokens = dialog.views['genSymbTokens'].state() == 1

            break
        }
    
        dialog.finish()

        Settings.setSettingForKey(SettingKeys.PLUGIN_PATH_TO_TOKENS_LESS, this.pathToTokensLess)
        Settings.setSettingForKey(SettingKeys.PLUGIN_PATH_TO_TOKENS_LESS2, this.pathToTokensLess2)
        Settings.setSettingForKey(SettingKeys.PLUGIN_GENERATE_SYMBOLTOKENS, this.genSymbTokens)
    

        return true
    }

    _applyLess() {

        
        for(const rule of this.less){
            const sketchPath = rule.path

            // find Skech Object
            var sketchObj = this._getObjByPath(sketchPath)
            if(undefined==sketchObj){
                this.logError("Can not find Sketch layer by path: "+sketchPath.join())
                return
            }      
            
            // Drop commented property
            const validProps =  Object.keys(rule.props).filter(n => n.indexOf("__")<0)

            if("Text"==sketchObj.slayer.type){
                this._applyPropsToText(rule.props,sketchObj)
            }else if("ShapePath"==sketchObj.slayer.type){
                this._applyPropsToShape(rule.props,sketchObj)
            }else if("Image"==sketchObj.slayer.type){
                this._applyPropsToImage(rule.props,sketchObj)
            }

            /*for(const tokenName of Object.keys(rule.props)){                                                         
                if('inner-shadow' in token)
                   this._applyShadow(token,tokenName,sketchObj, true, token['inner-shadow'])              
            }
            */
        }
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

        log(runResult.output)

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

        return true
    }

    // objPath: [page,artboard,layer,...,layer]
    _getObjByPath(objPath){
        var objects = undefined        

        const symbSeparator = '///'
        if(objPath[0].indexOf(symbSeparator)>0){
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
            objects = this.layers
        }

        // clear obj path
        objPath = objPath.map(n=>n.replace(/^\./,''))
        var objPathStr = objPath.join("/")

        // search obj
        var obj = this.layers[objPathStr]               
        return obj
    }

    _syncSharedStyle(token,obj){
        if(obj.insideMaster) return

        if(!obj.slayer.sharedStyle){
            //return this.logError('No shared style for some of "'+tokenName+'" styles')
            var SharedStyle = require('sketch/dom').SharedStyle
            obj.slayer.sharedStyle = SharedStyle.fromStyle({
                name:       obj.slayer.name,
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

        return this._syncSharedStyle(token,obj)        
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

    _applyShadow(token, obj, isInner, shadowCSS) {
        
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

        return this._syncSharedStyle(token,obj)        
    }

    _applyShapeRadius(token, styleObj) {

        var radius = token['border-radius']
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

    _applyBorderStyle(token, obj){
        
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
        obj.slayer.style.borders = border?[border]:[]

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



    _applyShadow(token, obj, isInner, shadowCSS) {
        
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

        return this._syncSharedStyle(token,obj)        
    }
    
    ////////////////////////////////////////////////////////////////////////////
        
    _applyPropsToShape(token, obj) {        
        // SET COLOR
        var backColor = token['background-color']
        if(backColor!=null){
            if(backColor.indexOf("gradient")>0){
                return this._applyFillGradient(token, obj, color)
            }else if(backColor!=""){
                if('transparent'==backColor){
                    var opacity = "0%"
                    backColor =  "#FFFFFF" + Utils.opacityToHex(opacity)
                }if(backColor.startsWith("#")){
                    var opacity = token['opacity']
                    if(undefined!=opacity) backColor = backColor + Utils.opacityToHex(opacity)                                
                }

                //log('_applyPropsToShape color='+backColor+" src="+token['background-color'])

                var fill = {
                    color: backColor,
                    fill: Style.FillType.Color
                }
                obj.slayer.style.fills = [fill]            
            }else{
                obj.slayer.style.fills = []
            }
        }

        // SET SHADOW
        var boxShadow = token['box-shadow']
        if(boxShadow!=null){
            this._applyShadow(token,obj,false,boxShadow)
        }

        // SET BORDER
        if(('border-color' in token) || ('border-width' in token) || ('border-position' in token))
            this._applyBorderStyle(token,obj)        


        // SET BORDER RADIUS
        if('border-radius' in token)
            this._applyShapeRadius(token,obj)

        return this._syncSharedStyle(token,obj)        
    }
    


    _applyPropsToText(token,obj){
         // read token attribues
         var fontSize = token['font-size']
         var fontFace = token['font-face']
         var color = token['color']
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
                 return this.logError('Wrong font weigh')
             }
             
             obj.slayer.style.fontWeight = finalWeight
         }
 
          // SET TEXT COLOR
          if(undefined!=color){
             let opacity = token['opacity']
             let opacityHEX = undefined!=opacity?Utils.opacityToHex(opacity):''
 
             obj.slayer.style.textColor = color + opacityHEX
             log("color="+color)
         }
         // SET TEXT TRANSFORM
         if(undefined!=transform){
             obj.slayer.style.textTransform = transform
         }


         var textShadow = token['text-shadow']
         if(textShadow!=null){
            this._applyShadow(token,obj,false,textShadow)
        }

     
         return this._syncSharedStyle(token,obj)
    }


    _applyPropsToImage(token, obj) {        
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

        //return this._syncSharedStyle(tokenName,obj)        
        return true // we don't need to sync changes with shared style here
    } 


}
