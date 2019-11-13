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


class DSPreviewer {
    constructor(context) {
        this.nDoc = context.document
        this.sDoc = Sketch.fromNative(context.document)
        this.context = context
        this.UI = require('sketch/ui')

        this.messages = ""

        this.errors = []

        // init global variable
        app = this
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

        this.sArtboard = new Artboard({
            name: 'Overview',
            parent: this.sPage,
            frame: new Rectangle(
                0, 0, 1000, 1000
            )
        })

        this._showTextStyles()


        return true
    }

    _calcBackColor(textColorHEX) {
        let rgba = Utils.hexColorToRGBA(textColorHEX)
        if (rgba.r > 128 && rgba.g > 128 && rgba.b > 128)
            return "#545454"
        else
            return "#FFFFFF"
    }

    _showTextStyles() {
        var y = 25
        const offsetX = 25
        const textExample = "Aa"
        const colLimit = 5
        const colWidth = 100
        const colSpace = 50
        const textOffsetTop = 5
        const textOffsetBottom = 5
        let colIndex = 1

        const labelStyle = {
            textColor: "#353536",
            alignment: Text.Alignment.left,
            fontSize: 12
        }

        let x = offsetX
        let colHeight = 100

        const textSharedStyles = this.sDoc.sharedTextStyles
        textSharedStyles.forEach(function (sSharedStyle, styleIndex) {

            /// calculate max height of texts in this row
            if (1 == colIndex) {
                colHeight = 0
                let last = Math.min(styleIndex + colLimit - 1, textSharedStyles.length - 1)
                for (let index = styleIndex; index <= last; index++) {
                    const sStyle = textSharedStyles[index].style
                    colHeight = Math.max(colHeight, sStyle.fontSize)
                }
                colHeight += textOffsetTop + textOffsetBottom
            }
            ///

            const sStyle = sSharedStyle.style
            let height = colHeight
            let width = colWidth

            const backStyle = {
                fills: [
                    {
                        color: this._calcBackColor(sStyle.textColor),
                        fillType: Style.FillType.Color
                    }
                ],
                borders: [{ color: '#979797' }],
            }

            ///

            const sParent = new Group({
                name: sSharedStyle.name,
                parent: this.sArtboard,
                frame: new Rectangle(
                    x, y, width, height
                )
            })
            //const sParent = this.sArtboard


            const sBack = new Shape({
                name: "Back",
                parent: sParent,
                style: backStyle,
                frame: new Rectangle(
                    0, 0, width, height
                )
            })

            const sText = new Text({
                name: "Text",
                text: textExample,
                parent: sParent,
                frame: new Rectangle(
                    0 + 5, 0 + textOffsetTop, width, sStyle.fontSize
                ),
                style: sStyle,
                sharedStyleId: sSharedStyle.id
            })
            //sText.adjustToFit()

            const sLabel = new Text({
                name: "Label",
                text: sSharedStyle.name,
                parent: sParent,
                frame: new Rectangle(
                    0, y + colHeight, width, labelStyle.fontSize
                ),
                style: labelStyle
            })


            // Final adjustment
            //sGroup.adjustToFit()

            // Calculate next cell position
            if (colIndex % colLimit === 0) {
                // make new row
                y += colHeight + labelStyle.fontSize
                x = offsetX
                colIndex = 1
            } else {
                // add new column
                colIndex++
                x += colWidth + colSpace
            }
        }, this)
    }

    ///////////////////////////////////////////////////////////////


}
