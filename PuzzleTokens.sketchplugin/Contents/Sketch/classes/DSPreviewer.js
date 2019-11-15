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
        this.def = {
            initialTop: 25,
            initialLeft: 25,
            pageWidth: 1600,
            pageHeight: 1200,
            pageVSpace: 100,
            pageHSpace: 100,
            pagesInRow: 3,
            group: {
                labelColor: "#353536",
                labelFontSize: 25,
                bottomSpace: 20,
            },
            layer: {
                colHeight: 100,
            },
            text: {
                text: "Aa",
                columns: 9,
                colWidth: 100,
                colVSpace: 50,
                colHSpace: 50,
                textTop: 5,
                textBottom: 5,
                labelFontFamily: "Helvetica",
                labelFontWeight: 5,
                labelColor: "#353536",
                labelFontSize: 20,
                descrFontSize: 12,
                descrColor: "#B1B1B1",
            }
        }

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
        if (!this._showDialog()) return false

        var success = this._generate()

        // show final message
        if (this.errors.length > 0) {
            this._showErrors()
        } else {
            if (success) {
                this._showMessages()
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
        const dialog = new UIDialog("Generate Styles Preview", NSMakeRect(0, 0, 600, 140), "Generate")


        while (true) {
            const result = dialog.run()
            if (!result) return false
            break
        }

        dialog.finish()


        return true
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
        var y = this.def.initialTop
        for (let [groupName, styles] of Object.entries(styleGroups)) {
            if (y > this.def.pageHeight || !this.sArtboard) {
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
            this.artboardY += this.artboardRowMaxHeight + this.def.pageVSpace
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
            if (this.sArtboards.length % this.def.pagesInRow === 0) {
                // place new artboard below last existing
                log(' this.artboardRowMaxHeight =' + this.artboardRowMaxHeight)
                this.artboardY += this.artboardRowMaxHeight + this.def.pageVSpace
                // reset artboard max height in current row
                this.artboardRowMaxHeight = 0
            } else {
                // place new artboard in the right side of last existing
                artboardX = this.sArtboard.frame.x + this.sArtboard.frame.width + this.def.pageHSpace
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
                artboardX, this.artboardY, this.def.pageWidth, this.def.pageHeight

            )
        })
        this.sArtboards.push(this.sArtboard)

        return this.def.initialTop
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
                this.def.initialLeft, y, 400, this.groupLabelStyle.lineHeight
            ),
            style: this.groupLabelStyle,
        })
        return y + this.groupLabelStyle.lineHeight + this.def.group.bottomSpace
    }

    _showTextStyleGroup(styles, y) {

        const offsetX = this.def.initialLeft

        const textExample = this.def.text.text
        const colLimit = this.def.text.columns
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
                log(sSharedStyle)
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
