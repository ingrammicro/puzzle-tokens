var Constants = {
    DOCUMENT_VERSION: "docVersion",
    TAB_SIZE: 2,
    HOTSPOT_PADDING: 0,
    LAYER_LOGGING: true,
    LOGGING: false,
    RESOURCES_FOLDER: "scripts",
    SYMBOLTOKENFILE_POSTFIX: "-inspector.json",
    CSSFILE_POSTFIX: "-viewer.css",
    VARSFILE_POSTFIX: "-vars.json",
    SASSFILE_POSTFIX: "-vars.scss",
    SYMBOLPAGE_NAME: "Symbols",

    SITE_CHANGELOG_URL: "https://github.com/ingrammicro/puzzle-tokens/blob/master/CHANGELOG.md",
};

var SettingKeys = {
    PLUGIN_PREVIEWER_DEF: "pluginPreviewerDef",
    PLUGIN_PATH_TO_TOKENS_LESS: "pluginPathToTokensLess",
    PLUGIN_PATH_TO_TOKENS_LESS_LIST: "pluginPathToTokensLessList",
    PLUGIN_GENERATE_SYMBOLTOKENS: "pluginGenSymbTokens",
    PLUGIN_SHOW_CHECK: "pluginPreview",
    PLUGIN_SHOW_DEBUG: "pluginDebug",
    PLUGIN_SHOW_DOUBLESTYLES: "pluginDoubleStyles",
    PLUGIN_CREATE_SYMBOLS: "pluginCreateSymbols",
    PLUGIN_EXPORT_PATH_TO: "pluginExportPathTo"
};


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
const SmartLayout = require('sketch').SmartLayout

const SKLAYER_STYLE = "sklayer-style"
const SKTEXT_STYLE = "sktext-style"
const PT_TEXT = "pt-text"
const PT_RESIZE_SYMBOL = "-pt-resize-symbol"
const PT_PARAGRAPH_SPACING = "pt-paragraph-spacing"
const PT_LAYER_TYPE = "-pt-layer-type"
const PT_SMARTLAYOUT = "-pt-smartlayout"
const PT_FIX_SIZE_HEIGHT = "-pt-fix-size-height"
const PT_FIX_SIZE_WIDTH = "-pt-fix-size-width"
const PT_PIN_LEFT = "-pt-pin-left"
const PT_PIN_RIGHT = "-pt-pin-right"
const PT_PIN_TOP = "-pt-pin-top"
const PT_PIN_BOTTOM = "-pt-pin-bottom"

const THIS_NAME = "_This"


// source: https://sketchplugins.com/d/956-set-fix-height-layer-property
const edgeFixdMap = {
    '-pt-pin-right': 1,
    '-pt-fix-size-width': 2,
    '-pt-pin-left': 4,
    '-pt-pin-bottom': 8,
    '-pt-fix-size-height': 16,
    '-pt-pin-top': 32,
}

const alignMap = {
    left: Text.Alignment.left,
    center: Text.Alignment.center,
    right: Text.Alignment.right,
    justify: Text.Alignment.justify
}
const alignMap2 = {
    [Text.Alignment.left]: "left",
    [Text.Alignment.center]: "center",
    [Text.Alignment.right]: "right",
    [Text.Alignment.justify]: "justify"
}
const vertAlignMap = {
    "top": Text.VerticalAlignment.top,
    "middle": Text.VerticalAlignment.center,
    "bottom": Text.VerticalAlignment.bottom
}
const vertAlignMap2 = {
    [Text.VerticalAlignment.top]: "top",
    [Text.VerticalAlignment.center]: "middle",
    [Text.VerticalAlignment.bottom]: "bottom",
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

const smartLayoutMap = {
    "LeftToRight": SmartLayout.LeftToRight,
    "HorizontallyCenter": SmartLayout.HorizontallyCenter,
    "RightToLeft": SmartLayout.RightToLeft,
    "TopToBottom": SmartLayout.TopToBottom,
    "VerticallyCenter": SmartLayout.VerticallyCenter,
    "BottomToTop": SmartLayout.BottomToTop,
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

const weights = [
    { label: 'thin', sketch: 2, css: 100, title: "Thin" },
    { label: 'extra-light', sketch: 3, css: 200, title: "Extra Light" },
    { label: 'light', sketch: 4, css: 300, title: "Light" },
    { label: 'regular', sketch: 5, css: 400, title: "Regular" },
    { label: 'medium', sketch: 6, css: 500, title: "Medium" },
    { label: 'semi-bold', sketch: 8, css: 600, title: "Semi Bold" },
    { label: 'semibold', sketch: 8, css: 600, title: "Semi Bold#2" },
    { label: 'bold', sketch: 9, css: 700, title: "Bold" },
    { label: 'extra-bold', sketch: 10, css: 800, title: "Extra Bold" },
    { label: 'black', sketch: 12, css: 900, title: "Black" },
]



function degToRad(deg) {
    return deg * Math.PI / 180;
}