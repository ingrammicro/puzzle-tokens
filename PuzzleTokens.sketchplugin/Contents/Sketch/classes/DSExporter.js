@import("constants.js")
@import("lib/utils.js")
@import("lib/uidialog.js")

var app = undefined


class DSExporter {
    constructor(context) {
        this.nDoc = context.document
        this.sDoc = Sketch.fromNative(context.document)
        this.context = context
        this.UI = require('sketch/ui')

        this.messages = ""
        this.errors = []

        this.docName = this._clearCloudName(this.nDoc.cloudName())
        this.pathTo = ""

        this._init()

        // init global variable
        app = this
    }

    _init() {
        this.pathTo = Settings.settingForKey(SettingKeys.PLUGIN_EXPORT_PATH_TO)
        if (undefined == this.pathTo) this.pathTo = ""
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
        const dialog = new UIDialog("Export Styles & Symbols", NSMakeRect(0, 0, 600, 420), "Export",
            "", "Cancel")
        dialog.removeLeftColumn()

        dialog.addPathInput({
            id: "pathTo", label: "Destination folder", labelSelect: "Select Folder",
            textValue: this.pathTo,
            inlineHint: 'e.g. ~/HTML', width: 450
        })

        while (true) {
            dialog.run()
            if (dialog.userClickedCancel) {
                dialog.finish()
                return "cancel"
            }

            // Check data
            this.pathTo = dialog.views['pathTo'].stringValue() + ""
            if ("" == this.pathTo) continue
            // Save data

            Settings.setSettingForKey(SettingKeys.PLUGIN_EXPORT_PATH_TO, this.pathTo)
            break
        }

        return "ok"
    }

    ///////////////////////////////////////////////////////////////

    _export() {
        let res = ""
        res += this._getStylesAsText()

        const fullPathTo = this.pathTo + "/" + this.docName + ".scss"
        Utils.writeToFile(res, fullPathTo);
        log(res)

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

    _getTextStylePropsAsText(sStyle, spaces) {
        let res = ""
        const eol = ";\n"
        const pxeol = "px" + eol

        res += spaces + "font-family" + ": " + sStyle.fontFamily + eol
        res += spaces + "font-size" + ": " + sStyle.fontSize + pxeol
        res += spaces + "color" + ": " + sStyle.textColor + eol
        res += spaces + "text-align" + ": " + alignMap2[sStyle.alignment] + eol
        res += spaces + "vertical-align" + ": " + vertAlignMap2[sStyle.verticalAlignment] + eol
        {
            var cssWeights = weights.filter(w => w.sketch == sStyle.fontWeight)
            if (cssWeights.length == 0)
                this.logError('Can not find CSS font-weifgt for Sketch fontWeught ' + sStyle.fontWeight)
            else
                res += spaces + "font-weight" + ": " + cssWeights[0].css + eol
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
        const path = name.split("/").map(s => s.replace(/\ /g, '__'))
        let si = {
            openTags: "." + path.join(" .") + "{\n",
            spaces: " ",
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
