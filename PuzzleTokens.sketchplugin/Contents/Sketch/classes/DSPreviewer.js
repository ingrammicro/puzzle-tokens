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

        this._init()
        // init global variable
        app = this
    }

    _init() {
        this.defGroup = {
            labelColor: "#353536",
            labelFontSize: 25,
            bottomSpace: 20,
        }
        this.defText = {
            initialTop: 25,
            initialLeft: 25,
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
            pageWidth: 1600,
            pageHeight: 1200,
        }

        this.groupLabelStyle = {
            textColor: this.defGroup.labelColor,
            alignment: Text.Alignment.left,
            fontSize: this.defGroup.labelFontSize,
            lineHeight: this.defGroup.labelFontSize * 1.5,
        }

        this.labelStyle = {
            textColor: this.defText.labelColor,
            alignment: Text.Alignment.left,
            fontSize: this.defText.labelFontSize,
            lineHeight: 20,
            fontFamily: this.defText.labelFontFamily,
            fontWeight: this.defText.labelFontWeight,
        }

        this.descrStyle = {
            textColor: this.defText.descrColor,
            alignment: Text.Alignment.left,
            fontSize: this.defText.descrFontSize,
            lineHeight: this.defText.descrFontSize * 1.5,
            fontFamily: this.defText.labelFontFamily,
            fontWeight: this.defText.labelFontWeight,
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

        this.sArtboard = new Artboard({
            name: 'Overview',
            parent: this.sPage,
            frame: new Rectangle(
                0, 0, this.defText.pageWidth, this.defText.pageHeight

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
        const sharedTextStyles = this.sDoc.sharedTextStyles
        // build style group list
        var styleGroups = {}
        sharedTextStyles.forEach(function (sSharedStyle, styleIndex) {
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

        // show groups
        var y = this.defText.initialTop
        for (let [groupName, styles] of Object.entries(styleGroups)) {
            y = this._showTextStyleGroupLabel(groupName, y)
            y = this._showTextStyleGroup(styles, y)
        }
    }

    _showTextStyleGroupLabel(groupName, y) {
        groupName = groupName.replace(/[/]/g, " / ")
        const sText = new Text({
            name: "Group Label",
            text: groupName,
            parent: this.sArtboard,
            frame: new Rectangle(
                this.defText.initialLeft, y, 400, this.groupLabelStyle.lineHeight
            ),
            style: this.groupLabelStyle,
        })
        return y + this.groupLabelStyle.lineHeight + this.defGroup.bottomSpace
    }

    _showTextStyleGroup(styles, y) {

        const offsetX = this.defText.initialLeft

        const textExample = this.defText.text
        const colLimit = this.defText.columns
        const colWidth = this.defText.colWidth
        const colHSpace = this.defText.colHSpace
        const colVSpace = this.defText.colVSpace
        const textOffsetTop = this.defText.textTop
        const textOffsetBottom = this.defText.textBottom
        let colIndex = 1
        let x = offsetX
        let colHeight = 0


        styles.forEach(function (sSharedStyle, styleIndex) {

            /// calculate max height of texts in this row
            if (1 == colIndex) {
                colHeight = 0
                let last = Math.min(styleIndex + colLimit - 1, styles.length - 1)
                for (let index = styleIndex; index <= last; index++) {
                    const sStyle = styles[index].style
                    colHeight = Math.max(colHeight, sStyle.lineHeight)
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

            let styleName = sSharedStyle.name
            const lastShashIndex = styleName.lastIndexOf("/")
            if (lastShashIndex > 0) {
                styleName = styleName.substring(lastShashIndex + 1)
            }

            let descr = sStyle.fontFamily + " " + sStyle.fontSize + "px"

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

            const sText = new Text({
                name: "Text",
                text: textExample,
                parent: sParent,
                frame: new Rectangle(
                    0 + 5, 0 + localY, width, sStyle.lineHeight
                ),
                style: sStyle,
                sharedStyleId: sSharedStyle.id
            })
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
            localY += this.descrStyle.lineHeight


            // Final adjustment
            //sGroup.adjustToFit()

            // Calculate next cell position
            if (colIndex % colLimit === 0 || styleIndex == (styles.length - 1)) {
                // make new row
                y += localY + colVSpace
                x = offsetX
                colIndex = 1
                log("next row, y=" + y + " colHeight=" + colHeight + " sLabel.frame.height=" + sLabel.frame.height + " colVSpace=" + colVSpace)
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
