@import("constants.js")
@import("lib/utils.js")
@import("lib/uidialog.js")
@import("lib/ga.js")
@import("lib/gradient-parser/parser.js")
@import("classes/DSLayerCollector.js")

var app = undefined


const LAYER_PROPS = ["background-color", "border-color", "box-shadow", "border-radius", "border-position"]

function cleanName(n)
{
    if (n.startsWith('"')) n = n.slice(1)
    if (n.endsWith('"')) n = n.slice(0, -1)
    return n.replace(/^[\.#]/, '').replace(/(_{2})/g, ' ').replace(/(-DOT-)/g, '.').replace(/(--PT-)/g, '')

}

function stripQuotes(str)
{
    if (str.startsWith('"') || str.startsWith("'")) str = str.slice(1);
    if (str.endsWith('"') || str.endsWith("'")) str = str.slice(0, -1);
    return str;
}

class DSApp
{
    constructor(context)
    {
        if (context.fromCmd)
        {
            this.fromCmd = true
            this.nDoc = context.nDoc
            this.sDoc = context.sDoc
        } else
        {
            this.nDoc = context.document
            this.sDoc = Sketch.fromNative(context.document)
        }
        this.context = context
        this.UI = require('sketch/ui')
        this.isQuick = false

        this.pathToVars = ""

        this.elements = {
            styles: {},
            colors__: {},
            attrs: {}
        }
        this.textStyles = {}
        this.layerStyles = {}
        this.appliedStyles = {
            true: {},
            false: {}
        }

        this._symbolPage = undefined

        this.rules = undefined

        this.result = {
            createdColors: 0,
            updatedColors: 0,
            createdStyles: 0,
            updatedStyles: 0,
            assignedStyles: 0,
            updatedLayers: 0,
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

        this.pathToTokens = Settings.settingForKey(SettingKeys.PLUGIN_PATH_TO_TOKENS)
        this.pathToTokens = this.pathToTokens || this.pathToStyles
        this.pathToTokensList = Settings.settingForKey(SettingKeys.PLUGIN_PATH_TO_TOKENS_LIST)
        this.pathToTokensList = this.pathToTokensList || []
        if (this.pathToTokensList.length == 0 && this.pathToTokens != '') this.pathToTokensList.push(this.pathToStyles)

        this.pathToDoc = ""
        this.pathToAssets = ""

        this.genSymbTokens = Settings.settingForKey(SettingKeys.PLUGIN_GENERATE_SYMBOLTOKENS) === true
        this.showDebug = Settings.settingForKey(SettingKeys.PLUGIN_SHOW_JSON) === true
        this.showDoubleStyleError = Settings.settingForKey(SettingKeys.PLUGIN_SHOW_DOUBLESTYLES) === true
        this.ignoreMissed = Settings.settingForKey(SettingKeys.PLUGIN_APPLY_IGNORE_MISSED) === true
        this.skipPos = Settings.settingForKey(SettingKeys.PLUGIN_APPLY_SKIP_SIZES) === true
        this.confClear = Settings.settingForKey(SettingKeys.PLUGIN_APPLY_CLEAR) === true
        this.onlyUpdateStyles = false
    }

    init()
    {
        this.pathToSource = this.onlyUpdateStyles ? this.pathToTokens : this.pathToStyles
        this._initStyles()
    }

    // Tools

    logMsg(msg)
    {
        if (DEBUG) log(msg)
        if (!this.isQuick) this.messages += msg + "\n"
    }

    logDebug(msg)
    {
        log(msg)
    }

    logError(error)
    {
        this.logMsg("[ ERROR ] " + error)
        this.errors.push(error)
        return false
    }


    stopWithError(error)
    {
        const UI = require('sketch/ui')
        UI.alert('Error', error)
        //exit = true        
    }

    // Public methods


    runFromCmd(pathToSource)
    {
        this.runFromCmd = true
        this.pathToSource = pathToSource
        if ('' == this.pathToSource) return false
        this.init()
        const success = this.run(false)
        //UI.message(this._getResultSummary())        
        return success
    }

    runQuick()
    {
        this.isQuick = true
        if ('' == this.pathToSource) return this.runDialog()
        const success = this.run()

        UI.message(this._getResultSummary())

        return success
    }

    runDialog()
    {
        const pathToSource = (this.onlyUpdateStyles && this._askPathToSourceOnlyUpdate()) || (!this.onlyUpdateStyles && this._askPathToSourceStyle())
        if (pathToSource === false) return false
        this.pathToSource = pathToSource

        const success = this.run()
        if (success)
        {
            this._showMessages()
        }
        return success
    }

    run()
    {
        this.pathToSourceFolder = this.pathToSource.substring(0, this.pathToSource.lastIndexOf("/"))

        Settings.setSettingForKey(SettingKeys.PLUGIN_LAST_ONLY_UPDATE, this.onlyUpdateStyles)

        if (this.genSymbTokens)
        {
            if (!this.sDoc.path)
            {
                return this.stopWithError("Can't create symbols & style file for unsaved Sketch file. Save it before or disable symbols & style generation in Settings.")
            } else if (this.nDoc.isCloudDoc())
            {
                return this.stopWithError("Can't create symbols & style file for Cloud file. Move it to local or disable symbols & style generation in Settings.")
            } else
            {
                const pathDetails = path.parse(this.sDoc.path)
                const dir = decodeURI(pathDetails.dir)
                this.pathToDoc = dir + "/" + pathDetails.name
                this.pathToAssets = dir + "/" + Constants.ASSETS_FOLDER_PREFIX + "/" + pathDetails.name
                if (!Utils.createFolder(this.pathToAssets))
                {
                    return this.stopWithError("Can't create '" + this.pathToAssets + "' folder to store symbols & style information. Save the document in some other place before or disable symbols & style generation in Settings.")
                }
            }
        }

        var applied = false
        while (true)
        {
            this.logMsg("run(): loadRules")
            if (!this.loadRules())
            {
                this.logMsg("run(): loadRules: failed")
                break
            }
            this.logMsg("run(): loadRules: success")
            //
            if (this.onlyUpdateStyles)
            {
                this._onlyUpdateStyles()
            } else
            {
                if (!this._applyRules()) break
                if (this.genSymbTokens)
                {
                    this._saveElements()
                }
            }

            applied = true
            this.logMsg("Finished")
            break
        }

        this.nDoc.reloadInspector();

        // show final message
        if (this.errors.length > 0)
        {
            this._showErrors()
            return false
        }

        return applied
    }

    // Internal

    _initStyles()
    {
        if (DEBUG) this.logDebug("_initStyles")

        const showError = Settings.PLUGIN_SHOW_DOUBLESTYLES

        this.textStyles = {}
        this.sDoc.sharedTextStyles.filter(s => null == s.getLibrary()).forEach(function (sStyle)
        {
            if (this.showDoubleStyleError && sStyle.name in this.textStyles)
            {
                this.logError("Found multiply text styles with name '" + sStyle.name + "'")
            }
            if (DEBUG) this.logDebug("Load text style " + sStyle.name)
            this.textStyles[sStyle.name] = sStyle
        }, this)
        this.layerStyles = {}
        this.sDoc.sharedLayerStyles.filter(s => null == s.getLibrary()).forEach(function (sStyle)
        {
            if (this.showDoubleStyleError && sStyle.name in this.layerStyles)
            {
                this.logError("Found multiply layer styles with name '" + sStyle.name + "'")
            }
            if (DEBUG) this.logDebug("Load layer style " + sStyle.name)
            this.layerStyles[sStyle.name] = sStyle

        }, this)
    }

    // return Sketch native object
    _findStyleByName(styleName, isLayerStyle)
    {
        if (DEBUG) this.logDebug("_findStyleByName running...  styleName:" + styleName)

        const localStyle = !isLayerStyle ? this.textStyles[styleName] : this.layerStyles[styleName]
        if (localStyle) return localStyle

        // find Sketch library and style
        var sStyle = null
        var lib = null
        for (lib of this._getLibraries())
        {
            if (DEBUG) this.logDebug("_findStyleByName for lib " + lib.sLib.name)
            sStyle = this._findStyleByNameInLibrary(styleName, isLayerStyle, lib)
            if (sStyle) break
        }
        // check style existing
        if (!sStyle)
        {
            if (DEBUG) this.logDebug("_findStyleByName FAILED")
            return false
        }
        return sStyle
    }

    _findStyleByNameInLibrary(styleName, isLayerStyle, jsLib)
    {
        let sFoundStyle = undefined
        const sStyleRefs = isLayerStyle ?
            jsLib.sLib.getImportableLayerStyleReferencesForDocument(this.sDoc) :
            jsLib.sLib.getImportableTextStyleReferencesForDocument(this.sDoc)

        sStyleRefs.forEach(function (sStyleRef)
        {
            if (sStyleRef.name == styleName)
            {
                sFoundStyle = sStyleRef.import()
                return
            }
        }, this)
        return sFoundStyle
    }

    _getLibraries()
    {
        if (undefined != this.jsLibs) return this.jsLibs

        if (DEBUG) this.logDebug("_getLibraries: start")
        this.jsLibs = []

        var sLibraries = require('sketch/dom').getLibraries()
        for (const sLib of sLibraries)
        {
            if (!sLib.valid || !sLib.enabled) continue
            if (DEBUG) this.logDebug("_getLibraries: try to load document for library " + sLib.name + "")

            const sDoc = sLib.getDocument()
            if (!sDoc)
            {
                if (DEBUG) this.logDebug("_getLibraries: can't load document for library " + sDoc.path + "")
                continue
            }
            this.jsLibs.push({
                sLib: sLib,
                sDoc: sDoc
            })
        }
        if (DEBUG) this.logDebug("_getLibraries: finish")
        return this.jsLibs
    }

    _getResultSummary()
    {
        var msg = ""
        if (this.result.createdColors) msg += "Created " + this.result.createdColors + " color(s). "
        if (this.result.updatedColors) msg += "Updated " + this.result.updatedColors + " color(s). "
        if (this.result.createdStyles) msg += "Created " + this.result.createdStyles + " style(s). "
        if (this.result.updatedStyles) msg += "Updated " + this.result.updatedStyles + " style(s). "
        if (this.result.assignedStyles) msg += "Assigned " + this.result.assignedStyles + " style(s). "
        if (this.result.updatedLayers) msg += "Updated " + this.result.updatedLayers + " layer(s). "
        if ("" == msg) msg = "No any styles applied or assigned "


        track(TRACK_APPLY_COMPLETED, {
            "num_cs": this.result.createdStyles,
            "num_us": this.result.updatedStyles,
            "num_l": this.result.updatedLayers,
            "quick": this.isQuick ? "yes" : "no"
        })
        track(this.isLess ? TRACK_APPLY_COMPLETED_LESS : TRACK_APPLY_COMPLETED_SCSS)

        return msg
    }


    _showMessages()
    {
        const dialog = new UIDialog("Styles have been successfully applied", NSMakeRect(0, 0, 800, 400), "Dismiss", "", "")
        dialog.removeLeftColumn()
        dialog.addTextViewBox("messages", "See what has been changed:", this._getResultSummary() + "\n------------------\n" + this.messages, 400)
        const result = dialog.run()
        dialog.finish()
    }

    _showDebug(rulesJSONStr)
    {
        const dialog = new UIDialog("Debug Information", NSMakeRect(0, 0, 600, 600), "Ok", "", "")
        dialog.removeLeftColumn()

        dialog.addTextViewBox("debug", "Convertor output", this.convertorOuput, rulesJSONStr != null ? 250 : 600)

        if (rulesJSONStr != null)
        {
            dialog.addTextViewBox("debug", "Intermediate JSON", rulesJSONStr, 250)
        }
        const result = dialog.run()
        dialog.finish()
    }

    _showErrors()
    {
        var errorsText = this.errors.join("\n\n")

        if (this.fromCmd)
        {

        } else
        {
            const dialog = new UIDialog("Found errors", NSMakeRect(0, 0, 600, 600), "Who cares!", "", "")
            dialog.removeLeftColumn()
            dialog.addTextViewBox("debug", "", errorsText, 600)
            const result = dialog.run()
            dialog.finish()
        }
    }

    _saveElements()
    {
        const pathToRules = this.pathToAssets + "/" + Constants.SYMBOLTOKENFILE_POSTFIX
        const json = JSON.stringify(this.elements, null, null)
        if (DEBUG)
            this.logDebug("Save elements info into: " + pathToRules)
        else
            this.logMsg("Save elements info")
        Utils.writeToFile(json, pathToRules)
        ///

    }

    _askPathToSourceStyle()
    {
        const dialogLabel = "Load LESS or SASS file with style definions and create new Sketch styles (or update existing)."
        const dialog = new UIDialog("Apply LESS/SASS styles", NSMakeRect(0, 0, 600, 100), "Apply", dialogLabel)
        dialog.removeLeftColumn()

        this.pathToStylesList = this.pathToStylesList.slice(0, 20)

        dialog.addPathInput({
            id: "pathToStyles",
            label: "Style File",
            labelSelect: "Select",
            textValue: this.pathToStyles,
            inlineHint: 'e.g. /Work/ui-tokens.less',
            width: 580,
            askFilePath: true,
            comboBoxOptions: this.pathToStylesList
        })


        track(TRACK_APPLY_DIALOG_SHOWN)
        while (true)
        {
            const result = dialog.run()
            if (!result)
            {
                track(TRACK_APPLY_DIALOG_CLOSED, { "cmd": "cancel" })
                return false
            }

            this.pathToStyles = dialog.views['pathToStyles'].stringValue() + ""
            if ("" == this.pathToStyles) continue
            ////
            const pathIndex = this.pathToStylesList.indexOf(this.pathToStyles)
            if (pathIndex < 0)
            {
                this.pathToStylesList.splice(0, 0, this.pathToStyles)
            } else
            {
                this.pathToStylesList.splice(pathIndex, 1)
                this.pathToStylesList.splice(0, 0, this.pathToStyles)
            }
            this.pathToStylesList = this.pathToStylesList.slice(0, 20)

            ///
            break
        }
        dialog.finish()
        track(TRACK_APPLY_DIALOG_CLOSED, { "cmd": "ok" })

        Settings.setSettingForKey(SettingKeys.PLUGIN_PATH_TO_TOKENS_LESS_LIST, this.pathToStylesList)
        Settings.setSettingForKey(SettingKeys.PLUGIN_PATH_TO_TOKENS_LESS, this.pathToStyles)

        return this.pathToStyles
    }


    _askPathToSourceOnlyUpdate()
    {
        const dialogLabel = "Load LESS or SASS file with design tokens and update related styles"
        const dialog = new UIDialog("Apply design tokens", NSMakeRect(0, 0, 600, 100), "Apply", dialogLabel)
        dialog.removeLeftColumn()

        this.pathToTokensList = this.pathToTokensList.slice(0, 20)

        dialog.addPathInput({
            id: "pathToTokens",
            label: "Style File",
            labelSelect: "Select",
            textValue: this.pathToTokens,
            inlineHint: 'e.g. /Work/ui-tokens.less',
            width: 580,
            askFilePath: true,
            comboBoxOptions: this.pathToTokensList
        })


        track(TRACK_APPLY_DIALOG_SHOWN)
        while (true)
        {
            const result = dialog.run()
            if (!result)
            {
                track(TRACK_APPLY_DIALOG_CLOSED, { "cmd": "cancel" })
                return false
            }

            this.pathToTokens = dialog.views['pathToTokens'].stringValue() + ""
            if ("" == this.pathToTokens) continue
            ////
            const pathIndex = this.pathToTokensList.indexOf(this.pathToTokens)
            if (pathIndex < 0)
            {
                this.pathToTokensList.splice(0, 0, this.pathToTokens)
            } else
            {
                this.pathToTokensList.splice(pathIndex, 1)
                this.pathToTokensList.splice(0, 0, this.pathToTokens)
            }
            this.pathToTokensList = this.pathToTokensList.slice(0, 20)

            ///
            break
        }
        dialog.finish()
        track(TRACK_APPLY_DIALOG_CLOSED, { "cmd": "ok" })

        Settings.setSettingForKey(SettingKeys.PLUGIN_PATH_TO_TOKENS_LIST, this.pathToTokensList)
        Settings.setSettingForKey(SettingKeys.PLUGIN_PATH_TO_TOKENS, this.pathToTokens)

        return this.pathToTokens
    }

    ////////////////////////////////////////////////////////////////

    _isStylePropExisting(props)
    {
        let styles = Object.keys(props).filter(name => !(name.startsWith("@") || name.startsWith("__")))
        return styles.length > 0
    }

    _transformRulePath(pathString)
    {
        var pathArray = pathString.split("*")
        // Convert [ '#Symbol', '1', '.Back' ] to [ '#Symbol 1', '.Back' ],
        if (pathArray.filter(s => !(s.startsWith(".") || s.startsWith("#"))))
        {
            let path = pathArray.map(function (s, index, arr)
            {
                if (!(s.startsWith(".") || s.startsWith("#"))) return ""
                let i = index + 1
                while (arr[i] != null && !(arr[i].startsWith("#") || arr[i].startsWith(".")))
                {
                    s += " " + arr[i]
                    i++
                }
                return s
            }).filter(s => s != "")
            pathArray = path
        }
        return pathArray;
    }

    _onlyUpdateStyles()
    {
        this.logMsg("_onlyUpdateStyles: started")
        /// Load inspector.json and vars.json files generated by loadRules()
        const inspector = this._onlyUpdateStyles_loadJSON(Constants.SYMBOLTOKENFILE_POSTFIX)
        const vars = this._onlyUpdateStyles_loadJSON(Constants.VARSFILE_POSTFIX)
        if (inspector === null || vars === null) return this.logError("_onlyUpdateStyles: failed")
        /// Iterate styles to update the Sketch styles
        for (const styleName in inspector.styles)
        {
            this.logDebug(`Update ${styleName}`)
            //if (styleName !== "_atoms/form/switch/large-on-back") continue //debug   
            // Init rule
            const inspectorStyle = inspector.styles[styleName]
            const tokens = inspectorStyle.tokens
            const rule = {
                props: this._onlyUpdateStyles_tokensToProps(tokens),
                name: styleName
            }
            this._defineRuleType(rule)
            if (!rule.isText && !rule.isLayer) continue;

            // apply text tokens          
            if (rule.isText)
            {

                const textTokens = tokens.filter(t => t[0] == "color").slice(-1)
                textTokens.forEach(t =>
                {
                    // Find new value for style color token
                    const tokenName = t[1], tokenValue = vars[tokenName]
                    if (!tokenValue) return
                    // Find style by name
                    const sharedStyle = this._findStyleByName(styleName, false)
                    if (!sharedStyle) return this.logError(`Can't find style ${styleName}`)
                    // Update style color)
                    sharedStyle.style.textColor = Utils.strToHEXColor(tokenValue)
                    // 
                    sharedStyle.sketchObject.resetReferencingInstances()
                }, this)
            }
            // apply layer tokens
            if (rule.isLayer)
            {

                const layerTokenNames = ["background-color", "border-color"]
                const layerTokens = tokens.filter(t => layerTokenNames.includes(t[0]))

                // Find style by name
                const sharedStyle = this._findStyleByName(styleName, true)
                if (!sharedStyle) return this.logError(`Can't find style ${styleName}`)

                // drop existing (or new) style properties before first apply                
                if (!this.appliedStyles[rule.isText][styleName])
                {
                    this._resetStyle(rule, sharedStyle.style)
                    this.appliedStyles[rule.isLayer][styleName] = true
                }

                // Apply tokens     
                function processTokens(names)
                {
                    names.forEach(name =>
                    {
                        if (name.includes("*"))
                        {
                            const nameCleared = name.replace("*", "")
                            const maskNames = tokens.map(t => t[0]).filter(tokenName => tokenName.startsWith(nameCleared))
                            return processTokens(maskNames)
                        }
                        //
                        const res = tokens.filter(t => t[0] == name)
                        if (!res.length) return
                        const tokenName = res[res.length - 1][1]
                        if (!(tokenName in vars)) return
                        //
                        rule.props[name] = vars[tokenName]
                    })
                }
                processTokens(["background-color", "border-*"])
                // Apply static values
                if (inspectorStyle.static !== undefined) rule.props = Object.assign(rule.props, inspectorStyle.static)
                //
                this._applyRuleToLayerStyle(rule, sharedStyle, sharedStyle.style)
                sharedStyle.sketchObject.resetReferencingInstances()
            }
        }
        ///
        this.logMsg("_onlyUpdateStyles: completed")
        return true
    }

    _onlyUpdateStyles_tokensToProps(tokens)
    {
        const props = {}
        tokens.forEach(t =>
        {
            const n = t[0]
            props[n] = t[1]
        })
        return props
    }

    _onlyUpdateStyles_loadJSON(fileName)
    {
        const path = this.pathToAssets + "/" + fileName
        let json = Utils.readFile(path)
        let error = null
        try
        {
            return JSON.parse(json)
        } catch (e)
        {
            this.logError("loadRules: faled to parse " + path)
            this.logError(e)
            return null
        }
    }

    _applyRules(justCheck)
    {
        this.logMsg("Started")
        for (const rule of this.rules)
        {
            //////////////////////
            rule.path = this._transformRulePath(rule.path)
            //////////////////////
            const sStyleName = this._pathToStr(rule.path)
            rule.name = sStyleName
            rule.type = ""
            if (DEBUG) this.logDebug(rule.name)

            //////////////////////            
            if (PT_ATTR in rule.props)
            {
                this._saveRuleAsAttr(rule, sStyleName)
            }
            ///            

            // CHECK RULE TYPE
            if (rule.path[0].startsWith(SPACE_COLORS))
            {
                // will define color variable
                this._defineRuleTypeAsColor(rule)
            } else
            {
                if (rule.path[0].startsWith('#'))
                {
                    rule.isStandalone = true
                    rule.sLayer = this._findLayerByPath(rule.path)
                    if (null == rule.sLayer)
                    {
                        if (this.ignoreMissed || PT_SKIP_MISSED in rule.props || PT_ATTR in rule.props)
                        {
                            continue
                            /*} lse if (this.confCreateSymbols) {
                                this.messages += "Will create new symbol " + rule.path + " of " + ruleType + " type \n"
                                rule.sLayer = new SymbolMaster({
                                    name: rule.name,
                                })*/
                        } else
                        {
                            this.logError("Can't find symbol master by path " + rule.path)
                            continue
                        }
                    }
                } else { }
                this._defineRuleType(rule)
                if (DEBUG) this.logDebug(rule)
            }

            if (rule.isColor)
            {
                this._applyPropsToColor(rule.name, rule.props.color, rule)
            } else if (rule.isImage)
            {
                this._applyPropsToImage(rule)
            } else
            {

                // Find or create new style
                var sSharedStyle = null
                var sStyle = null

                if (rule.isStandalone)
                {
                    /*if (!rule.sLayer) {
                        if (PT_SKIP_MISSED in rule.props) {
                            continue;
                        }
                        rule.sLayer = this._findOrCreateSymbolMasterChild(rule)
                        if (!rule.sLayer) {
                            return this.logError("Can't find a symbol master layer by name " + rule.name)
                        }
                    }*/

                    // assign existing style
                    const sAttachToExistingStyle = this._getFindSharedStyleByRule(rule)
                    if (sAttachToExistingStyle)
                    {
                        const l = rule.sLayer
                        l.style = {}
                        l.sharedStyle = sAttachToExistingStyle
                        l.style.syncWithSharedStyle(sAttachToExistingStyle)
                        this.result.assignedStyles++
                    } else { }
                    //                
                    sStyle = rule.sLayer.style
                } else
                {
                    if (!rule.isText && !rule.isLayer)
                    {
                        if (!(PT_ATTR in rule.props)) this.logError("Uknown type of rule " + rule.name)
                        continue
                    }

                    sSharedStyle = rule.isText ? this.textStyles[sStyleName] : this.layerStyles[sStyleName]

                    sStyle = sSharedStyle != null ? sSharedStyle.style : {
                        styleType: rule.isText ? SharedStyle.StyleType.Text : SharedStyle.StyleType.Layer,
                        borders: []
                    }
                }

                // drop existing (or new) style properties before first apply                
                if ((rule.isText || rule.isLayer) &&
                    !this.appliedStyles[rule.isText][sStyleName] &&
                    !(rule.sLayer && rule.sLayer.sharedStyle && this.appliedStyles[rule.isText][rule.sLayer.sharedStyle.name])
                )
                {
                    this._resetStyle(rule, sStyle)
                    this.appliedStyles[rule.isText][sStyleName] = true
                }

                // Apply rule properties
                // drop commented property
                const validProps = Object.keys(rule.props).filter(n => n.indexOf("__") < 0)

                if (rule.isText)
                    this._applyRuleToTextStyle(rule, sSharedStyle, sStyle)
                else if (rule.isLayer)
                    this._applyRuleToLayerStyle(rule, sSharedStyle, sStyle)

                if (rule.isGroup)
                {
                    this._applyRuleToGroup(rule)
                }
                this.result.updatedLayers++
                // SET MARGINS
                this._applyCommonRules(rule, sSharedStyle, sStyle)


                if (rule.isStandalone)
                {
                    this.logMsg("[Updated] style for standalone layer " + sStyleName)
                    this._addTokenToSymbol(rule.props, rule.sLayer)
                } else
                {
                    // Create new shared style
                    if (!sSharedStyle)
                    {
                        if (this.ignoreMissed) continue
                        // create
                        sSharedStyle = SharedStyle.fromStyle({
                            name: sStyleName,
                            style: sStyle,
                            document: this.nDoc
                        })
                        if (rule.isText)
                            this.textStyles[sStyleName] = sSharedStyle
                        else
                            this.layerStyles[sStyleName] = sSharedStyle
                        this.result.createdStyles++
                        this.logMsg("[Created] new shared style " + sStyleName)

                    } else
                    {
                        sSharedStyle.sketchObject.resetReferencingInstances()
                        this.logMsg("[Updated] shared style " + sStyleName)
                        this.result.updatedStyles++
                    }
                    this._saveTokensForStyleAndSymbols(rule.props, sSharedStyle)
                }
            }
            //
        }

        // clean style names
        {
            const f = function (sStyle)
            {
                const i = sStyle.name.lastIndexOf("--PTD-")
                if (i < 0) return
                sStyle.name = sStyle.name.slice(0, i < 0)
            }
            this.sDoc.sharedTextStyles.forEach(f)
            this.sDoc.sharedLayerStyles.forEach(f)
        }

        return true
    }

    _resetStyle(rule, sStyle)
    {
        if (rule.isLayer && sStyle)
        {
            sStyle.borders = []
            sStyle.fills = []
            sStyle.shadows = []
            sStyle.borderOptions = undefined
        }
    }

    _saveRuleAsAttr(rule, strPath)
    {
        const rawItems = rule.props[PT_ATTR].replaceAll('"', '').split("::")
        if (rawItems.length)
        {
            const [attrName, attrValue] = rawItems
            if (undefined == this.elements.attrs[strPath]) this.elements.attrs[strPath] = {}
            this.elements.attrs[strPath][attrName] = attrValue
        }
    }


    _getFindSharedStyleByRule(rule)
    {
        let sStyleNameSrc = ""
        let isText = false
        if (SKTEXT_STYLE in rule.props)
        {
            sStyleNameSrc = rule.props[SKTEXT_STYLE]
            isText = true
        } else if (SKLAYER_STYLE in rule.props)
        {
            sStyleNameSrc = rule.props[SKLAYER_STYLE]
        } else
        {
            return undefined
        }

        let sStyleName = cleanName(sStyleNameSrc)
        const sSharedStyle = this._findStyleByName(sStyleName, !isText)
        if (!sSharedStyle)
        {
            this.logError("Can't find shared style by name " + sStyleName)
        }
        return sSharedStyle
    }


    // mutable
    _defineRuleTypeAsColor(rule)
    {
        // cut first path element '.--COLORS-'
        rule.path.splice(0, 1)
        rule.name = cleanName(rule.path.map(cleanName).join("/"))
        //
        rule.isColor = true
        rule.isStandalone = false
        rule.isText = false
        rule.isLayer = false
        rule.isGroup = false
        rule.isImage = false
        rule.type = "color"
    }

    // mutable
    _defineRuleType(rule)
    {
        var res = ""
        const props = rule.props

        if (null != props['image'])
            res += "image"

        if (null != props['color'] || null != props['font-family'] || null != props['font-style'] || null != props['font-size'] ||
            null != props['font-weight'] || null != props['text-transform'] || null != props['text-align'] || null != props['vertical-align'] ||
            null != props['text-decoration'] || null != props['letter-spacing'] || null != props[PT_PARAGRAPH_SPACING] || null != props['line-height'] ||
            (PT_TEXT in props)
        )
            res += "text"
        if (null != props['image'])
            res += "image"
        if (LAYER_PROPS.filter(p => p in props).length) res += "layer"
        if (null != props['opacity'])
            if ("" == res)
                res += "single_opacity layer"
            else
                res += "opacity"

        if (null != props[PT_SMARTLAYOUT])
            res += "group"

        if (PT_LAYER_TYPE in props) res += props[PT_LAYER_TYPE]

        rule.isText = res.includes("text")
        rule.isLayer = res.includes("layer")
        rule.isGroup = res.includes("group")
        rule.isImage = res.includes("image")
        rule.isColor = false

        rule.type = res
    }



    loadRules()
    {
        if (DEBUG) this.logDebug("loadRules: started")
        const tempFolder = Utils.getPathToTempFolder()
        const pathToRulesJSON = tempFolder + "/nsdata.json"

        // check files
        if (!Utils.fileExistsAtPath(this.pathToSource))
        {
            this.logError("Can not find styles file by path: " + this.pathToSource)
            return false
        }

        let runResult = null
        try
        {
            const stylesType = this.pathToSource.endsWith(".less") ? "less" : "sass"
            this.isLess = "less" == stylesType
            this.isSass = "sass" == stylesType

            // Copy  conversion script
            const scriptPath = Utils.copyScript('nsconvert_' + stylesType + '.js', tempFolder)
            if (undefined == scriptPath) return false

            // Run script 
            var args = [scriptPath]
            args.push("-styles=" + this.pathToSource)
            args.push("-json=" + pathToRulesJSON)

            if (this.isSass)
            {
                let sassModulePath = Settings.settingForKey(SettingKeys.PLUGIN_SASSMODULE_PATH)
                if (undefined != sassModulePath && sassModulePath != '')
                    args.push("-sassmodule=" + sassModulePath)
            }

            if (this.pathToAssets != "")
            {
                const pathToCSS = this.pathToAssets + "/" + Constants.CSSFILE_POSTFIX
                args.push("-css=" + pathToCSS)
                this.pathToVars = this.pathToAssets + "/" + Constants.VARSFILE_POSTFIX
                args.push("-vars=" + this.pathToVars)
                const pathToSASS = this.pathToAssets + "/" + Constants.SASSFILE_POSTFIX
                args.push("-sass=" + pathToSASS)
            }

            let nodePath = Settings.settingForKey(SettingKeys.PLUGIN_NODEJS_PATH)
            if (undefined == nodePath || "" == nodePath) nodePath = Constants.NODEJS_PATH

            // check if launch path exists
            if (!Utils.fileExistsAtPath(nodePath))
            {
                return this.logError("Can not find " + nodePath + ". Install Node.js or change Node.js launch path in Settings.")
            }
            runResult = Utils.runCommand(nodePath, args)
            if (DEBUG) this.logDebug(runResult)
        } catch (error)
        {
            this.logError(error)
            return false
        }

        if (!runResult.result)
        {
            this.logError(runResult.output)
            return false
        }

        this.convertorOuput = runResult.output

        // load json file
        var error = null
        var rulesJSONStr = Utils.readFile(pathToRulesJSON)
        try
        {
            this.rules = JSON.parse(rulesJSONStr)
        } catch (e)
        {
            this.logError("loadRules: faled to parse JSON")
            this.logError(e)
            return false
        }

        if (this.showDebug)
        {
            this._showDebug(rulesJSONStr)
        }


        if (DEBUG) this.logDebug("loadRules: completed")
        return true
    }


    // stylePath: [str,str]
    _pathToStr(objPath)
    {
        objPath = objPath.map(cleanName)
        var objPathStr = objPath.join("/")
        return objPathStr
    }

    // objPath: [#Controls,#Buttons,Text]
    _findLayerByPath(path)
    {
        // get 'Controls / Buttons' name of symbol master
        const symbolPaths = this._buildSymbolPathFromPath(path)

        let symbolName = symbolPaths.join(' / ')
        let sFoundLayers = this.sDoc.getLayersNamed(symbolName).filter(l => (l.type == 'SymbolMaster' || l.type == 'Artboard'))
        if (!sFoundLayers.length)
        {
            symbolName = symbolPaths.join('/')
            sFoundLayers = this.sDoc.getLayersNamed(symbolName).filter(l => (l.type == 'SymbolMaster' || l.type == 'Artboard'))
        }
        if (!sFoundLayers.length)
        {
            // search in pages
            symbolName = symbolPaths.join(' / ')
            sFoundLayers = this.sDoc.getLayersNamed(symbolName).filter(l => (l.type == 'Page'))
            if (!sFoundLayers.length)
            {
                symbolName = symbolPaths.join('/')
                sFoundLayers = this.sDoc.getLayersNamed(symbolName).filter(l => (l.type == 'Page'))
            }
            if (!sFoundLayers.length)
            {
                return null
            }
        }

        const layerPath = this._buildSymbolChildPathFromPath(path)


        // return ref to found master symbol itself
        if (!layerPath.length || (layerPath.length && THIS_NAME == layerPath[0]))
        {
            return sFoundLayers[0]
        }

        // find a symbol child
        const sLayer = this._findLayerChildByPath(sFoundLayers[0], layerPath)
        if (!sLayer)
        {
            return null
        }
        return sLayer
    }

    // objPath: [#Controls,#Buttons]
    /*
    _findSymbolMasterByPath(path) {
        // get 'Controls / Buttons' name of symbol master
        const symbolPaths = this._buildSymbolPathFromPath(path)
        let symbolName = symbolPaths.join(' / ')
        let sFoundLayers = this.sDoc.getLayersNamed(symbolName).filter(l => "SymbolMaster" == l.type || l.type == 'Artboard')
        if (!sFoundLayers.length) {
            symbolName = symbolPaths.join('/')
            sFoundLayers = this.sDoc.getLayersNamed(symbolName).filter(l => "SymbolMaster" == l.type || l.type == 'Artboard')
        }
        return sFoundLayers.length ? sFoundLayers[0] : null
    }
    */

    // get existing or just create new Page with Symbols
    _getSymbolPage()
    {
        if (this._symbolPage) return this._symbolPage

        // try to find existing
        this.sDoc.pages.forEach(function (sPage)
        {
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

    _createNewSymbolMaster(name)
    {
        const page = this._getSymbolPage()

        var master = new SymbolMaster({
            name: name,
            parent: page
        })

        return master
    }


    _buildSymbolPathFromPath(path)
    {
        return path.filter(s => s.startsWith('#')).map(cleanName)
    }
    _buildSymbolChildPathFromPath(path)
    {
        return path.filter(s => s.startsWith('.')).map(cleanName)
    }


    _findLayerChildByPath(sLayerParent, path)
    {
        if (undefined == sLayerParent.layers)
        {
            return null
        }
        const pathNode = path[0]
        for (var sLayer of sLayerParent.layers)
        {
            if (sLayer.name.replace(/^(\s+)/g, "").replace(/(\s+)$/g, "") == pathNode)
            {
                if (path.length == 1)
                {
                    // found last element                    
                    return sLayer
                }
                if ('Group' == sLayer.type)
                {
                    return this._findLayerChildByPath(sLayer, path.slice(1))
                } else
                {
                    // oops we can't go deeply here
                    return null
                }
            }
        }
        return null
    }

    _saveTokensForStyleAndSymbols(token, sharedStyle)
    {
        // process all layers which are using this shared style
        for (var layer of sharedStyle.getAllInstancesLayers())
        {
            this._addTokenToSymbol(token, layer)
        }
        // save shared style
        this._addTokenToStyle(token, sharedStyle)
    }


    _addTokenToStyle(token, sharedStyle)
    {
        const tokenNames = Object.keys(token.__tokens)
        if (!tokenNames.length) return

        var styleInfo = null
        if (sharedStyle.name in this.elements.styles)
        {
            styleInfo = this.elements.styles[sharedStyle.name]
        } else
        {
            styleInfo = {
                tokens: [],
                //static: {} will be inited on a place
            }
            this.elements.styles[sharedStyle.name] = styleInfo
        }

        // Save tokens
        token.__tokens.filter(s => s[1].startsWith("@@")).forEach(function (s)
        {
            const propName = s[0]
            const currentValue = token[propName]
            s.push(currentValue)
        })
        Array.prototype.push.apply(styleInfo.tokens, token.__tokens)

        // Find non-tokenized properties and save also in style info
        Object.keys(token).filter(n => n != "__tokens").forEach(function (propName)
        {
            // test do we have the same property in tokenized
            const foundInTokens = token.__tokens.filter(tokenProp => tokenProp[0] === propName)
            if (foundInTokens.length) return
            // save as static
            if (styleInfo.static === undefined) styleInfo.static = {}
            styleInfo.static[propName] = token[propName]
        })
    }

    _addTokenToSymbol(token, slayer)
    {

        if (!token.__tokens.length) return

        var nlayer = slayer.sketchObject.parentSymbol()
        if (null == nlayer)
        {
            return false
        }
        const symbolLayer = Sketch.fromNative(nlayer)

        //
        var symbolInfo = null
        if (symbolLayer.name in this.elements)
        {
            symbolInfo = this.elements[symbolLayer.name]
        } else
        {
            symbolInfo = {
                layers: {}
            }
            this.elements[symbolLayer.name] = symbolInfo
        }

        var layerInfo = null
        if (slayer.name in symbolInfo.layers)
        {
            layerInfo = symbolInfo.layers[slayer.name]
        } else
        {
            layerInfo = {
                tokens: []
            }
            symbolInfo.layers[slayer.name] = layerInfo
        }
        Array.prototype.push.apply(layerInfo.tokens, token.__tokens)
        return true
    }

    _buildGradientObject(rule, sStyle, colorsRaw)
    {
        const token = rule.props
        const LINEAR = "linear-gradient"
        const gradientTypes = {
            'linear-gradient': Style.GradientType.Linear,
            'radial-gradient': Style.GradientType.Radial,
            'angular': Style.GradientType.Angular
        }

        var grads = GradientParser.parse(colorsRaw);
        if (undefined == grads || 0 == grads.length)
        {
            return undefined
        }
        var gr = grads[0]

        if ("" == gr.type)
        {
            return this.logError("Wrong gradient format")
        }
        if (!(gr.type in gradientTypes))
        {
            return this.logError('Uknown gradient type: ' + gr.type)
        }


        var gradient = {
            gradientType: gradientTypes[gr.type],
            stops: []
        };


        var deg = 180
        if (LINEAR == gr.type && undefined != gr.orientation && 'angular' == gr.orientation.type)
        {
            deg = parseFloat(gr.orientation.value, 10)
        }

        var count = gr.colorStops.length
        var lenA = 0.5


        var delta = 1 / (count - 1)

        var from = {}
        var to = {}

        if (0 == deg)
        {
            from = { x: 0.5, y: 1 }
            to = { x: 0.5, y: 0 }
        } else if (90 == deg)
        {
            from = { x: 0, y: 0.5 }
            to = { x: 1, y: 0.5 }
        } else if (180 == deg)
        {
            from = { x: 0.5, y: 0 }
            to = { x: 0.5, y: 1 }
        } else if (270 == deg)
        {
            from = { x: 1, y: 0.5 }
            to = { x: 0, y: 0.5 }
        } else
        {
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
            if ((srcDeg > 45 && srcDeg <= 135))
            {
                from.x = 0
                to.x = 1
            }
            if ((srcDeg > 225 && srcDeg < 315))
            {
                from.x = 1
                to.x = 0
            }
            // fixed y
            if ((srcDeg > 0 && srcDeg <= 45) || (srcDeg > 270 && srcDeg <= 360))
            {
                from.y = 1
                to.y = 0
            }
            if (srcDeg > 135 && srcDeg <= 225)
            {
                from.y = 0
                to.y = 1
            }
            // float x
            if ((srcDeg > 0 && srcDeg <= 45))
            {
                from.x = lenA - lenB
                to.x = lenA + lenB
            } else if (srcDeg > 135 && srcDeg < 180)
            {
                from.x = lenB
                to.x = lenA * 2 - lenB
            } else if ((srcDeg > 180 && srcDeg <= 225) || (srcDeg > 315 && srcDeg < 360))
            {
                from.x = lenA + lenB
                to.x = lenA - lenB
            }
            // float y
            if ((srcDeg > 45 && srcDeg <= 90) || (srcDeg > 270 && srcDeg <= 315))
            {
                from.y = lenA * 2 - lenB
                to.y = lenB
            } else if ((srcDeg > 90 && srcDeg <= 135) || srcDeg > 225 && srcDeg < 270)
            {
                from.y = lenA - lenB
                to.y = lenA + lenB
            }
        }

        gradient.to = to
        gradient.from = from

        gr.colorStops.forEach(function (sColor, index)
        {
            var color = ""
            if ('hex' == sColor.type)
            {
                color = "#" + sColor.value
            } else if ('literal' == sColor.type)
            {
                color = sColor.value
            } else if ('rgba' == sColor.type)
            {
                color = Utils.RGBAToHexA(Utils.RGBAStructToRGBAStr(sColor.value))
            }
            gradient.stops.push({
                color: color,
                position: undefined != sColor.length && "%" == sColor.length.type ? sColor.length.value / 100 : index * delta
            })
        })

        return gradient
    }


    _applyFillGradientProcessColor(rule, sStyle, colorType)
    {
        const token = rule.props
        var color = token['fill-' + colorType + '-color']
        var opacity = token['fill-' + colorType + '-color-opacity']

        if ('transparent' == color)
        {
            var opacity = "0%"
            color = "#FFFFFF" + Utils.opacityToHex(opacity)
        } else
        {
            if (undefined != opacity) color = color + Utils.opacityToHex(opacity)
        }
        return color
    }

    _applyShadow(rule, sStyle, shadowPropName)
    {
        var shadows = null

        var shadowCSS = rule.props[shadowPropName]

        if (shadowCSS != null && shadowCSS != "" && shadowCSS != "none")
        {
            shadows = Utils.splitCSSShadows(shadowCSS)
        } else
        {
            if (shadowCSS == 'none')
            {
                sStyle.shadows = [] //clear any existing shadows     
                sStyle.innerShadows = [] //clear any existing shadows                
            }
        }

        if (!shadows || !shadows.length)
        {
            return false
        }

        const token = rule.props
        let reset = token[PT_SHADOW_UPDATE] == 'true' || !this.appliedStyles[rule.isText][rule.name]
        let resetInset = true


        shadows.forEach(function (shadow)
        {
            if (shadow.inset)
            {
                if (resetInset || null == sStyle.innerShadows)
                {
                    sStyle.innerShadows = [shadow]
                    resetInset = false
                } else
                    sStyle.innerShadows.push(shadow)
            } else
            {
                if (reset || null == sStyle.shadows)
                {
                    sStyle.shadows = [shadow]
                    reset = false
                } else
                    sStyle.shadows.push(shadow)
            }
        })
    }

    _applyShapeRadius(rule, sSharedStyle, sStyle)
    {
        const token = rule.props

        if (null == sSharedStyle && null == rule.sLayer) return true

        var radius = token['border-radius']
        const layers = rule.sLayer ? [rule.sLayer] : sSharedStyle.getAllInstancesLayers()

        for (var l of layers)
        {
            if (radius != "")
            {
                const radiusList = radius.split(' ').map(value => parseFloat(value.replace("px", "")))
                if (undefined == l.points)
                {
                    l = l.layers[0]
                }
                if (!l.points)
                {
                    return this.logError('_applyShapeRadius: empty points for ' + (l.parent.parent ? (l.parent.parent.name + " / ") : "") + (l.parent ? (l.parent.name + " / ") : "") + l.name)
                }
                l.points.forEach(function (point, index)
                {
                    point.cornerRadius = radiusList.length > 1 ? radiusList[index] : radiusList[0]
                })
            }
            //this._addTokenToSymbol(token,l)
        }

        return true
    }

    _applyBorderStyle(rule, sStyle)
    {
        if (DEBUG) this.logDebug("_applyBorderStyle: rule=" + rule.name)

        const token = rule.props
        const borderWidth = token['border-width']
        const borderColor = token['border-color']
        const borderStyle = token['border-style']
        const borderLineEnd = token['border-line-end']
        const borderLineJoin = token['border-line-join']
        const borderStartArrowhead = token['border-start-arrowhead']
        const borderEndArrowhead = token['border-end-arrowhead']

        let updateBorder = token[PT_BORDER_UPDATE] == 'true'

        var border = {}
        if (updateBorder)
        {
            // get existing border to update it
            if (sStyle.borders != null && sStyle.borders.length > 0)
            {
                border = sStyle.borders[sStyle.borders.length - 1]
            } else
            {
                updateBorder = false
            }
        }

        // process border-style
        if (null != borderStyle)
        {
            if ("none" == borderStyle)
            { // remove any border and bail
                if (updateBorder) sStyle.borders = [];
                return;
            }
            if (undefined == sStyle.borderOptions) sStyle.borderOptions = {}
            const width = borderWidth != null ? borderWidth.replace("px", "") : 1
            if ("dashed" == borderStyle)
            {
                sStyle.borderOptions.dashPattern = [3 * width, 3 * width]
            } else if ("dotted" == borderStyle)
            {
                sStyle.borderOptions.dashPattern = [1 * width, 1 * width]
            }
        }

        // process color
        if (null != borderColor)
        {
            if (borderColor.indexOf("gradient") > 0)
            {
                border.fillType = Style.FillType.Gradient
                border.gradient = this._buildGradientObject(rule, sStyle, borderColor)
                if (border.color) delete border['color'];
            } else if (borderColor != "none")
            {
                let color = borderColor
                let opacity = token['border-color-opacity']
                if (null != opacity) color = color + Utils.opacityToHex(opacity)
                border.fillType = Style.FillType.Color
                border.color = Utils.strToHEXColor(color)
                if (border.gradient) delete border['gradient'];
            }
        }

        // process position
        if ('border-position' in token)
        {
            var conversion = {
                'center': Style.BorderPosition.Center,
                'inside': Style.BorderPosition.Inside,
                'outside': Style.BorderPosition.Outside
            }
            if (!(token['border-position'] in conversion))
            {
                return this.logError('Wrong border-position')
            }

            const pos = token['border-position']
            border.position = conversion[pos]
        }

        // process width
        if (null != borderWidth)
        {
            border.thickness = borderWidth.replace("px", "")
        }

        if (null != borderLineEnd)
        {
            if (undefined == sStyle.borderOptions) sStyle.borderOptions = {}
            if (!(borderLineEnd) in bordedLineEndMap)
            {
                return this.logError('Wrong border-line-end value: ' + borderLineEnd)
            }
            sStyle.borderOptions.lineEnd = bordedLineEndMap[borderLineEnd]
        }
        if (null != borderLineJoin)
        {
            if (undefined == sStyle.borderOptions) sStyle.borderOptions = {}
            if (!(borderLineJoin) in bordedLineJoinMap)
            {
                return this.logError('Wrong border-line-join value: ' + borderLineJoin)
            }
            sStyle.borderOptions.lineJoin = bordedLineJoinMap[borderLineJoin]
        }
        if (null != borderStartArrowhead)
        {
            if (undefined == sStyle.borderOptions) sStyle.borderOptions = {}
            if (!(borderStartArrowhead) in bordedArrowheadMap)
            {
                return this.logError('Wrong border-start-arrowhead value: ' + borderStartArrowhead)
            }
            sStyle.borderOptions.startArrowhead = bordedArrowheadMap[borderStartArrowhead]
        }
        if (null != borderEndArrowhead)
        {
            if (undefined == sStyle.borderOptions) sStyle.borderOptions = {}
            if (!(borderEndArrowhead) in bordedArrowheadMap)
            {
                return this.logError('Wrong border-end-arrowhead value: ' + borderEndArrowhead)
            }
            sStyle.borderOptions.endArrowhead = bordedArrowheadMap[borderEndArrowhead]
        }


        if (!updateBorder)
        {
            // save new border in style                
            if (Object.keys(border) == 0 || !(border && (borderColor == null || borderColor != 'none') && (borderWidth == null || borderWidth != '0px')))
            {
                border = null
            }

            if (this.appliedStyles[rule.isText][rule.name] != undefined && sStyle.borders != null)
            {
                // already added border, now add one more
                if (border)
                {
                    sStyle.borders.push(border)
                }
            } else
            {
                // drop existing borders
                sStyle.borders = border ? [border] : []
            }
        }
    }

    _setTextStyleParagraph(sStyle, value)
    {
        sStyle.paragraphSpacing = value
        sStyle.lineHeight = sStyle.lineHeight
    }

    ////////////////////////////////////////////////////////////////////////////

    _applyRuleToLayerStyle(rule, sSharedStyle, sStyle)
    {
        if (DEBUG) this.logDebug("_applyRuleToLayerStyle: rule=" + rule.name)

        const token = rule.props
        // SET COLOR        
        let backColor = token['background-color']
        var updateFill = token[PT_FILL_UPDATE] == 'true'
        // skip color with wrong "@token" value
        //log(backColor)
        if (backColor != null && !backColor.startsWith("@"))
        {
            let fill = {}
            if (updateFill)
            {
                // get existing fill to update it
                if (sStyle.fills != null && sStyle.fills.length > 0)
                {
                    fill = sStyle.fills.slice(-1)[0]
                } else
                {
                    updateFill = false
                }
            }
            if (backColor === "" || backColor === "none")
            {
                fill = undefined
            } else if (backColor.indexOf("gradient") > 0)
            {
                fill.fill = Style.FillType.Gradient
                fill.gradient = this._buildGradientObject(rule, sStyle, backColor)
            } else
            {
                fill.fill = Style.FillType.Color
                fill.color = Utils.strToHEXColor(backColor, token['opacity'])
            }
            //
            if (!updateFill)
            {
                if (sStyle.fills === undefined) sStyle.fills = []
                if (fill) sStyle.fills.push(fill)
            } else
            {
                if (fill === undefined || fill.fill === undefined)
                {
                    //drop the last fill                    
                    if (sStyle.fills !== undefined) sStyle.fills.pop()
                }
            }
        } else
        {
            //sStyle.fills = []
        }



        if (rule.type.includes("single_opacity"))
        {
            sStyle.opacity = token['opacity']
        }

        // SET SHADOW 
        this._applyShadow(rule, sStyle, 'box-shadow')

        // SET BORDER       
        if (('border-color' in token) || ('border-width' in token) || ('border-position' in token))
            this._applyBorderStyle(rule, sStyle)

        // SET BORDER RADIUS
        if ('border-radius' in token)
            this._applyShapeRadius(rule, sSharedStyle, sStyle)

        // SET PADDING
        const paddingSrc = token['padding']
        if (null != paddingSrc)
        {
            this._applyPaddingToLayer(rule, paddingSrc)
        }

    }


    _applyRuleToGroup(rule)
    {
        const token = rule.props
        const l = rule.sLayer

        // SET SMART LAYOUT
        var smartLayout = token[PT_SMARTLAYOUT]
        if (smartLayout != null)
        {
            smartLayout = smartLayout.toLowerCase().replace(/^\"/, "").replace(/\"$/, "")
            if (!(smartLayout in smartLayoutMap))
            {
                return this.logError("Can not understand rule " + PT_SMARTLAYOUT + ": " + smartLayout)
            }
            l.smartLayout = smartLayoutMap[smartLayout]
        }
    }

    _applyPaddingToLayer(rule, paddingSrc)
    {

        let paddingValues = paddingSrc.spit(" ")

        let ptop = 10
        let pleft = 10
        let pbottom = 10
        let pright = 10

        const sCurrLayer = rule.sLayer
        const sParent = sCurrLayer.parent
        const parentFrame = new Rectangle(sParent.frame)

        sParent.layers.forEach(function (sLayer)
        {
            if (sLayer.id == sCurrLayer.id) return
            sLayer.frame.x = pleft
            sLayer.frame.y = ptop
            sLayer.frame.height = parentFrame.height - ptop - pbottom
            sLayer.frame.width = parentFrame.width - pleft - pright
        }, this)
    }



    _applyRuleToTextStyle(rule, sSharedStyle, sStyle)
    {
        const token = rule.props

        if (DEBUG) this.logDebug("_applyRuleToTextStyle: rule=" + rule.name)

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
        var sizeBehaviour = token[PT_SIZE_BEHAVIOUR]
        var paragraphSpacing = token[PT_PARAGRAPH_SPACING]

        // SET LAYER TEXT 
        if (undefined != text && rule.sLayer)
        {
            const layerName = rule.sLayer.name
            rule.sLayer.text = text
            rule.sLayer.name = layerName
        }

        if (undefined != sizeBehaviour && rule.sLayer)
        {
            const svalue = FIXED_SIZE_BEHAVIOUR_MAP[sizeBehaviour]
            if (undefined == svalue)
                return this.logError("Wrong text behaviour value '" + sizeBehaviour + "' for rule " + rule.name)
            rule.sLayer.sketchObject.setTextBehaviour(svalue)
        }

        //// SET FONT SIZE
        if (undefined != fontSize)
        {
            sStyle.fontSize = parseFloat(fontSize.replace("px", ""))

            // If applied font size at first time then drop line-height
            if (!this.appliedStyles[rule.isText][rule.name])
            {
                sStyle.lineHeight = null
            }
        }
        //// SET LINE HEIGHT
        if (undefined != lineHeight)
        {
            if (0 == lineHeight)
            {
                sStyle.lineHeight = null
            } else if (lineHeight.indexOf("px") > 0)
            {
                sStyle.lineHeight = lineHeight.replace("px", "")
            } else
            {
                if (null == sStyle.fontSize)
                {
                    return this.logError("Can not apply line-height without font-size for rule " + rule.name)
                }
                sStyle.lineHeight = Math.round(parseFloat(lineHeight) * sStyle.fontSize)
            }
        }

        if (undefined != paragraphSpacing)
        {
            this._setTextStyleParagraph(sStyle, parseFloat(paragraphSpacing))
        }

        if (sStyle.fontVariant != "") sStyle.fontVariant = ""
        if (sStyle.fontStretch != "") sStyle.fontStretch = ""

        //// SET FONT FACE
        if (undefined != fontFace)
        {
            let firstFont = fontFace.split(',')[0]
            firstFont = firstFont.replace(/[""]/gi, '')
            sStyle.fontFamily = firstFont
        }
        //// SET FONT STYLE
        if (undefined != fontStyle)
        {
            sStyle.fontStyle = fontStyle
        } else
        {
            sStyle.fontStyle = ""
        }
        if (undefined != align)
        {
            if (!(align in alignMap))
            {
                return this.logError("Wrong align '" + align + "' for rule " + rule.name)
            }
            sStyle.alignment = alignMap[align]
        }
        if (undefined != verticalAlign)
        {
            if (!(verticalAlign in vertAlignMap))
            {
                return this.logError("Wrong vertical-align' '" + verticalAlign + "' for rule " + rule.name)
            }
            sStyle.verticalAlignment = vertAlignMap[verticalAlign]
        }

        //// SET FONT WEIGHT
        if (undefined != fontWeight)
        {
            var weightKey = "label"

            // for numeric weight we support it uses css format
            if (!isNaN(fontWeight))
            {
                weightKey = 'css'
                fontWeight = fontWeight * 1
            }

            var finalWeight = undefined
            for (var w of weights)
            {
                if (w[weightKey] == fontWeight)
                {
                    finalWeight = w.sketch
                    break
                }
            }
            if (undefined == finalWeight)
            {
                return this.logError('Wrong font weigh for rule ' + rule.name)
            }

            sStyle.fontWeight = finalWeight
        }

        // SET TEXT COLOR
        if (undefined != color)
        {
            sStyle.textColor = Utils.strToHEXColor(color)
        }
        // SET TEXT COLOR
        if (undefined != token['opacity'])
        {
            sStyle.opacity = Utils.cssOpacityToSketch(token['opacity'])
        }
        // SET TEXT TRANSFORM
        if (undefined != transform)
        {
            sStyle.textTransform = transform
        }
        // SET TEXT letterSpacing
        if (undefined != letterSpacing)
        {
            const spacing = letterSpacing.replace("px", "")
            if ("normal" == spacing)
            {
                sStyle.kerning = null
            } else if (!isNaN(spacing))
            {
                sStyle.kerning = spacing * 1
            } else
            {
                this.logError("Wrong '" + letterSpacing + "' value for letter-spacing")
            }
        }

        // SET TEXT DECORATION
        if (undefined != decoration)
        {
            if ("underline" == decoration)
            {
                sStyle.textUnderline = "single"
                sStyle.textStrikethrough = undefined
            } else if ("line-through" == decoration)
            {
                sStyle.textUnderline = undefined
                sStyle.textStrikethrough = "single"
            }
        }

        // SET TEXT SHADOW
        this._applyShadow(rule, sStyle, "text-shadow")
    }

    _applyCommonRules(rule, sSharedStyle, sStyle)
    {
        const token = rule.props
        const sLayer = rule.sLayer
        const nLayer = rule.sLayer ? rule.sLayer.sketchObject : null
        let currentResizesContent = null
        const resizeSymbol = token[PT_RESIZE_SYMBOL]
        if (DEBUG) this.logDebug("_applyCommonRules: for rule=" + rule.name)

        if (!this.skipPos)
        {

            // Switch "Adjust Content on resize" off before resizing
            if (null != resizeSymbol && (sLayer && ("SymbolMaster" == sLayer.type || "Artboard" == sLayer.type)))
            {
                currentResizesContent = nLayer.resizesContent()
                nLayer.setResizesContent(false)
            }

            const getRuleLayers = function (rule, sSharedStyle)
            {
                return rule.sLayer ? [rule.sLayer] : sSharedStyle ? sSharedStyle.getAllInstancesLayers() : []
            }

            // SET MARGINS
            while (true)
            {

                var margin = {
                    "top": token['margin-top'],
                    "right": token['margin-right'],
                    "bottom": token['margin-bottom'],
                    "left": token['margin-left']
                };
                var height = token['height']
                var width = token['width']

                var relativeTo = token[PT_MARGIN_RELATIVE_TO];
                var resize = token[PT_MARGIN_RESIZE];
                if (relativeTo)
                {
                    if (relativeTo.startsWith('"') || relativeTo.startsWith("'"))
                    {
                        relativeTo = relativeTo.slice(1);
                    }
                    if (relativeTo.endsWith('"') || relativeTo.endsWith("'"))
                    {
                        relativeTo = relativeTo.slice(0, -1);
                    }
                }

                var gotMargin;
                for (var m in margin)
                {
                    if (margin[m] == null) continue
                    margin[m] = parseInt(margin[m].replace('px', ""));
                    gotMargin = true;
                }

                if (null == gotMargin && null == height && null == width) break
                if (null == sSharedStyle && null == rule.sLayer) break

                for (var l of getRuleLayers(rule, sSharedStyle))
                {
                    // if margin-relative-to is set, find that sibling elemet
                    // and set as topParent for relative positioning
                    var xOffset = 0;
                    var yOffset = 0;
                    var topParent;
                    if (relativeTo != null)
                    {
                        var siblings = l.parent.layers;
                        for (var sib of siblings)
                        {
                            if (sib.name == relativeTo)
                            {
                                topParent = sib;
                                xOffset = topParent.frame.x;
                                yOffset = topParent.frame.y;
                                break;
                            }
                        }
                    }
                    // ...otherwise set to top parent 
                    if (!topParent)
                    {
                        topParent = this._findLayerTopParent(l);
                    }

                    const parentFrame = topParent.frame
                    const moveTop = topParent != l.parent;

                    if (DEBUG) this.logDebug("_applyCommonRules for layer: " + l.name)

                    let nRect = Utils.copyRect(topParent.sketchObject.absoluteRect())
                    let x = null
                    let y = null

                    if (null != height)
                    {
                        l.frame.height = parseInt(height.replace('px', ""))
                        if (DEBUG) this.logDebug("_applyCommonRules: set height to " + l.frame.height)
                    }
                    if (null != width)
                    {
                        l.frame.width = parseInt(width.replace('px', ""))
                    }

                    if (null != margin["top"])
                    { // prefer top positioning to bottom
                        y = margin["top"] + yOffset;
                    } else if (null != margin["bottom"])
                    {
                        y = parentFrame.height + yOffset - (margin["bottom"] + l.frame.height)
                    }
                    if (null != margin["left"])
                    { // prefer left positioning to right
                        x = margin["left"] + xOffset;
                    } else if (null != margin["right"])
                    {
                        x = parentFrame.width + xOffset - (margin["right"] + l.frame.width)
                    }

                    if (x != null || y != null) this.positionInArtboard(l, x, y)

                    if (resizeSymbol != null && "true" == resizeSymbol)
                    {
                        if (null != height) parentFrame.height = l.frame.height
                        if (null != width) parentFrame.width = l.frame.width
                    }

                    if (resize == "true")
                    {
                        parentFrame.height = l.frame.height + (margin["top"] || 0) + (margin["bottom"] || 0);
                        parentFrame.width = l.frame.width + (margin["left"] || 0) + (margin["right"] || 0);
                    }

                }
                break
            }

            // SET FIX SIZE AND PIN CORNERS
            if (nLayer)
            {
                for (let k in edgeFixdMap)
                {
                    if (null == token[k]) continue
                    nLayer.setFixed_forEdge_('true' == token[k], edgeFixdMap[k])
                }
            }

            // Switch "Adjust Content on resize" to old state
            if (null != currentResizesContent)
            {
                nLayer.setResizesContent(currentResizesContent)
            }

            //update symbol overrides
            if (token[PT_OVERRIDE_SYMBOL] && sLayer)
            {
                this._applySymbolOverrides(sLayer, token);
            }

            // Adjust to fit content if selected for artboard or symbol
            if ("true" == token[PT_FIT_CONTENT])
            {
                if (sLayer && ("SymbolMaster" == sLayer.type || "Artboard" == sLayer.type))
                {
                    currentResizesContent = nLayer.resizesContent()
                    nLayer.setResizesContent(false)
                    sLayer.adjustToFit()
                    nLayer.setResizesContent(currentResizesContent)
                } else if ("Group" == sLayer.type)
                {
                    sLayer.adjustToFit()
                }
            }


            // Resize instances if selected for symbol
            if ("true" == token[PT_RESIZE_INSTANCES] && sLayer && "SymbolMaster" == sLayer.type)
            {
                for (var inst of sLayer.getAllInstances())
                {
                    inst.resizeWithSmartLayout();
                }
            }

            // apply vertical align
            if (null != token[PT_VERTICAL_ALIGN])
            {
                const align = token[PT_VERTICAL_ALIGN]
                if (DEBUG) this.logDebug("_applyCommonRules: " + PT_VERTICAL_ALIGN + "=" + align)
                for (var layer of getRuleLayers(rule, sSharedStyle))
                {
                    if ("middle" == align)
                    {
                        layer.frame.y = (layer.parent.frame.height - layer.frame.height) / 2
                    } else if ("bottom" == align)
                    {
                        layer.frame.y = layer.parent.frame.height - layer.frame.height
                    } else if ("top" == align)
                    {
                        layer.frame.y = 0
                    }
                }
            }
        }

        //
        const mixBlendModeCSS = token['mix-blend-mode']
        if (undefined != mixBlendModeCSS)
        {
            const mixBlendModeSketch = BLENDING_MODE_CSS_TO_SKETCH[mixBlendModeCSS]
            if (undefined == mixBlendModeSketch)
            {
                this.logError("Uknown '" + mixBlendModeCSS + "' mix-blend-mode value'")
            } else
            {
                sStyle.blendingMode = mixBlendModeSketch;
            }
        }

        return true
    }

    _applySymbolOverrides(layer, token)
    {
        if ("SymbolInstance" != layer.type)
        {
            return this.logError("Can't apply override because layer is not a symbol instance: " + layer.name)
        }

        // parse olayer and ovalue from token
        var v = token[PT_OVERRIDE_SYMBOL]; // ('affectedLayerName', '#Path #To #Symbol')
        v = v.replace(/^\s*\(\s*/, "");
        v = v.replace(/\s*\)\s*$/, "");
        var params = v.split(",");
        var olayer = params[0],
            ovalue = params[1];
        if (!(olayer && ovalue))
        {
            return this.logError(layer.name + ": Usage is " + PT_OVERRIDE_SYMBOL + ": ");
        }
        olayer = stripQuotes(olayer.replace(/^\s+/, "").replace(/\s+$/, ""));
        ovalue = stripQuotes(ovalue.replace(/^\s+/, "").replace(/\s+$/, ""));

        // just target symbolIDs for now, but could be expanded to
        // target other override types, too
        var otype = "symbolID";

        var overrides = layer.overrides;
        var oride;
        for (var o of overrides)
        {
            // find override matching layer name and (if provided) override type
            if (o.affectedLayer.name != olayer) continue;
            if (o.property == otype)
            {
                oride = o;
                break;
            }
        }

        if (!oride)
        {
            if (DEBUG) this.logDebug("No matching override for layer " + layer.name);
        } else
        {
            var success = false;
            if (ovalue.toLowerCase() == "none")
            {
                oride.value = "";
                success = true;
            } else
            {
                var symbolPath = ovalue.replace(/\s+/g, "*");
                symbolPath = this._transformRulePath(symbolPath);
                var master = this._findLayerByPath(symbolPath);
                if (!master && DEBUG)
                {
                    this.logDebug("No symbol found for '" + ovalue + "'");
                } else
                {
                    oride.value = master.symbolId;
                    success = true;
                }
            }
            if (success)
            {
                layer.resizeWithSmartLayout(); // "shrink to fit"
                if (DEBUG) this.logDebug(
                    "Symbol set to '" + ovalue + "' for layer '" +
                    oride.affectedLayer.name + "' in instance " + layer.name
                );
            }
        }
    }

    parentOffsetInArtboard(layer)
    {
        var offset = { x: 0, y: 0 };
        if (layer.type == 'Artboard' || layer.type === 'SymbolMaster') return
        var parent = layer.parent;
        while (parent.name && (parent.type !== 'Artboard' && parent.type !== 'SymbolMaster'))
        {
            offset.x += parent.frame.x;
            offset.y += parent.frame.y;
            parent = parent.parent;
        }
        return offset;
    }

    positionInArtboard(layer, x, y)
    {
        var parentOffset = this.parentOffsetInArtboard(layer);
        var newFrame = new Rectangle(layer.frame);
        if (x != null) newFrame.x = x - parentOffset.x;
        if (y != null) newFrame.y = y - parentOffset.y;
        layer.frame = newFrame;
        this.updateParentFrames(layer);
    }

    updateParentFrames(layer)
    {
        if (layer.type == 'Artboard' || layer.type === 'SymbolMaster') return
        var parent = layer.parent;
        while (parent && parent.name && (parent.type !== 'Artboard' && parent.type !== 'SymbolMaster'))
        {
            parent.adjustToFit();
            parent = parent.parent;
        }
    }


    _findLayerTopParent(l)
    {
        if (!l.parent) return l
        if ('Group' == l.parent.type) return this._findLayerTopParent(l.parent)
        return l.parent
    }

    _applyOpacityToLayer(rule)
    {
        const token = rule.props
        const sLayer = rule.sLayer
        const opacity = token['opacity']

        rule.sLayer.style.opacity = opacity

    }


    _applyPropsToColor(colorName, colorValue, rule = null)
    {
        const token = rule ? rule.props : null

        if (DEBUG) this.logDebug("_applyPropsToColor: rule=" + colorName)

        if (colorValue.includes("gradient"))
        {
            return this.logError("Sketch doesn't support gradients color variables. Fix '" + colorName + "' color variable.")
        }

        let opacity = token ? token['opacity'] : undefined
        let opacityHEX = undefined != opacity ? Utils.opacityToHex(opacity) : ''
        colorValue = Utils.strToHEXColor(colorValue + opacityHEX)

        var colors = this.sDoc.swatches
        var color = colors.find(c => c.name == colorName)
        if (!color)
        {
            // create new color
            var sketch = require('sketch')
            color = sketch.Swatch.from({
                name: colorName,
                color: colorValue
            })
            colors.push(color)
            //
            this.result.createdColors++
            this.logMsg("[Created] color variable " + colorName)
        } else
        {
            let opacity = 1.0
            if (colorValue in COLOR_NAMES)
            {
                colorValue = COLOR_NAMES[colorValue]
            } else if (colorValue.length > 7)
            {
                let rgba = Utils.hexColorToRGBA(colorValue)
                opacity = rgba.a / 255
                colorValue = colorValue.substring(0, 7)
            }
            let myNewColor = MSColor.colorWithHex_alpha(colorValue, opacity)
            let swatchContainer = this.nDoc.documentData().sharedSwatches()
            swatchContainer.swatches().forEach((s) =>
            {
                if (s.name() == colorName)
                {
                    s.updateWithColor(myNewColor)
                    swatchContainer.updateReferencesToSwatch(s)
                }
            })
            //
            this.result.updatedColors++
            this.logMsg("[Updated] color variable " + colorName)
        }
        if (token) this.elements.colors__[colorName] = token.__tokens
    }

    _applyPropsToImage(rule)
    {
        const token = rule.props
        let imageName = token['image']
        var sLayer = rule.sLayer

        if (DEBUG) this.logDebug("_applyPropsToImage: rule=" + rule.name)


        if (null == sLayer)
        {
            return this.logError("Can't find layer by path " + rule.name)
        }

        if (imageName != "")
        {
            if ('transparent' == imageName)
            {
                sLayer.style.opacity = 0
            } else
            {
                imageName = imageName.replace(/^\"/, "").replace(/\"$/, "")
                let path = this.pathToSourceFolder + "/" + imageName

                var fileManager = [NSFileManager defaultManager];
                if (![fileManager fileExistsAtPath: path])
                {
                    return this.logError('Image not found on path: ' + path)
                }

                // create new image
                let parent = sLayer.parent

                let frame = new Rectangle(sLayer.frame)
                let oldConstraints = sLayer.sketchObject.resizingConstraint()

                let sNewImage = null
                var rawImageSize = null
                if (path.toLowerCase().endsWith(".svg"))
                {
                    let svgString = Utils.readFile(path)
                    if (null == svgString)
                    {
                        return this.logError('Can not read SVG file on path: ' + path)
                    }
                    var svgData = svgString.dataUsingEncoding(NSUTF8StringEncoding);
                    var svgImporter = MSSVGImporter.svgImporter();
                    svgImporter.prepareToImportFromData(svgData);

                    var svgLayer = svgImporter.importAsLayer();
                    svgLayer.setName(sLayer.name);

                    sNewImage = Sketch.fromNative(svgLayer)
                    /*
                                    sNewImage = Sketch.ShapePath.fromSVGPath(svgPath)
                    */
                    sNewImage.frame = sLayer.frame.copy()
                    rawImageSize = sNewImage.frame
                } else
                {
                    sNewImage = new Image({
                        frame: frame,
                        name: sLayer.name,
                        image: path
                    })
                    rawImageSize = sNewImage.image.nsimage.size()
                }
                var sStyle = sNewImage.style
                this._resetStyle(rule, sStyle)

                // remove old image
                sLayer.remove()
                sLayer = null
                parent.layers.push(sNewImage)

                // calculage new frame
                var newWidth = null
                var newHeight = null

                if (null != token.width)
                {
                    const width = parseInt(token.width.replace(/([px|\%])/, ""), 10)
                    if (token.width.indexOf("px") > 0)
                    {
                        newWidth = width
                    }
                    if (token.width.indexOf("%") > 0)
                    {
                        newWidth = Math.floor(rawImageSize.width / 100 * width)
                    } else { }
                }
                if (null != token.height)
                {
                    const height = parseInt(token.height.replace(/([px|\%])/, ""), 10)
                    if (token.height.indexOf("px") > 0)
                    {
                        newHeight = height
                    }
                    if (token.height.indexOf("%") > 0)
                    {
                        newHeight = Math.floor(rawImageSize.height / 100 * height)
                    } else { }
                }

                if (null != newWidth && null != newHeight) { } else if (null != newWidth)
                {
                    newHeight = rawImageSize.height * (newWidth / rawImageSize.width)
                } else if (null != newHeight)
                {
                    newWidth = rawImageSize.width * (newHeight / rawImageSize.height)
                } else
                {
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

                if (null != newTop && null != newBottom)
                {
                    sNewImage.frame.y = parseInt(newTop.replace('px', ""))
                    sNewImage.frame.height = (parent.frame.height - parseInt(newBottom.replace('px', ""))) - sNewImage.frame.y
                } else if (null != newTop)
                {
                    sNewImage.frame.y = parseInt(newTop.replace('px', ""))
                } else if (null != newBottom)
                {
                    sNewImage.frame.y = parent.frame.height - parseInt(newBottom.replace('px', "")) - sNewImage.frame.height
                }
                if (null != newLeft && null != newRight)
                {
                    sNewImage.frame.x = parseInt(newLeft.replace('px', ""))
                    sNewImage.frame.width = (parent.frame.width - parseInt(newRight.replace('px', ""))) - sNewImage.frame.x
                } else if (null != newLeft)
                {
                    sNewImage.frame.x = parseInt(newLeft.replace('px', ""))
                } else if (null != newRight)
                {
                    sNewImage.frame.x = parent.frame.width - parseInt(newRight.replace('px', "")) - sNewImage.frame.width
                }

                sNewImage.sketchObject.resizingConstraint = oldConstraints

                // apply additional styles
                this._applyShadow(rule, sStyle, 'box-shadow')
                //this._applyCommonRules(rule, null)
                this._applyBorderStyle(rule, sStyle)

            }
        }

        return true
    }


}