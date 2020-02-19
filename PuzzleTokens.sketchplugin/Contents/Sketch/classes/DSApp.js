@import("constants.js")
@import("lib/utils.js")
@import("lib/uidialog.js")
@import("classes/DSLayerCollector.js")

var app = undefined
var Sketch = require('sketch/dom')
var Settings = require('sketch/settings')
var Style = require('sketch/dom').Style
var Image = require('sketch/dom').Image
var SharedStyle = require('sketch/dom').SharedStyle
var UI = require('sketch/ui')
const path = require('path');
const Text = require('sketch/dom').Text
const Shape = require('sketch/dom').Shape
const Page = require('sketch/dom').Page


const SKLAYER_STYLE = "sklayer-style"
const SKTEXT_STYLE = "sktext-style"
const PT_TEXT = "pt-text"

const THIS_NAME = "_This"


const alignMap = {
    left: Text.Alignment.left,
    center: Text.Alignment.center,
    right: Text.Alignment.right,
    justify: Text.Alignment.justify
}
const vertAlignMap = {
    "top": Text.VerticalAlignment.top,
    "middle": Text.VerticalAlignment.center,
    "bottom": Text.VerticalAlignment.bottom
}
const bordedLineEndMap = {
    "butt": Style.LineEnd.Butt,
    "round": Style.LineEnd.Round,
    "projecting": Style.LineEnd.Projecting
}

const bordedLineJoinMap = {
    "miter": Style.LineJoin.Miter,
    "round": Style.LineJoin.Round,
    "bevel": Style.LineJoin.Bevel
}


const bordedArrowheadMap = {
    "none": Style.Arrowhead.None,
    "openarrow": Style.Arrowhead.OpenArrow,
    "filledarrow": Style.Arrowhead.FilledArrow,
    "opencircle": Style.Arrowhead.OpenCircle,
    "filledcircle": Style.Arrowhead.FilledCircle,
    "opensquare": Style.Arrowhead.OpenSquare,
    "filledsquare": Style.Arrowhead.FilledSquare,
}

function degToRad(deg) {
    return deg * Math.PI / 180;
}


class DSApp {
    constructor(context) {
        if (context.fromCmd) {
            this.fromCmd = true
            this.nDoc = context.nDoc
            this.sDoc = context.sDoc
        } else {
            this.nDoc = context.document
            this.sDoc = Sketch.fromNative(context.document)
        }
        this.context = context
        this.UI = require('sketch/ui')

        this.elements = {
            styles: {}
        }
        this.sTextStyles = {}
        this.sLayerStyles = {}
        this.sAppliedStyles = {}

        this._symbolPage = undefined

        this.rules = undefined

        this.result = {
            createdStyles: 0,
            updatedStyles: 0,
            assignedStyles: 0
        }

        this.messages = ""

        this.errors = []

        // init global variable
        app = this

        // load settings       
        this.pathToStyles = Settings.settingForKey(SettingKeys.PLUGIN_PATH_TO_TOKENS_LESS)
        this.pathToStyles = this.pathToStyles || ''

        this.pathToStylesList = Settings.settingForKey(SettingKeys.PLUGIN_PATH_TO_TOKENS_LESS_LIST)
        this.pathToStylesList = this.pathToStylesList || []
        if (this.pathToStylesList.length == 0 && this.pathToStyles != '') this.pathToStylesList.push(this.pathToStyles)

        this.pathToDoc = ""

        this.genSymbTokens = Settings.settingForKey(SettingKeys.PLUGIN_GENERATE_SYMBOLTOKENS) == 1
        this.showDebug = Settings.settingForKey(SettingKeys.PLUGIN_SHOW_DEBUG) == 1
        this.showCheck = Settings.settingForKey(SettingKeys.PLUGIN_SHOW_CHECK) == 1
        this.showDoubleStyleError = Settings.settingForKey(SettingKeys.PLUGIN_SHOW_DOUBLESTYLES) == 1

        this._initStyles()
    }

    // Tools

    logMsg(msg) {
        if (Constants.LOGGING) log(msg)
        this.messages += msg + "\n"
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


    runFromCmd(pathToStyles) {
        this.pathToStyles = pathToStyles
        if ('' == this.pathToStyles) return false
        const success = this.run(false)
        //UI.message(this._getResultSummary())        
        return success
    }

    runQuick() {
        if ('' == this.pathToStyles) return this.runDialog()
        const success = this.run(false)

        UI.message(this._getResultSummary())

        return success
    }

    runDialog() {
        if (!this._showDialog()) return false
        const success = this.run(this.showCheck)

        this._showMessages()
        return success
    }

    run(showCheck = true) {
        this.pathToTokens = this.pathToStyles.substring(0, this.pathToStyles.lastIndexOf("/"));

        if (this.genSymbTokens) {
            if (!this.sDoc.path) {
                return this.logError("Can't create symbols & style file for unsaved Sketch file. Save it befor or disable symbols & style file generation in Settings.")
            } else {
                const pathDetails = path.parse(this.sDoc.path)
                this.pathToDoc = pathDetails.dir + "/" + pathDetails.name
            }
        }

        var applied = false
        while (true) {
            if (!this.loadRules()) break
            if (!this._checkRules()) break
            if (showCheck && !this._showCheck()) break
            if (!this._applyRules()) break
            if (this.genSymbTokens) this._saveElements()

            applied = true
            this.logMsg("Finished")
            break
        }

        this.nDoc.reloadInspector();

        // show final message
        if (this.errors.length > 0) {
            this._showErrors()
            return false
        }

        return applied
    }

    // Internal

    _initStyles() {
        const showError = Settings.PLUGIN_SHOW_DOUBLESTYLES

        this.sTextStyles = {}
        this.sDoc.sharedTextStyles.forEach(function (sStyle) {
            //sStyle.name = sStyle.name.replace(" ",'')
            if (this.showDoubleStyleError && sStyle.name in this.sTextStyles) {
                this.logError("Found multiply text styles with name '" + sStyle.name + "'")
            }
            this.sTextStyles[sStyle.name] = sStyle
        }, this)
        this.sLayerStyles = {}
        this.sDoc.sharedLayerStyles.forEach(function (sStyle) {
            if (this.showDoubleStyleError && sStyle.name in this.sLayerStyles) {
                this.logError("Found multiply layer styles with name '" + sStyle.name + "'")
            }
            this.sLayerStyles[sStyle.name] = sStyle

        }, this)
    }

    // return Sketch native object
    _findStyleByName(styleName, isLayerStyle) {
        this.logMsg("_findStyleByName running...  styleName:" + styleName)


        const sLocalStyle = !isLayerStyle ? this.sTextStyles[styleName] : this.sLayerStyles[styleName]
        if (sLocalStyle) return sLocalStyle

        // find Sketch Artboard
        var sStyle = undefined
        var lib = undefined
        for (lib of this._getLibraries()) {
            this.logMsg("_findStyleByName for lib " + lib.sLib.name)
            sStyle = this._findStyleByNameInLibrary(styleName, isLayerStyle, lib)
            if (sStyle) break
        }
        // check artboard existing
        if (!sStyle) {
            this.logMsg("_findStyleByName FAILED")
            return false
        }
        return sStyle
    }

    _findStyleByNameInLibrary(styleName, isLayerStyle, jsLib) {
        let sFoundStyle = undefined
        const sStyleRefs = isLayerStyle ?
            jsLib.sLib.getImportableLayerStyleReferencesForDocument(this.sDoc)
            : jsLib.sLib.getImportableTextStyleReferencesForDocument(this.sDoc)

        sStyleRefs.forEach(function (sStyleRef) {
            if (sStyleRef.name == styleName) {
                sFoundStyle = sStyleRef.import()
                return
            }
        }, this)
        return sFoundStyle
    }

    _getLibraries() {
        if (undefined != this.jsLibs) return this.jsLibs

        log("_getLibraries: start")
        this.jsLibs = []

        var sLibraries = require('sketch/dom').getLibraries()
        for (const sLib of sLibraries) {
            if (!sLib.valid || !sLib.enabled) continue
            log("_getLibraries: try to load document for library " + sLib.name + "")

            const sDoc = sLib.getDocument()
            if (!sDoc) {
                log("_getLibraries: can't load document for library " + sDoc.path + "")
                continue
            }
            this.jsLibs.push({
                sLib: sLib,
                sDoc: sDoc
            })
        }
        log("_getLibraries: finish")
        return this.jsLibs
    }

    _getResultSummary() {
        var msg = ""
        if (this.result.createdStyles) msg += "Created " + this.result.createdStyles + " style(s). "
        if (this.result.updatedStyles) msg += "Updated " + this.result.updatedStyles + " style(s). "
        if (this.result.assignedStyles) msg += "Assigned " + this.result.assignedStyles + " style(s). "
        if (!(this.result.createdStyles + this.result.updatedStyles + this.result.assignedStyles)) msg = "No any styles applied or assigned "
        return msg
    }

    _showCheck() {
        const dialog = new UIDialog("Review changes before you apply it", NSMakeRect(0, 0, 800, 400), "Apply", "")
        dialog.removeLeftColumn()
        const text = this.messages != '' ? this.messages : "None "
        dialog.addTextViewBox("messages", "The following changes will be made in Sketch file:", text, 400)

        const result = dialog.run()
        dialog.finish()
        this.messages = ""

        return result
    }

    _showMessages() {
        const dialog = new UIDialog("Styles have been successfully applied", NSMakeRect(0, 0, 800, 400), "Dismiss", "", "")
        dialog.removeLeftColumn()
        dialog.addTextViewBox("messages", "See what has been changed:", this._getResultSummary() + "\n------------------\n" + this.messages, 400)
        const result = dialog.run()
        dialog.finish()
    }

    _showDebug(rulesJSONStr) {
        const dialog = new UIDialog("Debug Information", NSMakeRect(0, 0, 600, 600), "Ok", "", "")
        dialog.removeLeftColumn()

        dialog.addTextViewBox("debug", "Convertor output", this.convertorOuput, rulesJSONStr != null ? 250 : 600)

        if (rulesJSONStr != null) {
            dialog.addTextViewBox("debug", "Intermediate JSON", rulesJSONStr, 250)
        }
        const result = dialog.run()
        dialog.finish()
    }

    _showErrors() {
        var errorsText = this.errors.join("\n\n")

        if (this.fromCmd) {

        } else {
            const dialog = new UIDialog("Found errors", NSMakeRect(0, 0, 600, 600), "Who cares!", "", "")
            dialog.removeLeftColumn()
            dialog.addTextViewBox("debug", "", errorsText, 600)
            const result = dialog.run()
            dialog.finish()
        }
    }

    _saveElements() {
        const pathToRules = this.pathToDoc + Constants.SYMBOLTOKENFILE_POSTFIX
        const json = JSON.stringify(this.elements, null, null)
        this.logMsg("Save elements info into: " + pathToRules)
        Utils.writeToFile(json, pathToRules)
    }


    _showDialog() {
        const dialog = new UIDialog("Apply LESS/SASS styles", NSMakeRect(0, 0, 600, 120), "Apply", "Load LESS or SASS file with style definions and create new Sketch styles (or update existing).")
        dialog.removeLeftColumn()

        this.pathToStylesList = this.pathToStylesList.slice(0, 20)

        dialog.addPathInput({
            id: "pathToStyles", label: "Style File", labelSelect: "Select",
            textValue: this.pathToStyles, inlineHint: 'e.g. /Work/ui-tokens.less',
            width: 580, askFilePath: true,
            comboBoxOptions: this.pathToStylesList
        })
        dialog.addDivider()
        dialog.addCheckbox("showCheck", "Review style changes before apply", this.showCheck)

        while (true) {
            const result = dialog.run()
            if (!result) return false

            this.pathToStyles = dialog.views['pathToStyles'].stringValue() + ""
            if ("" == this.pathToStyles) continue
            ////
            const pathIndex = this.pathToStylesList.indexOf(this.pathToStyles)
            if (pathIndex < 0) {
                this.pathToStylesList.splice(0, 0, this.pathToStyles)
            } else {
                this.pathToStylesList.splice(pathIndex, 1)
                this.pathToStylesList.splice(0, 0, this.pathToStyles)
            }
            this.pathToStylesList = this.pathToStylesList.slice(0, 20)

            ///
            this.showCheck = dialog.views['showCheck'].state() == 1
            break
        }

        dialog.finish()

        Settings.setSettingForKey(SettingKeys.PLUGIN_PATH_TO_TOKENS_LESS_LIST, this.pathToStylesList)
        Settings.setSettingForKey(SettingKeys.PLUGIN_PATH_TO_TOKENS_LESS, this.pathToStyles)
        Settings.setSettingForKey(SettingKeys.PLUGIN_SHOW_CHECK, this.showCheck)

        return true
    }

    ////////////////////////////////////////////////////////////////

    _checkRules() {
        for (const rule of this.rules) {
            const ruleType = this._getRulePropsType(rule.props)
            const sStyleName = this._pathToStr(rule.path)
            rule.name = sStyleName
            rule.type = ruleType

            if (rule.path[0].startsWith('#')) {
                rule.isStandalone = true
                rule.sLayer = this._findSymbolChildByPath(rule.path)
                if (!rule.sLayer) {
                    this.messages += "Will create new symbol " + rule.path + " of " + ruleType + " type \n"
                }
            }
            if (ruleType.indexOf("image") >= 0) {
                this.messages += "Will update image " + sStyleName + "\n"
                continue
            }
            // Check rule
            if (ruleType.indexOf("text") >= 0 && ruleType.indexOf("layer") >= 0) {
                this.logError("Rule \"" + sStyleName + "\" has properties for both Text and Layer styles.")
                return
            }
            /*if ("" == ruleType) {
                this.logError("Rule \"" + sStyleName + "\" has no valid properties")
                this.logError(JSON.stringify(rule, null, "\n"))
                return
            }*/
            //     
            const isText = ruleType.indexOf("text") >= 0
            const isLayer = ruleType.indexOf("layer") >= 0
            const strType = isText ? "Text" : (isLayer ? "Layer" : "Uknown")

            if (rule.isStandalone) {
                this.messages += "Will update " + strType + " style of standalone layer " + sStyleName + "\n"
            } else {
                // Find or create new style
                var sSharedStyle = null
                var sStyle = null

                sSharedStyle = isText ? this.sTextStyles[sStyleName] : this.sLayerStyles[sStyleName]
                sStyle = sSharedStyle != null ? sSharedStyle.style : {}

                // Create new shared style
                if (!sSharedStyle) {
                    this.messages += "Will create new shared " + strType + " style " + sStyleName + "\n"
                } else {
                    this.messages += "Will update shared " + strType + " style " + sStyleName + "\n"
                }
            }
        }
        return true
    }

    _applyRules(justCheck) {
        this.logMsg("Started")
        for (const rule of this.rules) {
            const ruleType = rule.type
            const sStyleName = rule.name // spcified in  _checkRules()
            //
            //this.logMsg("_applyRules: process style  " + sStyleName)


            if (ruleType.indexOf("image") >= 0) {
                this._applyPropsToImage(rule)
            } else {

                const isText = ruleType.indexOf("text") >= 0
                const isLayer = ruleType.indexOf("layer") >= 0

                // Find or create new style
                var sSharedStyle = null
                var sStyle = null


                if (rule.isStandalone) {

                    if (!rule.sLayer) {
                        rule.sLayer = this._createSymbolMasterChild(rule)
                    }

                    // assign existing style
                    const sExistingStyle = this._getFindSharedStyleByRule(rule)
                    if (undefined != sExistingStyle) {
                        const l = rule.sLayer
                        l.style = {}
                        l.sharedStyle = sExistingStyle
                        l.style.syncWithSharedStyle(sExistingStyle)
                        this.result.assignedStyles++
                    }
                    //
                    sStyle = rule.sLayer.style
                } else {
                    sSharedStyle = isText ? this.sTextStyles[sStyleName] : this.sLayerStyles[sStyleName]
                    //if ("Style" == sSharedStyle.styleType)
                    //  sSharedStyle.styleType = isText ? SharedStyle.StyleType.Text : SharedStyle.StyleType.Layer
                    sStyle = sSharedStyle != null ? sSharedStyle.style : {
                        styleType: isText ? SharedStyle.StyleType.Text : SharedStyle.StyleType.Layer
                    }
                }

                // drop existing (or new) style properties before first apply
                if (!this.sAppliedStyles[sStyleName] && (isText || isLayer) && !rule.isStandalone) this._resetStyle(sStyle, isText)

                // Apply rule properties
                // drop commented property
                const validProps = Object.keys(rule.props).filter(n => n.indexOf("__") < 0)

                if (isText)
                    this._applyRuleToTextStyle(rule, sSharedStyle, sStyle)
                else if (isLayer)
                    this._applyRuleToLayerStyle(rule, sSharedStyle, sStyle)

                if (rule.isStandalone) {
                    this.logMsg("[Updated] style for standalone layer " + sStyleName)
                } else {
                    // Create new shared style
                    if (!sSharedStyle) {
                        // create
                        sSharedStyle = SharedStyle.fromStyle({
                            name: sStyleName,
                            style: sStyle,
                            document: this.nDoc
                        })
                        if (isText)
                            this.sTextStyles[sStyleName] = sSharedStyle
                        else
                            this.sLayerStyles[sStyleName] = sSharedStyle
                        this.result.createdStyles++
                        this.logMsg("[Created] new shared style " + sStyleName)

                    } else {
                        sSharedStyle.sketchObject.resetReferencingInstances()
                        this.logMsg("[Updated] shared style " + sStyleName)
                        this.result.updatedStyles++
                    }
                    this._saveTokensForStyleAndSymbols(rule.props, sSharedStyle)
                }
            }
            //
            this.sAppliedStyles[sStyleName] = true
        }


        return true
    }


    // Find or create a symbol master and place new layer inside
    _createSymbolMasterChild(rule) {
        let master = this._findSymbolMasterByPath(rule.path)
        if (!master) {
            const symbolPath = this._buildSymbolPathFromPath(rule.path)
            let symbolName = symbolPath.join(' / ')

            // Create new symbol master
            master = this._createNewSymbolMaster(symbolName)
        }

        // Get a name for the layer
        const layerPath = this._buildSymbolChildPathFromPath(rule.path)
        const layerName = layerPath[0]

        // Return ref to found master symbol itself
        if (THIS_NAME == layerPath) return master

        ///
        const isText = rule.type.indexOf("text") >= 0
        const isLayer = rule.type.indexOf("layer") >= 0
        let sLayer = null
        if (isLayer) {
            sLayer = new Shape({
                name: layerName,
                parent: master,
                style: {},
                frame: new Rectangle(
                    0, 0, 100, 100
                ),
                //sharedStyleId: isTextStyle ? undefined : sSharedStyle.id
            })
            if (sLayer.layers) { // remove group which Sketch creates for Shape
                const realShape = sLayer.layers[0]
                realShape.parent = master
                realShape.name = layerName
                sLayer.remove()
                sLayer = realShape
            }
        } else if (isText) {
            sLayer = new Text({
                name: layerName,
                parent: master,
                frame: new Rectangle(
                    0, 0, 100, 100
                ),
                style: {
                    borders: [],
                }
            })
            sLayer.name = layerName
        }
        return sLayer

    }

    _resetStyle(sStyle, isText) {
        sStyle.borders = []
        sStyle.fills = []
        sStyle.shadows = []
        sStyle.borderOptions = undefined
    }


    _getFindSharedStyleByRule(rule) {
        let sStyleNameSrc = ""
        let isText = false
        if (rule.type.indexOf(SKTEXT_STYLE) >= 0) {
            sStyleNameSrc = rule.props[SKTEXT_STYLE]
            isText = true
        } else if (rule.type.indexOf(SKLAYER_STYLE) >= 0) {
            sStyleNameSrc = rule.props[SKLAYER_STYLE]
        } else {
            return undefined
        }

        let sStyleName = sStyleNameSrc.replace(/(\s\/\s)/g, '\/').replace(/^(")/g, '').replace(/(")$/g, '')
        const sSharedStyle = this._findStyleByName(sStyleName, !isText)
        if (undefined == sSharedStyle) {
            this.logError("Can't find shared style by name " + sStyleName)
        }
        return sSharedStyle
    }


    _getRulePropsType(props) {
        var res = ""
        if (null != props['color'] || null != props['font-family'] || null != props['font-style'] || null != props['font-size']
            || null != props['font-weight'] || null != props['text-transform'] || null != props['text-align'] || null != props['vertical-align']
            || null != props['text-decoration'] || null != props['letter-spacing'] || null != props['pt-paragraph-spacing']
        )
            res += "text"
        if (null != props['image'])
            res += "image"
        if (null != props['background-color'] || null != props['border-color'] || null != props['box-shadow']
            || null != props['border-radius'] || null != props['padding']
        ) res += "layer"
        if (null != props['opacity'])
            if ("" == res)
                res += "single_opacity"
            else
                res += "opacity"

        if (null != props[SKLAYER_STYLE])
            res += SKLAYER_STYLE
        else if (null != props[SKTEXT_STYLE])
            res += SKTEXT_STYLE

        return res != "" ? res : "layer"
    }

    loadRules() {
        const tempFolder = Utils.getPathToTempFolder()

        // check files
        if (!Utils.fileExistsAtPath(this.pathToStyles)) {
            this.logError("Can not find styles file by path: " + this.pathToStyles)
            return false
        }

        const stylesType = this.pathToStyles.endsWith(".less") ? "less" : "sass"

        // Copy  conversion script
        const scriptPath = Utils.copyScript('nsconvert_' + stylesType + '.js', tempFolder)
        if (undefined == scriptPath) return false

        // Run script 
        var args = [scriptPath]
        args.push("-styles=" + this.pathToStyles)

        const pathToRulesJSON = tempFolder + "/nsdata.json"
        args.push("-json=" + pathToRulesJSON)

        if (this.pathToDoc != "") {
            const pathToCSS = this.pathToDoc + Constants.CSSFILE_POSTFIX
            args.push("-css=" + pathToCSS)
            const pathToVars = this.pathToDoc + Constants.VARSFILE_POSTFIX
            args.push("-vars=" + pathToVars)
        }

        const runResult = Utils.runCommand("/usr/local/bin/node", args)
        if (!runResult.result) {
            this.logError(runResult.output)
            return false
        }

        this.convertorOuput = runResult.output

        // load json file
        var error = null
        var rulesJSONStr = Utils.readFile(pathToRulesJSON)
        try {
            this.rules = JSON.parse(rulesJSONStr)
        } catch (e) {
            this.logError(e)
            return false
        }

        if (this.showDebug) {
            this._showDebug(rulesJSONStr)
        }

        return true
    }

    // stylePath: [str,str]
    _pathToStr(objPath) {
        objPath = objPath.map(n => n.replace(/^[\.#]/, '').replace(/(_{2})/g, ' '))
        var objPathStr = objPath.join("/")
        return objPathStr
    }

    // objPath: [#Controls,#Buttons,Text]
    _findSymbolChildByPath(path) {
        // get 'Controls / Buttons' name of symbol master
        const symbolPaths = this._buildSymbolPathFromPath(path)
        let symbolName = symbolPaths.join(' / ')
        let sFoundLayers = this.sDoc.getLayersNamed(symbolName).filter(l => l.type == 'SymbolMaster')
        if (!sFoundLayers.length) {
            symbolName = symbolPaths.join('/')
            sFoundLayers = this.sDoc.getLayersNamed(symbolName).filter(l => l.type == 'SymbolMaster')
        }
        if (!sFoundLayers.length) {
            return null
        }
        const layerPath = path.filter(s => !s.startsWith('#')).map(n => n.replace(/^[\.#]/, '').replace(/(\s+)/g, ''))

        // return ref to found master symbol itself
        if (layerPath.length && THIS_NAME == layerPath[0]) {
            return sFoundLayers[0]
        }

        // find a symbol child
        const sLayer = this._findLayerChildByPath(sFoundLayers[0], layerPath)
        if (!sLayer) {
            this.logError("Can not find a layer '" + layerPath.join(' / ') + "' in symbol master or artboard'" + symbolName + "'")
        }
        return sLayer
    }

    // objPath: [#Controls,#Buttons]
    _findSymbolMasterByPath(path) {
        // get 'Controls / Buttons' name of symbol master
        const symbolPaths = this._buildSymbolPathFromPath(path)
        let symbolName = symbolPaths.join(' / ')
        let sFoundLayers = this.sDoc.getLayersNamed(symbolName).filter(l => "SymbolMaster" == l.type)
        if (!sFoundLayers.length) {
            symbolName = symbolPaths.join('/')
            sFoundLayers = this.sDoc.getLayersNamed(symbolName).filter(l => "SymbolMaster" == l.type)
        }
        return sFoundLayers.length ? sFoundLayers[0] : null
    }

    // get existing or just create new Page with Symbols
    _getSymbolPage() {
        if (this._symbolPage) return this._symbolPage

        // try to find existing
        this.sDoc.pages.forEach(function (sPage) {
            if (Constants.SYMBOLPAGE_NAME == sPage.name) this._symbolPage = sPage
            return
        }, this)
        if (this._symbolPage) return this._symbolPage


        // create new
        this._symbolPage = new Page({
            name: Constants.SYMBOLPAGE_NAME,
            parent: this.sDoc,
            selected: true
        })

        return this._symbolPage
    }

    _createNewSymbolMaster(name) {
        const page = this._getSymbolPage()

        var SymbolMaster = require('sketch/dom').SymbolMaster
        var master = new SymbolMaster({
            name: name,
            parent: page
        })

        return master
    }


    _buildSymbolPathFromPath(path) {
        return path.filter(s => s.startsWith('#')).map(n => n.replace(/^[\.#]/, '').replace(/(_{2})/g, ' '))
    }
    _buildSymbolChildPathFromPath(path) {
        return path.filter(s => s.startsWith('.')).map(n => n.replace(/^[\.#]/, '').replace(/(_{2})/g, ' '))
    }


    _findLayerChildByPath(sLayerParent, path) {
        if (undefined == sLayerParent.layers) {
            return null
        }
        const pathNode = path[0]
        for (var sLayer of sLayerParent.layers) {
            if (sLayer.name.replace(/(\s+)/g, "") == pathNode) {
                if (path.length == 1) {
                    // found last element                    
                    return sLayer
                }
                if ('Group' == sLayer.type) {
                    return this._findLayerChildByPath(sLayer, path.slice(1))
                } else {
                    // oops we can't go deeply here
                    return null
                }
            }
        }
        return null
    }

    _saveTokensForStyleAndSymbols(token, sharedStyle) {
        // process all layers which are using this shared style
        for (var layer of sharedStyle.getAllInstancesLayers()) {
            this._addTokenToSymbol(token, layer)
        }
        // save shared style
        this._addTokenToStyle(token, sharedStyle)
    }


    _addTokenToStyle(token, sharedStyle) {

        var styleInfo = null
        if (sharedStyle.name in this.elements.styles) {
            styleInfo = this.elements.styles[sharedStyle.name]
        } else {
            styleInfo = {
                tokens: {}
            }
            this.elements.styles[sharedStyle.name] = styleInfo
        }

        for (var tokenName of Object.keys(token.__tokens)) {
            styleInfo.tokens[tokenName] = true
        }


    }

    _addTokenToSymbol(token, slayer) {

        var nlayer = slayer.sketchObject.parentSymbol()
        if (null == nlayer) {
            return false
        }
        const symbolLayer = Sketch.fromNative(nlayer)

        //
        var symbolInfo = null
        if (symbolLayer.name in this.elements) {
            symbolInfo = this.elements[symbolLayer.name]
        } else {
            symbolInfo = {
                layers: {}
            }
            this.elements[symbolLayer.name] = symbolInfo
        }

        for (var tokenName of Object.keys(token.__tokens)) {
            var layerInfo = null
            if (slayer.name in symbolInfo.layers) {
                layerInfo = symbolInfo.layers[slayer.name]
            } else {
                layerInfo = {
                    tokens: {}
                }
                symbolInfo.layers[slayer.name] = layerInfo
            }
            layerInfo.tokens[tokenName] = true
        }

        return true
    }

    _applyFillGradient(rule, sStyle, colorsRaw) {
        const token = rule.props
        // parse string in format: linear-gradient(#00000,#F0000);

        // CHECK GRADIENT TYPE
        const gradientTypes = {
            'linear-gradient': Style.GradientType.Linear,
            'radial-gradient': Style.GradientType.Radial,
            'angular': Style.GradientType.Angular
        }
        const gradientTypeSrc = colorsRaw.substring(0, colorsRaw.indexOf("("))
        if ("" == gradientTypeSrc) {
            return this.logError("Wrong gradient format: " + colorsRaw + ". Can't find gradient type for rule " + rule.name)
        }
        if (!(gradientTypeSrc in gradientTypes)) {
            return this.logError('Uknown gradient type: ' + gradientTypeSrc)
        }

        // PARSE VALUE
        // linear-gradient(45deg,#0071ba, black)  => 45deg,#0071ba,black
        var sValues = colorsRaw.replace(/(^[\w-]*\()/, "").replace(/(\)\w*)/, "").replace(" ", "")
        var deg = 180
        if (sValues.indexOf("deg") >= 0) {
            var sDeg = sValues.replace(/(\n*)deg.*/, "")
            sValues = sValues.substring(sValues.indexOf(",") + 1)

            if ("" == sDeg) {
                return this.logError("Wrong gradient format: " + colorsRaw + ". Can't find '[Number]deg' " + rule.name)
            }
            deg = parseFloat(sDeg, 10)
        }

        var aValues = sValues.split(",").map(s => Utils.stripStr(s))


        var count = aValues.length
        var lenA = 0.5

        var fill = {
            fill: Style.FillType.Gradient,
            gradient: {
                gradientType: gradientTypes[gradientTypeSrc],
                stops: []
            }
        }

        var delta = 1 / (count - 1)

        var from = {}
        var to = {}

        if (0 == deg) {
            from = { x: 0.5, y: 1 }
            to = { x: 0.5, y: 0 }
        } else if (90 == deg) {
            from = { x: 0, y: 0.5 }
            to = { x: 1, y: 0.5 }
        } else if (180 == deg) {
            from = { x: 0.5, y: 0 }
            to = { x: 0.5, y: 1 }
        } else if (270 == deg) {
            from = { x: 1, y: 0.5 }
            to = { x: 0, y: 0.5 }
        } else {
            var srcDeg = deg
            if (deg <= 45) deg = deg
            else if (deg < 90) deg = 90 - deg
            else if (deg <= 135) deg = deg - 90
            else if (deg < 180) deg = deg - 135
            else if (deg <= 225) deg = deg - 180
            else if (deg < 270) deg = 270 - deg
            else if (deg <= 315) deg = 315 - deg
            else if (deg < 360) deg = 360 - deg


            var lenB = Math.tan(degToRad(deg)) * lenA
            lenB = Math.round(lenB * 100) / 100
            var lenC = lenA / Math.cos(degToRad(deg))
            lenC = Math.round(lenC * 100) / 100

            // fixed X
            if ((srcDeg > 45 && srcDeg <= 135)) {
                from.x = 0
                to.x = 1
            }
            if ((srcDeg > 225 && srcDeg < 315)) {
                from.x = 1
                to.x = 0
            }
            // fixed y
            if ((srcDeg > 0 && srcDeg <= 45) || (srcDeg > 270 && srcDeg <= 360)) {
                from.y = 1
                to.y = 0
            }
            if (srcDeg > 135 && srcDeg <= 225) {
                from.y = 0
                to.y = 1
            }
            // float x
            if ((srcDeg > 0 && srcDeg <= 45)) {
                from.x = lenA - lenB
                to.x = lenA + lenB
            } else if (srcDeg > 135 && srcDeg < 180) {
                from.x = lenB
                to.x = lenA * 2 - lenB
            } else if ((srcDeg > 180 && srcDeg <= 225) || (srcDeg > 315 && srcDeg < 360)) {
                from.x = lenA + lenB
                to.x = lenA - lenB
            }
            // float y
            if ((srcDeg > 45 && srcDeg <= 90) || (srcDeg > 270 && srcDeg <= 315)) {
                from.y = lenA * 2 - lenB
                to.y = lenB
            } else if ((srcDeg > 90 && srcDeg <= 135) || srcDeg > 225 && srcDeg < 270) {
                from.y = lenA - lenB
                to.y = lenA + lenB
            }
        }

        fill.gradient.to = to
        fill.gradient.from = from

        aValues.forEach(function (sColor, index) {
            fill.gradient.stops.push({
                color: Utils.strToHEXColor(sColor),
                position: index * delta
            })
        })

        sStyle.fills = [fill]

    }

    _applyFillGradientProcessColor(rule, sStyle, colorType) {
        const token = rule.props
        var color = token['fill-' + colorType + '-color']
        var opacity = token['fill-' + colorType + '-color-opacity']

        if ('transparent' == color) {
            var opacity = "0%"
            color = "#FFFFFF" + Utils.opacityToHex(opacity)
        } else {
            if (undefined != opacity) color = color + Utils.opacityToHex(opacity)
        }
        return color
    }

    _applyShadow(rule, sStyle, shadowPropName) {
        var shadows = null

        var shadowCSS = rule.props[shadowPropName]

        if (shadowCSS != null && shadowCSS != "" && shadowCSS != "none") {
            shadows = Utils.splitCSSShadows(shadowCSS)
        } else {
        }

        if (!shadows || !shadows.length) {
            return false
        }

        let reset = !this.sAppliedStyles[rule.name]
        let resetInset = true


        shadows.forEach(function (shadow) {
            if (shadow.inset) {
                if (resetInset || null == sStyle.innerShadows) {
                    sStyle.innerShadows = [shadow]
                    resetInset = false
                } else
                    sStyle.innerShadows.push(shadow)
            } else {
                if (reset || null == sStyle.shadows) {
                    sStyle.shadows = [shadow]
                    reset = false
                } else
                    sStyle.shadows.push(shadow)
            }
        })
    }

    _applyShapeRadius(rule, sSharedStyle, sStyle) {
        const token = rule.props

        if (null == sSharedStyle && null == rule.sLayer) return true

        var radius = token['border-radius']
        const layers = rule.sLayer ? [rule.sLayer] : sSharedStyle.getAllInstancesLayers()

        for (var l of layers) {
            if (radius != "") {
                const radiusList = radius.split(' ').map(value => parseFloat(value.replace("px", "")))
                if (undefined == l.points) {
                    this.logMsg('_applyShapeRadius: ' + l.name)
                    l = l.layers[0]
                }
                l.points.forEach(function (point, index) {
                    point.cornerRadius = radiusList.length > 1 ? radiusList[index] : radiusList[0]
                })
            }
            //this._addTokenToSymbol(token,l)
        }

        return true
    }

    _applyBorderStyle(rule, sStyle) {
        const token = rule.props
        const borderWidth = token['border-width']
        const borderColor = token['border-color']
        const borderStyle = token['border-style']
        const borderLineEnd = token['border-line-end']
        const borderLineJoin = token['border-line-join']
        const borderStartArrowhead = token['border-start-arrowhead']
        const borderEndArrowhead = token['border-end-arrowhead']

        var border = {}

        // process color
        if (null != borderColor) {
            var color = borderColor
            var opacity = token['border-color-opacity']
            if (null != opacity) color = color + Utils.opacityToHex(opacity)
            border.color = Utils.strToHEXColor(color)
        }

        // process position
        if ('border-position' in token) {
            var conversion = {
                'center': Style.BorderPosition.Center,
                'inside': Style.BorderPosition.Inside,
                'outside': Style.BorderPosition.Outside
            }
            if (!(token['border-position'] in conversion)) {
                return this.logError('Wrong border-position')
            }

            const pos = token['border-position']
            border.position = conversion[pos]
        }

        // process width
        if (null != borderWidth) {
            border.thickness = borderWidth.replace("px", "")
        }

        // process border-style
        if (null != borderStyle) {
            if (undefined == sStyle.borderOptions) sStyle.borderOptions = {}
            const width = borderWidth != null ? borderWidth.replace("px", "") : 1
            if ("dashed" == borderStyle) {
                sStyle.borderOptions.dashPattern = [3 * width, 3 * width]
            } else if ("dotted" == borderStyle) {
                sStyle.borderOptions.dashPattern = [1 * width, 1 * width]
            }
        }

        if (null != borderLineEnd) {
            if (undefined == sStyle.borderOptions) sStyle.borderOptions = {}
            if (!(borderLineEnd) in bordedLineEndMap) {
                return this.logError('Wrong border-line-end value: ' + borderLineEnd)
            }
            sStyle.borderOptions.lineEnd = bordedLineEndMap[borderLineEnd]
        }
        if (null != borderLineJoin) {
            if (undefined == sStyle.borderOptions) sStyle.borderOptions = {}
            if (!(borderLineJoin) in bordedLineJoinMap) {
                return this.logError('Wrong border-line-join value: ' + borderLineJoin)
            }
            sStyle.borderOptions.lineJoin = bordedLineEndMap[borderLineJoin]
        }
        if (null != borderStartArrowhead) {
            if (undefined == sStyle.borderOptions) sStyle.borderOptions = {}
            if (!(borderStartArrowhead) in bordedArrowheadMap) {
                return this.logError('Wrong border-start-arrowhead value: ' + borderStartArrowhead)
            }
            sStyle.borderOptions.startArrowhead = bordedArrowheadMap[borderStartArrowhead]
        }
        if (null != borderEndArrowhead) {
            if (undefined == sStyle.borderOptions) sStyle.borderOptions = {}
            if (!(borderEndArrowhead) in bordedArrowheadMap) {
                return this.logError('Wrong border-end-arrowhead value: ' + borderEndArrowhead)
            }
            sStyle.borderOptions.endArrowhead = bordedArrowheadMap[borderEndArrowhead]
        }


        // save new border in style                
        if (Object.keys(border) == 0 || !(border && (borderColor == null || borderColor != 'none') && (borderWidth == null || borderWidth != '0px'))) {
            border = null
        }

        if (this.sAppliedStyles[rule.name] != undefined && sStyle.borders != null) {
            // already added border, now add one more
            if (border) {
                sStyle.borders.push(border)
            }
        } else {
            // drop existing borders
            sStyle.borders = border ? [border] : []
        }
    }

    _getObjTextData(obj) {
        var orgTextStyle = sLayer.style.sketchObject.textStyle()
        const textAttribs = orgTextStyle.attributes()

        const textTransformAttribute = textAttribs.MSAttributedStringTextTransformAttribute
        const colorAttr = textAttribs.NSColor
        const kernAttr = textAttribs.NSKern

        var attributes = {
            'NSFont': textAttribs.NSFont.copy(),
            'NSParagraphStyle': textAttribs.NSParagraphStyle.copy()
        };
        if (colorAttr)
            attributes['NSColor'] = colorAttr.copy()
        if (textTransformAttribute)
            attributes['MSAttributedStringTextTransformAttribute'] = textTransformAttribute.copy()
        if (kernAttr)
            attributes['NSKern'] = kernAttr.copy()

        return {
            'attributes': attributes,
            'orgTextStyle': orgTextStyle
        }
    }

    _setTextStyleParagraph(sStyle, value) {
        sStyle.paragraphSpacing = value
        sStyle.lineHeight = sStyle.lineHeight
    }

    ////////////////////////////////////////////////////////////////////////////

    _applyRuleToLayerStyle(rule, sSharedStyle, sStyle) {
        const token = rule.props
        // SET COLOR
        var backColor = token['background-color']
        if (backColor != null) {
            if (backColor.indexOf("gradient") > 0) {
                this._applyFillGradient(rule, sStyle, backColor)
            } else if (backColor != "" && backColor != "none") {
                backColor = Utils.strToHEXColor(backColor, token['opacity'])
                var fill = {
                    color: backColor,
                    fill: Style.FillType.Color
                }
                sStyle.fills = [fill]
            } else {
                sStyle.fills = []
            }
        }

        if ("single_opacity" == rule.type) {
            sStyle.opacity = token['opacity']
        }

        // SET SHADOW 
        this._applyShadow(rule, sStyle, 'box-shadow')

        // SET MARGINS
        this._applyMargins(rule, sSharedStyle)

        // SET BORDER       
        if (('border-color' in token) || ('border-width' in token) || ('border-position' in token))
            this._applyBorderStyle(rule, sStyle)

        // SET BORDER RADIUS
        if ('border-radius' in token)
            this._applyShapeRadius(rule, sSharedStyle, sStyle)

        // SET PADDING
        const paddingSrc = token['padding']
        if (null != paddingSrc) {
            this._applyPaddingToLayer(rule, paddingSrc)
        }

    }

    _applyPaddingToLayer(rule, paddingSrc) {

        let paddingValues = paddingSrc.spit(" ")

        let ptop = 10
        let pleft = 10
        let pbottom = 10
        let pright = 10

        const sCurrLayer = rule.sLayer
        const sParent = sCurrLayer.parent
        const parentFrame = new Rectangle(sParent.frame)

        sParent.layers.forEach(function (sLayer) {
            if (sLayer.id == sCurrLayer.id) return
            sLayer.frame.x = pleft
            sLayer.frame.y = ptop
            sLayer.frame.height = parentFrame.height - ptop - pbottom
            sLayer.frame.width = parentFrame.width - pleft - pright
        }, this)
    }



    _applyRuleToTextStyle(rule, sSharedStyle, sStyle) {
        const token = rule.props

        // read token attribues
        var fontSize = token['font-size']
        var fontFace = token['font-family']
        var fontStyle = token['font-style']
        var color = token['color']
        var fontWeight = token['font-weight']
        var transform = token['text-transform']
        var letterSpacing = token['letter-spacing']
        var decoration = token['text-decoration']
        var lineHeight = token['line-height']
        var align = token['text-align']
        var verticalAlign = token['vertical-align']
        var text = token[PT_TEXT]
        var paragraphSpacing = token["pt-paragraph-spacing"]

        // SET LAYER TEXT 
        if (undefined != text && rule.sLayer) {
            const layerName = rule.sLayer.name
            rule.sLayer.text = text
            rule.sLayer.name = layerName
        }

        //// SET FONT SIZE
        if (undefined != fontSize) {
            sStyle.fontSize = parseFloat(fontSize.replace("px", ""))

            // If applied font size at first time then drop line-height
            if (!this.sAppliedStyles[rule.name]) {
                sStyle.lineHeight = null
            }
        }
        //// SET LINE HEIGHT
        if (undefined != lineHeight) {
            if (0 == lineHeight) {
                sStyle.lineHeight = null
            } else if (lineHeight.indexOf("px") > 0) {
                sStyle.lineHeight = lineHeight.replace("px", "")
            } else {
                if (null == sStyle.fontSize) {
                    return this.logError("Can not apply line-height without font-size for rule " + rule.name)
                }
                sStyle.lineHeight = Math.round(parseFloat(lineHeight) * sStyle.fontSize)
            }
        }

        if (undefined != paragraphSpacing) {
            this._setTextStyleParagraph(sStyle, parseFloat(paragraphSpacing))
        }

        if (sStyle.fontVariant != "") sStyle.fontVariant = ""
        if (sStyle.fontStretch != "") sStyle.fontStretch = ""

        //// SET FONT FACE
        if (undefined != fontFace) {
            let firstFont = fontFace.split(',')[0]
            firstFont = firstFont.replace(/[""]/gi, '')
            sStyle.fontFamily = firstFont
        }
        //// SET FONT STYLE
        if (undefined != fontStyle) {
            sStyle.fontStyle = fontStyle
        } else {
            sStyle.fontStyle = ""
        }
        if (undefined != align) {
            if (!(align in alignMap)) {
                return this.logError("Wrong align '" + align + "' for rule " + rule.name)
            }
            sStyle.alignment = alignMap[align]
        }
        if (undefined != verticalAlign) {
            if (!(verticalAlign in vertAlignMap)) {
                return this.logError("Wrong vertical-align' '" + verticalAlign + "' for rule " + rule.name)
            }
            sStyle.verticalAlignment = vertAlignMap[verticalAlign]
        }

        //// SET FONT WEIGHT
        if (undefined != fontWeight) {
            var weightKey = "label"

            // for numeric weight we support it uses css format
            if (!isNaN(fontWeight)) {
                weightKey = 'css'
                fontWeight = fontWeight * 1
            }

            var finalWeight = undefined
            for (var w of weights) {
                if (w[weightKey] == fontWeight) {
                    finalWeight = w.sketch
                    break
                }
            }
            if (undefined == finalWeight) {
                return this.logError('Wrong font weigh for rule ' + rule.name)
            }

            sStyle.fontWeight = finalWeight
        }

        // SET TEXT COLOR
        if (undefined != color) {
            let opacity = token['opacity']
            let opacityHEX = undefined != opacity ? Utils.opacityToHex(opacity) : ''

            sStyle.textColor = Utils.strToHEXColor(color + opacityHEX)
        }
        // SET TEXT TRANSFORM
        if (undefined != transform) {
            sStyle.textTransform = transform
        }
        // SET TEXT letterSpacing
        if (undefined != letterSpacing) {
            const spacing = letterSpacing.replace("px", "")
            if ("normal" == spacing) {
                sStyle.kerning = null
            } else if (!isNaN(spacing)) {
                sStyle.kerning = spacing * 1
            } else {
                this.logError("Wrong '" + letterSpacing + "' value for letter-spacing")
            }
        }

        // SET TEXT DECORATION
        if (undefined != decoration) {
            if ("underline" == decoration) {
                sStyle.textUnderline = "single"
                sStyle.textStrikethrough = undefined
            } else if ("line-through" == decoration) {
                sStyle.textUnderline = undefined
                sStyle.textStrikethrough = "single"
            }
        }

        // SET TEXT SHADOW
        this._applyShadow(rule, sStyle, "text-shadow")

        // SET MARGINS
        this._applyMargins(rule, sSharedStyle)
    }

    _applyMargins(rule, sSharedStyle) {
        const token = rule.props

        var marginTop = token['margin-top']
        var marginLeft = token['margin-left']
        var height = token['height']
        var width = token['width']

        if (null == marginTop && null == marginLeft && null == height && null == width) return true
        if (null == sSharedStyle && null == rule.sLayer) return true

        const layers = rule.sLayer ? [rule.sLayer] : sSharedStyle.getAllInstancesLayers()


        for (var l of layers) {
            let parentFrame = l.parent.frame
            if (null != marginTop) {
                l.frame.y = parseInt(marginTop.replace('px', ""))
            }
            if (null != marginLeft) {
                l.frame.x = parseInt(marginLeft.replace('px', ""))
            }
            if (null != height) {
                l.frame.height = parseInt(height.replace('px', ""))
            }
            if (null != width) {
                l.frame.width = parseInt(width.replace('px', ""))
            }
        }

        return true
    }

    _applyOpacityToLayer(rule) {
        const token = rule.props
        const sLayer = rule.sLayer
        const opacity = token['opacity']

        rule.sLayer.style.opacity = opacity

    }



    _applyPropsToImage(rule) {
        const token = rule.props
        const imageName = token['image']
        var sLayer = rule.sLayer


        if (imageName != "") {
            if ('transparent' == imageName) {
                sLayer.style.opacity = 0
            } else {
                let path = this.pathToTokens + "/" + imageName

                var fileManager = [NSFileManager defaultManager];
                if (![fileManager fileExistsAtPath: path]) {
                    return this.logError('Image not found on path: ' + path)
                }

                // create new image
                let parent = sLayer.parent
                let frame = new Rectangle(sLayer.frame)
                let oldConstraints = sLayer.sketchObject.resizingConstraint()

                let sNewImage = new Image({
                    frame: frame,
                    name: sLayer.name,
                    image: path
                })
                var sStyle = sNewImage.style
                this._resetStyle(sStyle, false)

                // remove old image
                sLayer.remove()
                sLayer = null
                parent.layers.push(sNewImage)

                // calculage new frame
                var newWidth = null
                var newHeight = null
                var rawImageSize = sNewImage.image.nsimage.size()

                if (null != token.width) {
                    const width = parseInt(token.width.replace(/([px|\%])/, ""), 10)
                    if (token.width.indexOf("px") > 0) {
                        newWidth = width
                    } if (token.width.indexOf("%") > 0) {
                        newWidth = Math.floor(rawImageSize.width / 100 * width)
                    } else {
                    }
                }
                if (null != token.height) {
                    const height = parseInt(token.height.replace(/([px|\%])/, ""), 10)
                    if (token.height.indexOf("px") > 0) {
                        newHeight = height
                    } if (token.height.indexOf("%") > 0) {
                        newHeight = Math.floor(rawImageSize.height / 100 * height)
                    } else {
                    }
                }

                if (null != newWidth && null != newHeight) {
                } else if (null != newWidth) {
                    newHeight = rawImageSize.height * (newWidth / rawImageSize.width)
                } else if (null != newHeight) {
                    newWidth = rawImageSize.width * (newHeight / rawImageSize.height)
                } else {
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

                if (null != newTop && null != newBottom) {
                    sNewImage.frame.y = parseInt(newTop.replace('px', ""))
                    sNewImage.frame.height = (parent.frame.height - parseInt(newBottom.replace('px', ""))) - sNewImage.frame.y
                } else if (null != newTop) {
                    sNewImage.frame.y = parseInt(newTop.replace('px', ""))
                } else if (null != newBottom) {
                    sNewImage.frame.y = parent.frame.height - parseInt(newBottom.replace('px', "")) - sNewImage.frame.height
                }
                if (null != newLeft && null != newRight) {
                    sNewImage.frame.x = parseInt(newLeft.replace('px', ""))
                    sNewImage.frame.width = (parent.frame.width - parseInt(newRight.replace('px', ""))) - sNewImage.frame.x
                } else if (null != newLeft) {
                    sNewImage.frame.x = parseInt(newLeft.replace('px', ""))
                } else if (null != newRight) {
                    sNewImage.frame.x = parent.frame.width - parseInt(newRight.replace('px', "")) - sNewImage.frame.width
                }

                sNewImage.sketchObject.resizingConstraint = oldConstraints

                // apply additional styles
                this._applyShadow(rule, sStyle, 'box-shadow')
                //this._applyMargins(rule, null)
                this._applyBorderStyle(rule, sStyle)

            }
        }

        return true
    }


}
