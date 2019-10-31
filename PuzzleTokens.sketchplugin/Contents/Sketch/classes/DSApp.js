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
    "top" :       Text.VerticalAlignment.top,
    "middle" :       Text.VerticalAlignment.center,
    "bottom" :    Text.VerticalAlignment.bottom
}

function degToRad(deg){
    return deg * Math.PI/180;
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
        this.genSymbTokens = Settings.settingForKey(SettingKeys.PLUGIN_GENERATE_SYMBOLTOKENS)==1        
        this.showDebug = Settings.settingForKey(SettingKeys.PLUGIN_SHOW_DEBUG)==1        
        

        this._initStyles()
    }

    // Tools

    logMsg(msg) {
        //log(msg)
        this.messages += msg + "\n"
    }

    logLayer(msg) {
        if (!Constants.LAYER_LOGGING) return
        log(msg)
    }


    logError(error) {
        this.logMsg("[ ERROR ] " + error)
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

        var applied = false
        while(true){
            if( !this.loadLess()) break
            if( !this._checkLess()) break
            if( !this._showCheck()) break
            if( !this._applyLess() ) break
            if(this.genSymbTokens) this._saveElements()

            applied = true        
            this.logMsg("Finished")
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
            //sStyle.name = sStyle.name.replace(" ",'')
            this.sTextStyles[sStyle.name] = sStyle
        },this)
        this.sLayerStyles = {}
        this.sDoc.sharedLayerStyles.forEach(function(sStyle){
            //sStyle.name = sStyle.name.replace(" ",'')
            this.sLayerStyles[sStyle.name] = sStyle
        },this)
    }

    _showCheck(){        
        const dialog = new UIDialog("Review changes before you apply it",NSMakeRect(0, 0, 400, 400),"Apply","")
        dialog.addTextViewBox("messages","The following changes will be made in Sketch file:",this.messages,400)
        
        const result = dialog.run()
        dialog.finish()
        this.messages = ""

        return result
    }

    _showMessages(){        
        const dialog = new UIDialog("Less styles have been successfully applied",NSMakeRect(0, 0, 400, 400),"Dismiss","","")
        dialog.addTextViewBox("messages","See what has been changed:",this.messages,400)
        const result = dialog.run()
        dialog.finish()
    }

    _showDebug(lessJSONStr){        
        const dialog = new UIDialog("Debug Information",NSMakeRect(0, 0, 600, 600),"Ok","","")

        dialog.addTextViewBox("debug","Convertor output",this.convertorOuput,lessJSONStr!=null?250:600)
        
        if(lessJSONStr!=null){
            dialog.addTextViewBox("debug","Intermediate JSON",lessJSONStr,250)
        }
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
        this.logMsg("Save elements info into: "+pathToRules)
        Utils.writeToFile(json, pathToRules)
    }


    _showDialog(){
        const dialog = new UIDialog("Apply LESS styles to Sketch file",NSMakeRect(0, 0, 600, 140),"Apply")

        dialog.addPathInput({
            id:"pathToTokensLess",label:"Set path to a LESS styles file",labelSelect:"Select",
            textValue:this.pathToTokensLess,inlineHint:'e.g. /Work/ui-tokens.less',
            width:550,askFilePath:true
        })   
        dialog.addCheckbox("genSymbTokens","Generate symbols & styles description file (used by Puzzle Publisher)",this.genSymbTokens)
        dialog.addCheckbox("showDebug","Show debug information",this.showDebug)


        while(true){
            const result = dialog.run()        
            if(!result) return false
    
            this.pathToTokensLess = dialog.views['pathToTokensLess'].stringValue()+""
            if(""==this.pathToTokensLess) continue
            this.genSymbTokens = dialog.views['genSymbTokens'].state() == 1
            this.showDebug = dialog.views['showDebug'].state() == 1

            break
        }
    
        dialog.finish()

        Settings.setSettingForKey(SettingKeys.PLUGIN_PATH_TO_TOKENS_LESS, this.pathToTokensLess)
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

            if(rule.path[0].startsWith('#')){
                rule.isStandalone = true
                rule.sLayer = this._findSymbolChildByPath(rule.path)
                if(!rule.sLayer){
                 
                    return
                }
            }
            //log("Check rule "+sStyleName)
            if(ruleType.indexOf("image")>=0){
                this.messages += "Will update image "+sStyleName +  "\n"       
                continue
            }
            
            // Check rule
            if(ruleType.indexOf("text")>=0 && ruleType.indexOf("layer")>=0){
                this.logError("Rule \""+sStyleName +"\" has properties for both Text and Layer styles.")
                return
            }
            if(""==ruleType){
                this.logError("Rule \""+sStyleName +"\" has no valid properties")
                this.logError(JSON.stringify(rule,null,"\n"))
                return
            }
            //     
            const isText = ruleType.indexOf("text")>=0
            const strType = isText?"Text":"Layer"
            
            if( rule.isStandalone ){
                this.messages += "Will update "+ strType + " style of standalone layer "+sStyleName +  "\n"
            }else{
                // Find or create new style
                var sSharedStyle = null
                var sStyle = null

                sSharedStyle = isText?this.sTextStyles[sStyleName]:this.sLayerStyles[sStyleName]
                sStyle = sSharedStyle!=null?sSharedStyle.style:{}
                
                // Create new shared style
                if(!sSharedStyle){
                    this.messages += "Will create new shared "+ strType + " style "+sStyleName +  "\n"
                }else{
                    this.messages += "Will update shared "+ strType + " style "+sStyleName + "\n"
                }            
            }
        }
        return true
    }


    _applyLess(justCheck) {    
        this.logMsg("Started")
        for(const rule of this.less){
            const ruleType = this._getRulePropsType(rule.props)
            const sStyleName = rule.name // spcified in  _checkLess()
            //log("Process rule "+sStyleName)         
            //


            if(ruleType.indexOf("image")>=0){                
                this._applyPropsToImage(rule)
                continue
            }

            const isText = ruleType.indexOf("text")>=0
            
            // Find or create new style
            var sSharedStyle = null
            var sStyle = null

            if(rule.isStandalone){              
                sStyle = rule.sLayer.style
            }else{
                sSharedStyle = isText?this.sTextStyles[sStyleName]:this.sLayerStyles[sStyleName]
                sStyle = sSharedStyle!=null?sSharedStyle.style:{}
            }

            // Apply rule properties
            // drop commented property
            const validProps =  Object.keys(rule.props).filter(n => n.indexOf("__")<0)

            if(isText)
                this._applyRuleToTextStyle(rule,sSharedStyle,sStyle)
            else
                this._applyRuleToLayerStyle(rule,sSharedStyle,sStyle)
                       
             
            if(rule.isStandalone){
                this.logMsg("[Updated] style for standalone layer "+sStyleName)
            }else{
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
                    this.logMsg("[Created] new shared style "+sStyleName)
                }else{                
                    sSharedStyle.sketchObject.resetReferencingInstances()
                    this.logMsg("[Updated] shared style "+sStyleName)
                }            
                this._saveTokensForStyleAndSymbols(rule.props,sSharedStyle)
            }
        }
        return true
    }

    _tuneNewStyle(sStyle,isText){
        if(null==sStyle.borders){
            sStyle.borders = []
        }
       if(null==sStyle.fills){
            sStyle.fills = []
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
        if(null!=props['background-color'] || null!=props['border-color'] || null!=props['box-shadow']
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

        // Copy less2json conversion script 
        const scriptPath = Utils.copyScript('nsconvert_less.js',tempFolder)
        if(undefined==scriptPath) return false

        // Run less2json 
        const pathToLessJSON = tempFolder + "/nsdata.less.json"
        var args = [scriptPath]
        args.push(this.pathToTokensLess)
        args.push(pathToLessJSON)

        const runResult = Utils.runCommand("/usr/local/bin/node",args)
        if(!runResult.result){
            this.logError(runResult.output)
            return false
        }    
        this.convertorOuput = runResult.output
        
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

    // stylePath: [str,str]
    _pathToStr(objPath){
        objPath = objPath.map(n=>n.replace(/^[\.#]/,'').replace(/(_{2})/g,' '))
        var objPathStr = objPath.join("/")
        return objPathStr
    }

    // objPath: [#Controls,#Buttons,Text]
    _findSymbolChildByPath(path){
        // get 'Controls / Buttons' name of symbol master
        const symbolName = path.filter(s=>s.startsWith('#')).map(n=>n.replace(/^[\.#]/,'').replace(/(_{2})/g,' ')).join(' / ')        
        const sFoundLayers =  this.sDoc.getLayersNamed(symbolName)
        //log('_findSymbolChildByPath path='+path+" parent name="+symbolName)
        if(!sFoundLayers.length) {
            this.logError("Can not find a Symbol Master or Artboard by name '"+symbolName+"'")
            return null
        }

        const layerPath = path.filter(s=>!s.startsWith('#')).map( n=>n.replace(/^[\.#]/,'').replace(/(\s+)/g,'') )   
        const sLayer = this._findLayerChildByPath(sFoundLayers[0],layerPath)
        if(!sLayer){
            this.logError("Can not find a layer '" + layerPath.join(' / ') + "' in symbol master or artboard'"+symbolName+"'")
        }
        return sLayer
    }

    _findLayerChildByPath(sLayerParent,path){
        const pathNode = path[0]
        for(var sLayer of sLayerParent.layers){
            if(sLayer.name.replace(/(\s+)/g,"") == pathNode){
                if(path.length==1){
                    // found last element                    
                    return sLayer
                }
                if('Group'==sLayer.type){
                    return this._findLayerChildByPath(sLayer,path.slice(1))
                }else{
                    // oops we can't go deeply here
                    return null                    
                }
            }
        }        
        return null
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

    _applyFillGradient(rule,sStyle,colorsRaw) {
        const token = rule.props
        // parse string in format: linear-gradient(#00000,#F0000);

        // CHECK GRADIENT TYPE
        const gradientTypes={
            'linear-gradient':      Style.GradientType.Linear,
            'radial-gradient':      Style.GradientType.Radial,
            'angular':              Style.GradientType.Angular
        }
        const gradientTypeSrc = colorsRaw.substring(0,colorsRaw.indexOf("(") )
        if(""==gradientTypeSrc){
            return this.logError("Wrong gradient format: "+colorsRaw+". Can't find gradient type for rule "+rule.name)
        }
        if(!(gradientTypeSrc in gradientTypes)){
            return this.logError('Uknown gradient type: '+gradientTypeSrc)
        }

        // PARSE VALUE
        // linear-gradient(45deg,#0071ba, black)  => 45deg,#0071ba,black
        var sValues = colorsRaw.replace(/(^[\w-]*\()/,"").replace(/(\)\w*)/,"").replace(" ","")
        var deg = 180
        if(sValues.indexOf("deg")>=0){
            var sDeg = sValues.replace(/(\n*)deg.*/,"")     
            sValues = sValues.substring(sValues.indexOf(",")+1) 

            if(""==sDeg){
                return this.logError("Wrong gradient format: "+colorsRaw+". Can't find '[Number]deg' "+rule.name)
            }
            deg = parseFloat(sDeg,10)
        }
        
        var aValues = sValues.split(",").map(s => Utils.stripStr(s))


        var count = aValues.length
        var lenA = 0.5

        var fill = {
            fill: Style.FillType.Gradient,
            gradient: {
                gradientType:  gradientTypes[gradientTypeSrc],
                stops:[]
            }
        }

        var delta = 1/(count-1)
  
        var from = {}
        var to = {}

        if(0==deg){
            from = {x:0.5,y:1}
            to = {x:0.5,y:0}
        }else if(90==deg){
            from = {x:0,y:0.5}
            to = {x:1,y:0.5}           
        }else if(180==deg){
            from = {x:0.5,y:0}
            to = {x:0.5,y:1}           
        }else if(270==deg){
            from = {x:1,y:0.5}
            to = {x:0,y:0.5}     
        }else{
            var srcDeg = deg
            if(deg<=45) deg=deg
            else if(deg<90) deg = 90-deg
            else if(deg<=135) deg = deg-90
            else if(deg<180) deg = deg-135
            else if(deg<=225) deg = deg-180
            else if(deg<270) deg = 270-deg
            else if(deg<=315) deg = 315-deg
            else if(deg<360) deg = 360-deg


            var lenB = Math.tan(degToRad(deg)) * lenA
            lenB = Math.round(lenB*100)/100
            var lenC = lenA / Math.cos(degToRad(deg))           
            lenC = Math.round(lenC*100)/100        
            
            // fixed X
            if((srcDeg>45 && srcDeg<=135)){
                from.x = 0
                to.x = 1
            }
            if((srcDeg>225 && srcDeg<315)){
                from.x = 1
                to.x = 0
            }
            // fixed y
            if((srcDeg>0 && srcDeg<=45)||(srcDeg>270 && srcDeg<=360)){
                from.y = 1
                to.y = 0
            }   
            if(srcDeg>135 && srcDeg<=225){
                from.y = 0
                to.y = 1
            }    
            // float x
            if((srcDeg>0 && srcDeg<=45)){
                from.x = lenA - lenB
                to.x = lenA + lenB
            }else if(srcDeg>135 && srcDeg<180){
                from.x = lenB
                to.x = lenA*2 - lenB
            }else if((srcDeg>180 && srcDeg<=225) || (srcDeg>315 && srcDeg<360)){
                from.x = lenA + lenB
                to.x = lenA - lenB
            }
            // float y
            if((srcDeg>45 && srcDeg<=90) || (srcDeg>270 && srcDeg<=315)){
                from.y = lenA*2 - lenB
                to.y = lenB
            }else if((srcDeg>90 && srcDeg<=135) || srcDeg>225 && srcDeg<270){
                from.y = lenA - lenB
                to.y = lenA + lenB
            }
        }

        fill.gradient.to = to
        fill.gradient.from = from

        aValues.forEach(function(sColor,index){
            fill.gradient.stops.push({
                color:      sColor, 
                position:   index*delta
            })
        })

        sStyle.fills = [fill]

    }
 
    _applyFillGradientProcessColor(rule,sStyle,colorType){
        const token = rule.props
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

    _applyShadow(rule,sStyle,shadowPropName) {                
        var shadows = []
        var shadow = null

        var shadowCSS = rule.props[shadowPropName]

        //log('shadowCSS='+shadowCSS)
        if(shadowCSS!=null && shadowCSS!="" && shadowCSS!="none"){
            shadow = Utils.splitCSSShadow(shadowCSS)    
            shadow.enabled = true
            shadow.type = 'Shadow'
            shadows = [shadow]
        }else{
           //sLayer.style.shadows = []
        }

        if(shadow && shadow.inset)
            sStyle.innerShadows = shadows
        else   
            sStyle.shadows = shadows

    }

    _applyShapeRadius(rule, sSharedStyle, sStyle) {
        const token = rule.props

        if(null==sSharedStyle && null==rule.sLayer) return true

        var radius = token['border-radius']
        const layers = rule.sLayer?[rule.sLayer]:sSharedStyle.getAllInstancesLayers()

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
        const borderWidth = token['border-width']
        const borderColor = token['border-color']
        
        var border =  sStyle.borders && sStyle.borders.length>0?sStyle.borders[0]:{}
        
        // process color
        if(null!=borderColor){
            var color = borderColor
            var opacity = token['border-color-opacity']
            if(null!=opacity) color = color + Utils.opacityToHex(opacity)
            border.color = color 
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

         // process width
        if(null!=borderWidth){
            border.thickness = borderWidth.replace("px","")               
        }                           
       
        // save new border in style        
    
        sStyle.borders = border && (borderColor==null || borderColor!='none') && (borderWidth==null || borderWidth!='0px') ?[border]:[]

    }

    _getObjTextData(obj){
        var orgTextStyle =   sLayer.style.sketchObject.textStyle()        
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
                return this._applyFillGradient(rule, sStyle, backColor)
            }else if(backColor!="" && backColor!="none" ){
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
        this._applyShadow(rule,sStyle,'box-shadow')
        
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
        if(sStyle.fontStyle!="") sStyle.fontStyle = ""
        if(sStyle.fontVariant!="") sStyle.fontVariant = ""
        if(sStyle.fontStretch!="") sStyle.fontStretch = ""

         //// SET FONT FACE
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
             //sLayer.style.lineHeight = null
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

         // SET TEXT SHADOW
        this._applyShadow(rule,sStyle,"text-shadow")
    }


    _applyPropsToImage(rule) {  
        const token = rule.props      
        const imageName = token['image']
        var sLayer = rule.sLayer

        if(imageName!=""){          
            if('transparent'==imageName){                
                sLayer.style.opacity = 0
            }else{
                let path = this.pathToTokens + "/" + imageName

                var fileManager = [NSFileManager defaultManager];
                if (! [fileManager fileExistsAtPath: path]) {
                    return this.logError('Image not found on path: '+path)
                }

                // create new image
                let parent = sLayer.parent
                let frame = new Rectangle(sLayer.frame)
                let oldConstraints =  sLayer.sketchObject.resizingConstraint()

                let sNewImage =  new Image({
                    frame:frame,
                    name:sLayer.name,
                    image: path
                })
                var sStyle = sNewImage.style
                // remove old image
                sLayer.remove()                
                sLayer = null  
                parent.layers.push(sNewImage)
                                
                // calculage new frame
                var newWidth=null
                var newHeight = null
                var rawImageSize = sNewImage.image.nsimage.size()

                if(null!=token.width){
                    const width =  parseInt(token.width.replace(/([px|\%])/,""),10)
                    if(token.width.indexOf("px")>0){
                        newWidth = width
                    }if(token.width.indexOf("%")>0){  
                        newWidth = Math.floor(rawImageSize.width / 100 * width)
                    }else{                        
                    }
                }
                if(null!=token.height){
                    const height =  parseInt(token.height.replace(/([px|\%])/,""),10)
                    if(token.height.indexOf("px")>0){
                        newHeight = height
                    }if(token.height.indexOf("%")>0){  
                        newHeight = Math.floor(rawImageSize.height / 100 * height)
                    }else{                        
                    }
                }

                if(null!=newWidth && null!=newHeight){                   
                }else if(null!=newWidth){
                    newHeight = rawImageSize.height * (newWidth /rawImageSize.width )                    
                }else if(null!=newHeight){
                    newWidth = rawImageSize.width * (newHeight / rawImageSize.height)
                }else{
                    newWidth = rawImageSize.width
                    newHeight = rawImageSize.height 
                }
                sNewImage.frame.width = newWidth
                sNewImage.frame.height = newHeight

                // set new position
                var newTop = token.top
                var newLeft = token.left
                var newRight = token.right
                var newBottom = token.bottom

                if(null!=newTop && null!=newBottom){
                    sNewImage.frame.y = parseInt(newTop.replace('px',""))
                    sNewImage.frame.height = (parent.frame.height - parseInt(newBottom.replace('px',""))) - sNewImage.frame.y
                }else if(null!=newTop){
                    sNewImage.frame.y = parseInt(newTop.replace('px',""))
                }else{
                    sNewImage.frame.y =  parent.frame.height - parseInt(newBottom.replace('px',"")) - sNewImage.frame.height
                }
                if(null!=newLeft && null!=newRight){
                    sNewImage.frame.x = parseInt(newLeft.replace('px',""))
                    sNewImage.frame.width = (parent.frame.width - parseInt(newRight.replace('px',""))) - sNewImage.frame.x
                }else if(null!=newLeft){
                    sNewImage.frame.x = parseInt(newLeft.replace('px',""))
                }else{
                    sNewImage.frame.x =  parent.frame.width - parseInt(newRight.replace('px',"")) - sNewImage.frame.width
                }

                sNewImage.sketchObject.resizingConstraint = oldConstraints

                // apply additional styles
                this._applyShadow(rule,sStyle,'box-shadow')
                this._applyBorderStyle(rule,sStyle)

                /*
                let image = [[NSImage alloc] initWithContentsOfFile:path];
                sLayer.image = image                
                sLayer.style.opacity = 1
                if(path.includes('@2x')){
                    sLayer.frame.width  = image.size().width  / 2
                    sLayer.frame.height  = image.size().height / 2  
                }else{
                    sLayer.frame.width  = image.size().width
                    sLayer.frame.height  = image.size().height    
                }*/
            }            
        }

        return true 
    } 


}
