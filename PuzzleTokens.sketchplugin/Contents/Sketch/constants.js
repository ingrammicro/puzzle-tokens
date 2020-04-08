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
    EXPORT_FORMAT_LESS: 0,
    EXPORT_FORMAT_SCSS: 1,

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
    PLUGIN_EXPORT_PATH_TO: "pluginExportPathTo",
    PLUGIN_EXPORT_FORMAT: "pluginExportFormat",
    PLUGIN_EXPORT_OPTS: "pluginExportOpts",
};


var Sketch = require('sketch/dom')
var Settings = require('sketch/settings')
var Style = require('sketch/dom').Style
var Image = require('sketch/dom').Image
const Group = require('sketch/dom').Group
var SharedStyle = require('sketch/dom').SharedStyle
var UI = require('sketch/ui')
const path = require('path');
const Text = require('sketch/dom').Text
const Shape = require('sketch/dom').Shape
const Page = require('sketch/dom').Page
const SmartLayout = require('sketch').SmartLayout
const Artboard = require('sketch/dom').Artboard
const Document = require('sketch/dom').Document
const SymbolMaster = require('sketch/dom').SymbolMaster
const Rectangle = require('sketch/dom').Rectangle


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

// source: https://github.com/bahamas10/css-color-names/blob/master/css-color-names.json
const COLOR_NAMES = {
    "aliceblue": "#f0f8ff",
    "antiquewhite": "#faebd7",
    "aqua": "#00ffff",
    "aquamarine": "#7fffd4",
    "azure": "#f0ffff",
    "beige": "#f5f5dc",
    "bisque": "#ffe4c4",
    "black": "#000000",
    "blanchedalmond": "#ffebcd",
    "blue": "#0000ff",
    "blueviolet": "#8a2be2",
    "brown": "#a52a2a",
    "burlywood": "#deb887",
    "cadetblue": "#5f9ea0",
    "chartreuse": "#7fff00",
    "chocolate": "#d2691e",
    "coral": "#ff7f50",
    "cornflowerblue": "#6495ed",
    "cornsilk": "#fff8dc",
    "crimson": "#dc143c",
    "cyan": "#00ffff",
    "darkblue": "#00008b",
    "darkcyan": "#008b8b",
    "darkgoldenrod": "#b8860b",
    "darkgray": "#a9a9a9",
    "darkgreen": "#006400",
    "darkgrey": "#a9a9a9",
    "darkkhaki": "#bdb76b",
    "darkmagenta": "#8b008b",
    "darkolivegreen": "#556b2f",
    "darkorange": "#ff8c00",
    "darkorchid": "#9932cc",
    "darkred": "#8b0000",
    "darksalmon": "#e9967a",
    "darkseagreen": "#8fbc8f",
    "darkslateblue": "#483d8b",
    "darkslategray": "#2f4f4f",
    "darkslategrey": "#2f4f4f",
    "darkturquoise": "#00ced1",
    "darkviolet": "#9400d3",
    "deeppink": "#ff1493",
    "deepskyblue": "#00bfff",
    "dimgray": "#696969",
    "dimgrey": "#696969",
    "dodgerblue": "#1e90ff",
    "firebrick": "#b22222",
    "floralwhite": "#fffaf0",
    "forestgreen": "#228b22",
    "fuchsia": "#ff00ff",
    "gainsboro": "#dcdcdc",
    "ghostwhite": "#f8f8ff",
    "goldenrod": "#daa520",
    "gold": "#ffd700",
    "gray": "#808080",
    "green": "#008000",
    "greenyellow": "#adff2f",
    "grey": "#808080",
    "honeydew": "#f0fff0",
    "hotpink": "#ff69b4",
    "indianred": "#cd5c5c",
    "indigo": "#4b0082",
    "ivory": "#fffff0",
    "khaki": "#f0e68c",
    "lavenderblush": "#fff0f5",
    "lavender": "#e6e6fa",
    "lawngreen": "#7cfc00",
    "lemonchiffon": "#fffacd",
    "lightblue": "#add8e6",
    "lightcoral": "#f08080",
    "lightcyan": "#e0ffff",
    "lightgoldenrodyellow": "#fafad2",
    "lightgray": "#d3d3d3",
    "lightgreen": "#90ee90",
    "lightgrey": "#d3d3d3",
    "lightpink": "#ffb6c1",
    "lightsalmon": "#ffa07a",
    "lightseagreen": "#20b2aa",
    "lightskyblue": "#87cefa",
    "lightslategray": "#778899",
    "lightslategrey": "#778899",
    "lightsteelblue": "#b0c4de",
    "lightyellow": "#ffffe0",
    "lime": "#00ff00",
    "limegreen": "#32cd32",
    "linen": "#faf0e6",
    "magenta": "#ff00ff",
    "maroon": "#800000",
    "mediumaquamarine": "#66cdaa",
    "mediumblue": "#0000cd",
    "mediumorchid": "#ba55d3",
    "mediumpurple": "#9370db",
    "mediumseagreen": "#3cb371",
    "mediumslateblue": "#7b68ee",
    "mediumspringgreen": "#00fa9a",
    "mediumturquoise": "#48d1cc",
    "mediumvioletred": "#c71585",
    "midnightblue": "#191970",
    "mintcream": "#f5fffa",
    "mistyrose": "#ffe4e1",
    "moccasin": "#ffe4b5",
    "navajowhite": "#ffdead",
    "navy": "#000080",
    "oldlace": "#fdf5e6",
    "olive": "#808000",
    "olivedrab": "#6b8e23",
    "orange": "#ffa500",
    "orangered": "#ff4500",
    "orchid": "#da70d6",
    "palegoldenrod": "#eee8aa",
    "palegreen": "#98fb98",
    "paleturquoise": "#afeeee",
    "palevioletred": "#db7093",
    "papayawhip": "#ffefd5",
    "peachpuff": "#ffdab9",
    "peru": "#cd853f",
    "pink": "#ffc0cb",
    "plum": "#dda0dd",
    "powderblue": "#b0e0e6",
    "purple": "#800080",
    "rebeccapurple": "#663399",
    "red": "#ff0000",
    "rosybrown": "#bc8f8f",
    "royalblue": "#4169e1",
    "saddlebrown": "#8b4513",
    "salmon": "#fa8072",
    "sandybrown": "#f4a460",
    "seagreen": "#2e8b57",
    "seashell": "#fff5ee",
    "sienna": "#a0522d",
    "silver": "#c0c0c0",
    "skyblue": "#87ceeb",
    "slateblue": "#6a5acd",
    "slategray": "#708090",
    "slategrey": "#708090",
    "snow": "#fffafa",
    "springgreen": "#00ff7f",
    "steelblue": "#4682b4",
    "tan": "#d2b48c",
    "teal": "#008080",
    "thistle": "#d8bfd8",
    "tomato": "#ff6347",
    "turquoise": "#40e0d0",
    "violet": "#ee82ee",
    "wheat": "#f5deb3",
    "white": "#ffffff",
    "whitesmoke": "#f5f5f5",
    "yellow": "#ffff00",
    "yellowgreen": "#9acd32"
}

function degToRad(deg) {
    return deg * Math.PI / 180;
}