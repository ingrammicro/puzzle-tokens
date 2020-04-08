@import("constants.js")
@import("lib/utils.js")
@import("lib/uidialog.js")

var app = undefined

const formatDefs = {
    [Constants.EXPORT_FORMAT_LESS]: {
        ext: ".less",
        symb: "@"
    },
    [Constants.EXPORT_FORMAT_SCSS]: {
        ext: ".scss",
        symb: "$"
    }
}

class DSExporter {
    constructor(context) {
        this.nDoc = context.document
        this.sDoc = Sketch.fromNative(context.document)
        this.context = context
        this.UI = require('sketch/ui')

        this.messages = ""
        this.errors = []

        this.docName = this._clearCloudName(this.nDoc.cloudName())
        this.pathTo = undefined
        this.format = undefined
        this.confOpts = undefined
        this.opts = {
            colors: {
                tokens: {}, index: 0, name: "color-", comment: "COLOR TOKENS", postix: "",
            },
            fontSizes: {
                tokens: {}, index: 0, name: "font-size", comment: "FONT SIZE TOKENS", postix: "px",
            },
            fontWeights: {
                tokens: {}, index: 0, name: "font-weight", comment: "FONT WEIGHTS TOKENS", postix: "",
            },
            fontFamilies: {
                tokens: {}, index: 0, name: "font-family", comment: "FONTS", postix: "",
            },
        }

        this._init()

        // init global variable
        app = this
    }

    _init() {
        this.pathTo = Settings.settingForKey(SettingKeys.PLUGIN_EXPORT_PATH_TO)
        if (undefined == this.pathTo) this.pathTo = ""
        this.format = Settings.settingForKey(SettingKeys.PLUGIN_EXPORT_FORMAT)
        if (undefined == this.format) this.format = Constants.EXPORT_FORMAT_LESS

        this.confOpts = Settings.settingForKey(SettingKeys.PLUGIN_EXPORT_OPTS)
        if (undefined == this.confOpts) this.confOpts = {}
        if (null == this.confOpts.colorTokens) this.confOpts.colorTokens = true
        if (null == this.confOpts.fontSizeTokens) this.confOpts.fontSizeTokens = true
        if (null == this.confOpts.fontWeightTokens) this.confOpts.fontWeightTokens = true
        if (null == this.confOpts.fontFamilyTokens) this.confOpts.fontFamilyTokens = true
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
        this.UI.alert('Error', error)
        exit = true
    }

    // Public methods

    run() {
        const res = this._showDialog()
        if ('cancel' == res) return false

        var success = this._export()

        // show final message
        if (this.errors.length > 0) {
            this._showErrors()
        } else {
            if (success) {
                this.UI.message("Completed")
            }
        }

        return true
    }

    // Internal

    _clearCloudName(cloudName) {
        let name = cloudName
        let posSketch = name.indexOf(".sketch")
        if (posSketch > 0) {
            name = name.slice(0, posSketch)
        }
        return name
    }



    _showMessages() {
        const dialog = new UIDialog("Completed", NSMakeRect(0, 0, 400, 400), "Dismiss", "", "")
        dialog.addTextViewBox("messages", "See what has been changed:", this.messages, 400)
        const result = dialog.run()
        dialog.finish()
    }

    _showErrors() {
        var errorsText = this.errors.join("\n\n")

        const dialog = new UIDialog("Found errors", NSMakeRect(0, 0, 600, 600), "Who cares!", "", "")
        dialog.addTextViewBox("debug", "", errorsText, 600)
        const result = dialog.run()
        dialog.finish()
    }

    _showDialog() {
        const dialog = new UIDialog("Export Styles", NSMakeRect(0, 0, 800, 300), "Export",
            "Export all text styles to a text file")
        //dialog.removeLeftColumn()
        dialog.leftColWidth = 200

        dialog.addLeftLabel("", "Destination")
        dialog.addPathInput({
            id: "pathTo", label: "", labelSelect: "Select Folder",
            textValue: this.pathTo,
            inlineHint: 'e.g. ~/Temp', width: 520
        })
        dialog.addDivider()

        dialog.addLeftLabel("", "File Format")
        dialog.addRadioButtons("format", "", this.format, ["LESS", "SCSS"], 250)

        dialog.addSpace()
        dialog.addLeftLabel("", "Create tokens for")
        dialog.addCheckbox("colorTokens", "Colors", this.confOpts.colorTokens)
        dialog.addCheckbox("fontSizeTokens", "Font Sizes", this.confOpts.fontSizeTokens)
        dialog.addCheckbox("fontWeightTokens", "Font Weights", this.confOpts.fontWeightTokens)
        dialog.addCheckbox("fontFamilyTokens", "Font Families", this.confOpts.fontFamilyTokens)


        if (null == this.confOpts.colorTokens) this.confOpts.colorTokens = true
        if (null == this.confOpts.fontSizeTokens) this.confOpts.fontSizeTokens = true
        if (null == this.confOpts.fontWeightTokens) this.confOpts.fontWeightTokens = true
        if (null == this.confOpts.fontFamilyTokens) this.confOpts.fontFamilyTokens = true


        while (true) {
            dialog.run()
            if (dialog.userClickedCancel) {
                dialog.finish()
                return "cancel"
            }

            // Check data
            this.pathTo = dialog.views['pathTo'].stringValue() + ""
            if ("" == this.pathTo) continue
            this.format = dialog.views['format'].selectedIndex
            this.less = this.format == Constants.EXPORT_FORMAT_LESS
            this.scss = this.format == Constants.EXPORT_FORMAT_SCSS
            this.confOpts.colorTokens = dialog.views['colorTokens'].state() == 1
            this.confOpts.fontSizeTokens = dialog.views['fontSizeTokens'].state() == 1
            this.confOpts.fontWeightTokens = dialog.views['fontWeightTokens'].state() == 1
            this.confOpts.fontFamilyTokens = dialog.views['fontFamilyTokens'].state() == 1
            this.def = formatDefs[this.format]
            // Save data

            Settings.setSettingForKey(SettingKeys.PLUGIN_EXPORT_PATH_TO, this.pathTo)
            Settings.setSettingForKey(SettingKeys.PLUGIN_EXPORT_FORMAT, this.format)
            Settings.setSettingForKey(SettingKeys.PLUGIN_EXPORT_OPTS, this.confOpts)
            break
        }

        return "ok"
    }

    ///////////////////////////////////////////////////////////////

    _export() {
        const textStylesText = this._getStylesAsText()
        const tokensText = this._getTokensAsText()

        let res = tokensText + textStylesText

        const fullPathTo = this.pathTo + "/" + this.docName + this.def.ext
        Utils.writeToFile(res, fullPathTo);

        return true

    }

    _getStylesAsText() {
        let res = ""
        res += "///////////////// Text Styles /////////////////\n"
        this.sDoc.sharedTextStyles.forEach(function (sStyle) {
            res += "///////////////" + sStyle.name + "\n"
            let si = this._parseStyleName(sStyle.name)
            res += si.openTags
            ///
            res += this._getTextStylePropsAsText(sStyle.style, si.spaces)
            ///
            res += si.closeTags
        }, this)
        return res
    }

    _getTokensAsText() {
        let res = ""

        Object.keys(this.opts).forEach((optName) => {
            res += this.getAbstractTokensAsText(this.opts[optName])
        }, this)

        return res
    }

    getAbstractTokensAsText(opt) {
        let res = ""
        if (opt.index) {
            const def = this.def
            res += "//////////// " + opt.comment + " TOKENS //////////\n"
            Object.keys(opt.tokens).forEach((value) => {
                const token = opt.tokens[value]
                res += def.symb + token.name + ":         " + value + opt.postix + ";\n"
            }, this)
            res += "\n"
        }
        return res
    }

    _getAbstractToken(opt, value) {
        let token = opt.tokens[value]
        if (null == token) {
            // create new token
            token = {
                value: value,
                name: opt.name + (opt.index < 10 ? "0" : "") + (opt.index < 100 ? "0" : "") + opt.index++
            }
            opt.tokens[value] = token
        }
        return this.def.symb + token.name
    }

    _getColorToken(color) {
        if (!this.confOpts.colorTokens) return color
        return this._getAbstractToken(this.opts.colors, color)
    }
    _getFontSizeToken(fontSize) {
        if (!this.confOpts.fontSizeTokens) return fontSize + "px"
        return this._getAbstractToken(this.opts.fontSizes, fontSize)
    }
    _getFontFamilyToken(fontFamily) {
        if (!this.confOpts.fontFamilyTokens) return fontFamily
        return this._getAbstractToken(this.opts.fontFamilies, fontFamily)
    }
    _getFontWeightToken(fontWeight) {
        if (!this.confOpts.fontWeightTokens) return fontWeight
        return this._getAbstractToken(this.opts.fontWeights, fontWeight)
    }


    _getTextStylePropsAsText(sStyle, spaces) {
        let res = ""
        const eol = ";\n"
        const pxeol = "px" + eol

        res += spaces + "font-family" + ": " + this._getFontFamilyToken(sStyle.fontFamily) + eol
        res += spaces + "font-size" + ": " + this._getFontSizeToken(sStyle.fontSize) + eol
        res += spaces + "color" + ": " + this._getColorToken(sStyle.textColor) + eol
        res += spaces + "text-align" + ": " + alignMap2[sStyle.alignment] + eol
        res += spaces + "vertical-align" + ": " + vertAlignMap2[sStyle.verticalAlignment] + eol
        {
            var cssWeights = weights.filter(w => w.sketch == sStyle.fontWeight)
            if (cssWeights.length == 0)
                this.logError('Can not find CSS font-weifgt for Sketch fontWeught ' + sStyle.fontWeight)
            else
                res += spaces + "font-weight" + ": " + this._getFontWeightToken(cssWeights[0].css) + eol
        }
        if (undefined != sStyle.fontStyle) {
            res += spaces + "font-style" + ": " + sStyle.fontStyle + eol
        }
        if (null != sStyle.lineHeight)
            res += spaces + "line-height" + ": " + sStyle.lineHeight + pxeol
        if (undefined != sStyle.textTransform) {
            res += spaces + "text-transform" + ": " + sStyle.textTransform + eol
        }
        if (undefined != sStyle.textUnderline) {
            res += spaces + "text-decoration" + ": " + "underline" + eol
        }
        if (undefined != sStyle.textStrikethrough) {
            res += spaces + "text-decoration" + ": " + "line-through" + eol
        }
        if (null != sStyle.kerning) {
            res += spaces + "letter-spacing" + ": " + sStyle.kerning + pxeol
        }
        res += spaces + PT_PARAGRAPH_SPACING + ": " + sStyle.paragraphSpacing + eol

        return res
    }


    _parseStyleName(name) {
        const path = name.split("/").map(s => s.replace(/\ /g, '__').replace(/\./g, '-DOT-'))
        let si = {
            openTags: "." + path.join(" .") + "{\n",
            spaces: "    ",
            closeTags: "}\n"
        }

        /*
        let spaceIncr = ""
        path.forEach(function (name, index) {
            res.openTags += "." + name + "{\n"
            res.closeTags = spaceIncr + "}\n" + res.closeTags
            // complete iteration
            spaceIncr += " "
        })
        res.openTags += "{\n"
        res.spaces = spaceIncr
        */

        return si
    }



}
