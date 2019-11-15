@import("constants.js")
@import("lib/utils.js")
@import("lib/uidialog.js")

var app = undefined
const Sketch = require('sketch/dom')
const Settings = require('sketch/settings')
const Style = require('sketch/dom').Style
const Image = require('sketch/dom').Image
const path = require('path');
const Text = require('sketch/dom').Text
const Shape = require('sketch/dom').Shape
const Group = require('sketch/dom').Group
const Page = require('sketch/dom').Page
const Artboard = require('sketch/dom').Artboard
const SharedStyle = require('sketch/dom').SharedStyle

const defSettings = {
    gen:{
        pageWidth: 1600,
        pageHeight: 1200,
        pagesInRow: 3,
        columns: 9,
        initialTop: 25,
        initialLeft: 25,
        pageHSpace: 100,
        pageVSpace: 100,
    },
    group: {
        labelColor: "#353536",
        labelFontSize: 25,
        bottomSpace: 20,
    },
    text: {
        text: "Aa",
        textTop: 5,
        textBottom: 5,
        colWidth: 100,
        colVSpace: 50,
        colHSpace: 50,
        labelFontFamily: "Helvetica",
        labelFontWeight: 5,
        labelColor: "#353536",
        labelFontSize: 20,
        descrFontSize: 12,
        descrColor: "#B1B1B1",
    },
    layer: {
        colHeight: 100,
    },
}

class DSPreviewer {
    constructor(context) {
        this.nDoc = context.document
        this.sDoc = Sketch.fromNative(context.document)
        this.context = context
        this.UI = require('sketch/ui')

        this.messages = ""
        this.errors = []

        this.sArtboard = null
        this.sArtboards = []
        this.artboardY = 0
        this.artboardRowMaxHeight = null

        this._init()

        // init global variable
        app = this
    }

    _init() {
        this.def = JSON.parse(JSON.stringify(defSettings))
        const restoredDef = Settings.settingForKey(SettingKeys.PLUGIN_PREVIEWER_DEF)
        if(restoredDef) this._fillDef(this.def,restoredDef)

        ///

        this.groupLabelStyle = {
            textColor: this.def.group.labelColor,
            alignment: Text.Alignment.left,
            fontSize: this.def.group.labelFontSize,
            lineHeight: this.def.group.labelFontSize * 1.5,
        }

        this.labelStyle = {
            textColor: this.def.text.labelColor,
            alignment: Text.Alignment.left,
            fontSize: this.def.text.labelFontSize,
            lineHeight: 20,
            fontFamily: this.def.text.labelFontFamily,
            fontWeight: this.def.text.labelFontWeight,
        }

        this.descrStyle = {
            textColor: this.def.text.descrColor,
            alignment: Text.Alignment.left,
            fontSize: this.def.text.descrFontSize,
            lineHeight: this.def.text.descrFontSize * 1.5,
            fontFamily: this.def.text.labelFontFamily,
            fontWeight: this.def.text.labelFontWeight,
        }
    }

    _fillDef(def,restored){
        Object.keys(def).forEach(function(baseKey){
            if(!(baseKey in restored)) return
            Object.keys(def[baseKey]).forEach(function(key){
                if(key in restored[baseKey]) def[baseKey][key] = restored[baseKey][key]
            })
        })        
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
        while(true){
            const res = this._showDialog()
            if('cancel'==res) return false
            if('reset'==res){
                this.def = JSON.parse(JSON.stringify(defSettings))
                continue
            }
            break
        }

        var success = this._generate()

        // show final message
        if (this.errors.length > 0) {
            this._showErrors()
        } else {
            if (success) {
                UI.message("Completed")
            }
        }

        return true
    }

    // Internal


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
        const dialog = new UIDialog("Generate Styles Preview", NSMakeRect(0, 0, 600, 420), "Generate",
        "","Cancel","Reset")
        dialog.leftColWidth = 200

        dialog.initTabs(["General", "Headers", "Text Styles", "Layer Styles", "Advanced"])

        //////////////////////////////
        dialog.addLeftLabel("", "Artboard Size")
        let y = dialog.y
        let leftColWidth = dialog.leftColWidth
        dialog.addTextInput("pageWidth", "Width (px)", this.def.gen.pageWidth, "", 100)
        dialog.y = y
        dialog.leftColWidth += 120
        dialog.addTextInput("pageHeight", "Height (px)", this.def.gen.pageHeight, "", 100)
        dialog.leftColWidth = leftColWidth

        dialog.addSpace()
        dialog.addLeftLabel("", "Artbords in row")
        dialog.addTextInput("pagesInRow", "", this.def.gen.pagesInRow, "4", 100)

        dialog.addSpace()
        dialog.addLeftLabel("", "Styles in row")
        dialog.addTextInput("columns", "", this.def.gen.columns, "9", 100)
        
        ////////////////////////////// Headers
        dialog.setTabForViewsCreating(1)
        dialog.addLeftLabel("", "Text Color")
        dialog.addTextInput("group.labelColor", "", this.def.group.labelColor, "#000000", 120)
        dialog.addLeftLabel("", "Font Size (px)")
        dialog.addTextInput("group.labelFontSize", "", this.def.group.labelFontSize, "25", 120)
        dialog.addLeftLabel("", "Bottom Space (px)")
        dialog.addTextInput("group.bottomSpace", "", this.def.group.bottomSpace, "20", 120)

        ////////////////////////////// Text Styles
        dialog.setTabForViewsCreating(2)
        dialog.addLeftLabel("", "Text Example")
        dialog.addTextInput("text.text", "", this.def.text.text, "Aa", 120)

        dialog.addLeftLabel("", "Text Ident")
        y = dialog.y
        leftColWidth = dialog.leftColWidth
        dialog.addTextInput("text.textTop", "Top (px)", this.def.text.textTop, "5", 100)
        dialog.y = y
        dialog.leftColWidth += 120
        dialog.addTextInput("text.textBottom", "Bottom (px)", this.def.text.textBottom, "5", 100)
        dialog.leftColWidth = leftColWidth

        dialog.addDivider()

        dialog.addLeftLabel("", "Column Width (px)")
        dialog.addTextInput("text.colWidth", "", this.def.text.colWidth, "100", 100)
        

        dialog.addLeftLabel("", "Style Ident")
        y = dialog.y
        leftColWidth = dialog.leftColWidth
        dialog.addTextInput("text.colHSpace", "Horizontal (px)", this.def.text.colHSpace, "50", 100)
        dialog.y = y
        dialog.leftColWidth += 120
        dialog.addTextInput("text.colVSpace", "Vertical (px)", this.def.text.colVSpace, "50", 100)        
        dialog.leftColWidth = leftColWidth

        dialog.addDivider()

        dialog.addLeftLabel("", "Style Label")
        y = dialog.y
        leftColWidth = dialog.leftColWidth
        dialog.addTextInput("text.labelFontFamily", "Font Family", this.def.text.labelFontFamily, "Helvetica", 100)
        dialog.y = y
        dialog.leftColWidth += 120
        let weightIndex = weights.findIndex(w => w.sketch == this.def.text.labelFontWeight)
        dialog.addSelect("text.labelFontWeight", "Font Weight", weightIndex, weights.map(w => w.title))
        dialog.y = y
        dialog.leftColWidth += 120
        dialog.addTextInput("text.labelFontSize", "Font Size", this.def.text.labelFontSize, "20", 100)
        dialog.leftColWidth = leftColWidth
        dialog.addTextInput("text.labelColor", "Text Color", this.def.text.labelColor, "#000000", 100)

        dialog.addDivider()

        dialog.addLeftLabel("", "Style Description")
        y = dialog.y
        leftColWidth = dialog.leftColWidth
        dialog.addTextInput("text.descrFontSize", "Font Size", this.def.text.descrFontSize, "12", 100)
        dialog.y = y
        dialog.leftColWidth += 120
        dialog.addTextInput("text.descrColor", "Text Color", this.def.text.descrColor, "#000000", 100)
        dialog.leftColWidth = leftColWidth

        //////////////////////////////
        dialog.setTabForViewsCreating(3)
        dialog.addLeftLabel("", "Rectangle Height (px)")
        dialog.addTextInput("layer.colHeight", "", this.def.layer.colHeight, "100", 120)

        //////////////////////////////
        dialog.setTabForViewsCreating(4)

        dialog.addLeftLabel("", "Style Initial Offset")
        y = dialog.y
        leftColWidth = dialog.leftColWidth
        dialog.addTextInput("initialLeft", "Left (px)", this.def.gen.initialLeft, "12", 100)
        dialog.y = y
        dialog.leftColWidth += 120
        dialog.addTextInput("initialTop", "Top (px)", this.def.gen.initialTop, "12", 100)        
        dialog.leftColWidth = leftColWidth

        dialog.addLeftLabel("", "Space Between Artboards")
        y = dialog.y
        leftColWidth = dialog.leftColWidth
        dialog.addTextInput("pageHSpace", "Horizontal (px)", this.def.gen.pageHSpace, "100", 100)
        dialog.y = y
        dialog.leftColWidth += 120
        dialog.addTextInput("pageVSpace", "Vertical (px)", this.def.gen.pageVSpace, "100", 100)
        dialog.leftColWidth = leftColWidth


        while (true) {
            dialog.run()
            if (dialog.userClickedCancel) {
                dialog.finish()
                return "cancel"
            }
            if (dialog.userClickedThird) {
                dialog.finish()
                return "reset"
            }


            // read dialog data
            this.def.gen.pageWidth = parseInt(dialog.views['pageWidth'].stringValue(), 10)
            this.def.gen.pageHeight = parseInt(dialog.views['pageHeight'].stringValue(), 10)
            this.def.gen.pagesInRow = parseInt(dialog.views['pagesInRow'].stringValue(), 10)
            this.def.gen.columns = parseInt(dialog.views['columns'].stringValue(), 10)

            this.def.group.labelColor = dialog.views['group.labelColor'].stringValue()
            this.def.group.labelFontSize = parseInt(dialog.views['group.labelFontSize'].stringValue(), 10)
            this.def.group.bottomSpace = parseInt(dialog.views['group.bottomSpace'].stringValue(), 10)
            
            this.def.text.text = dialog.views['text.text'].stringValue()
            this.def.text.textTop =  parseInt(dialog.views['text.textTop'].stringValue(), 10)
            this.def.text.textBottom =  parseInt(dialog.views['text.textBottom'].stringValue(), 10)
            this.def.text.colWidth =  parseInt(dialog.views['text.colWidth'].stringValue(), 10)
            this.def.text.colVSpace =  parseInt(dialog.views['text.colVSpace'].stringValue(), 10)
            this.def.text.colHSpace =  parseInt(dialog.views['text.colHSpace'].stringValue(), 10)
            this.def.text.labelFontFamily = dialog.views['text.labelFontFamily'].stringValue()
            weightIndex = dialog.views['text.labelFontWeight'].indexOfSelectedItem()
            this.def.text.labelFontWeight = weights[weightIndex].sketch
            this.def.text.labelColor = dialog.views['text.labelColor'].stringValue()
            this.def.text.labelFontSize =  parseInt(dialog.views['text.labelFontSize'].stringValue(), 10)
            this.def.text.descrFontSize =  parseInt(dialog.views['text.descrFontSize'].stringValue(), 10)
            this.def.text.descrColor = dialog.views['text.descrColor'].stringValue()

            this.def.layer.colHeight =  parseInt(dialog.views['layer.colHeight'].stringValue(), 10)

            this.def.gen.initialTop =  parseInt(dialog.views['initialTop'].stringValue(), 10)
                    
            break
        }

        Settings.setSettingForKey(SettingKeys.PLUGIN_PREVIEWER_DEF, this.def)


        return "ok"
    }

    _generate() {
        const defPageName = 'Styles Overview'

        // drop old Preview Pages
        this.sDoc.pages.forEach(function (sPage) {
            if (defPageName == sPage.name)
                sPage.remove()
        })

        this.sPage = new Page({
            name: defPageName,
            parent: this.sDoc,
            selected: true
        })

        this._showStyles(this.sDoc.sharedTextStyles, "Text Styles")
        this._showStyles(this.sDoc.sharedLayerStyles, "Layer Styles")

        return true
    }


    _showStyles(sStyles, name) {
        this._resetArtboards()

        // build style groups
        const styleGroups = this._buildStyleGroups(sStyles)
        //
        var y = this.def.gen.initialTop
        for (let [groupName, styles] of Object.entries(styleGroups)) {
            if (y > this.def.gen.pageHeight || !this.sArtboard) {
                if (this.sArtboard) {
                    this.sArtboard.frame.height = y
                }
                y = this._createNewArtboard(name)
            }
            y = this._showGroupHead(groupName, y)
            y = this._showTextStyleGroup(styles, y)
        }
    }

    _resetArtboards() {
        if (this.sArtboard) {
            this.artboardY += this.artboardRowMaxHeight + this.def.gen.pageVSpace
        }

        this.sArtboard = null
        this.sArtboards = []
        this.artboardRowMaxHeight = null
    }

    _buildStyleGroups(sStyles) {
        var styleGroups = {}
        sStyles.forEach(function (sSharedStyle, styleIndex) {
            let groupName = "top"
            const lastShashIndex = sSharedStyle.name.lastIndexOf("/")
            if (lastShashIndex > 0) {
                groupName = sSharedStyle.name.substring(0, lastShashIndex)
            }
            let group = styleGroups[groupName]
            if (undefined == group) {
                group = []
                styleGroups[groupName] = group
            }
            group.push(sSharedStyle)
        }, this)
        return styleGroups
    }

    // return new Y
    _createNewArtboard(name) {
        //// Save prev artboards to increment artboard counter and for future usage
        let artboardX = 0

        if (this.sArtboard) {
            this.artboardRowMaxHeight = Math.max(this.artboardRowMaxHeight, this.sArtboard.frame.height)
            if (this.sArtboards.length % this.def.gen.pagesInRow === 0) {
                // place new artboard below last existing
                this.artboardY += this.artboardRowMaxHeight + this.def.gen.pageVSpace
                // reset artboard max height in current row
                this.artboardRowMaxHeight = 0
            } else {
                // place new artboard in the right side of last existing
                artboardX = this.sArtboard.frame.x + this.sArtboard.frame.width + this.def.gen.pageHSpace
                //                
            }
            ///
        } else {
            this.artboardRowMaxHeight = 0
        }
        //// Create new artbord for styles
        this.sArtboard = new Artboard({
            name: name + ' #' + (this.sArtboards.length + 1),
            parent: this.sPage,
            frame: new Rectangle(
                artboardX, this.artboardY, this.def.gen.pageWidth, this.def.gen.pageHeight

            )
        })
        this.sArtboards.push(this.sArtboard)

        return this.def.gen.initialTop
    }

    _calcBackColor(textColorHEX) {
        let rgba = Utils.hexColorToRGBA(textColorHEX)
        if (rgba.r > 128 && rgba.g > 128 && rgba.b > 128)
            return "#545454"
        else
            return "#FFFFFF"
    }

    _showGroupHead(groupName, y) {
        groupName = groupName.replace(/[/]/g, " / ")
        const sText = new Text({
            name: "Group Label",
            text: groupName,
            parent: this.sArtboard,
            frame: new Rectangle(
                this.def.gen.initialLeft, y, 400, this.groupLabelStyle.lineHeight
            ),
            style: this.groupLabelStyle,
        })
        return y + this.groupLabelStyle.lineHeight + this.def.group.bottomSpace
    }

    _showTextStyleGroup(styles, y) {

        const offsetX = this.def.gen.initialLeft

        const textExample = this.def.text.text
        const colLimit = this.def.gen.columns
        const colWidth = this.def.text.colWidth
        const colHSpace = this.def.text.colHSpace
        const colVSpace = this.def.text.colVSpace
        const textOffsetTop = this.def.text.textTop
        const textOffsetBottom = this.def.text.textBottom
        let colIndex = 1
        let x = offsetX
        let colHeight = 0

        styles.forEach(function (sSharedStyle, styleIndex) {
            const sStyle = sSharedStyle.style
            const isTextStyle = SharedStyle.StyleType.Text == sStyle.styleType

            /// calculate max height of texts in this row
            if (1 == colIndex) {
                if (isTextStyle) {
                    colHeight = 0
                    let last = Math.min(styleIndex + colLimit - 1, styles.length - 1)
                    for (let index = styleIndex; index <= last; index++) {
                        const sStyle = styles[index].style
                        colHeight = Math.max(colHeight, sStyle.lineHeight)
                    }
                    colHeight += textOffsetTop + textOffsetBottom
                } else {
                    colHeight = this.def.layer.colHeight
                }
            }
            ///

            let height = colHeight
            let width = colWidth

            const backStyle = isTextStyle ?
                {
                    fills: [
                        {
                            color: this._calcBackColor(sStyle.textColor),
                            fillType: Style.FillType.Color
                        }
                    ],
                    borders: [{ color: '#979797' }],
                } : sStyle


            let styleName = sSharedStyle.name
            const lastShashIndex = styleName.lastIndexOf("/")
            if (lastShashIndex > 0) {
                styleName = styleName.substring(lastShashIndex + 1)
            }

            let descr = ""
            ///

            const sParent = new Group({
                name: sSharedStyle.name,
                parent: this.sArtboard,
                frame: new Rectangle(
                    x, y, width, height
                )
            })
            let localY = 0

            const sBack = new Shape({
                name: "Back",
                parent: sParent,
                style: backStyle,
                frame: new Rectangle(
                    0, localY, width, height
                )
            })

            localY += textOffsetTop

            if (isTextStyle) {

                descr = sStyle.fontFamily + " " + sStyle.fontSize + "px" + "\n" + sStyle.textColor.toUpperCase()

                const sText = new Text({
                    name: "Text",
                    text: textExample,
                    parent: sParent,
                    frame: new Rectangle(
                        0 + 5, 0 + localY, width - 10, sStyle.lineHeight
                    ),
                    style: sStyle,
                    sharedStyleId: sSharedStyle.id
                })
            }
            localY += colHeight

            const sLabel = new Text({
                name: "Label",
                text: styleName,
                parent: sParent,
                frame: new Rectangle(
                    0, localY, width, this.labelStyle.lineHeight
                ),
                style: this.labelStyle
            })
            localY += this.labelStyle.lineHeight

            const sDescr = new Text({
                name: "Description",
                text: descr,
                parent: sParent,
                frame: new Rectangle(
                    0, localY, width, this.descrStyle.lineHeight
                ),
                style: this.descrStyle
            })
            localY += this.descrStyle.fontSize * 2


            // Final adjustment
            //sGroup.adjustToFit()

            // Calculate next cell position
            if (colIndex % colLimit === 0 || styleIndex == (styles.length - 1)) {
                // make new row
                y += localY + colVSpace
                x = offsetX
                colIndex = 1
            } else {
                // add new column
                colIndex++
                x += colWidth + colHSpace
            }
        }, this)

        return y
    }

    ///////////////////////////////////////////////////////////////


}
