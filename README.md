# puzzle-tokens
Sketch.app plugin to apply design tokens (specified in LESS format) to Sketch layers (with shared styles)

### [Check this article to get familiar with the approach and working examples|https://medium.com/@akalenyuk/bringing-styles-preprocessing-to-sketch-9cdf0d0c49bd]

## Installation
1. Download [Puzzle Tokens plugin](https://github.com/ingrammicro/puzzle-tokens/raw/master/PuzzleTokens.sketchplugin.zip)
2. Unarchive and install
3. Download and install [Node.js](https://nodejs.org/en/download/)
4. Instal _less_ using the following Terminal commands:
```
sudo -s  
npm i less -g 
```
5. Now you're good to go!

## Usage
1. Download [Example 1](https://github.com/ingrammicro/puzzle-tokens/raw/master/Examples/One.zip) and unarchive it into some local folder.
2. Open Widget Library.sketch file in Sketch.app
3. Run Plugins > Puzzle Tokens > Apply Design Tokens menu command
4. Specify LESS file according to screenshot

<img width="755" height="538" src="https://raw.githubusercontent.com/ingrammicro/puzzle-tokens/master/Examples/One/Illustration.png"/>

5. Repeat the same operation, but select "tokens-blue.less" file. See how styles and widgets look now.


## Features
The following styles are supporting.
```
// Text Layers

.TextStyle {
    font-size:             12px;   
    font-family:           Open Sans; // or "Open Sans","Times New Roman"
    font-weight:           bold;      // or extra-light, light, regular, medium, semibold, bold
    line-height:           1.0;       // or 1.2 or 1.5 or any other mulitplier for font-size
    color:                 #FFFFFF;
    opacity:               63%;       // supported "63%" or "0.42"
    text-transform:        uppercase; // "uppercase", "lowercase", and "none"
    text-align:            left;      // "left", center", "right", "justify"
    vertical-align:        top;       // "top", "middle", "bottom"
}

// Shape layers

ShapeStyle {
    background-color:      #B0AFB1;
    background-color:      linear-gradient(45deg, #B0AFB1,#B0AFB4);
    opacity:               63%;       // "63%" or "0.42"
    border-color:          #000000;
    border-width:          2px;
    border-position:       center;    // center or inside or outside
    
    // !!ATTENTION!!
    // Shared styles don't include radius property,
    // still you can set the radius-border for a style.
    // Border radius will be reapplied to layers
    // through style assigned to it. You can also
    // apply it to the layers or symbols directly.

    border-radius:         5px;
    border-radius:         5px 5px 0 0;

    box-shadow:            0 10px 20px 2 rgba(0,0,0,0.1);
    box-shadow:            inset 0 10px 20px 2 rgba(0,0,0,0.1);
}
```


You can [look into more examples](https://github.com/ingrammicro/puzzle-tokens/tree/master/Examples) to get familiar with the plugin.

## Sketch versions supported
Some styles, such as text font/transformation/etc require Sketch 53 or later. You're safe using the latest stable Sketch version to get the plugin working.
