# Change Log
See discussions on https://spectrum.chat/puzzle-tokens site

# Version 8.13.0 (26 Oct 2020)
Added support for mix-blend-mode CSS rule. 
Example: https://github.com/ingrammicro/puzzle-tokens/tree/master/Styles/Releases/8.13.0

##  Version 8.12.1 (10 Oct 2020)
Author: Josh Clark  (https://github.com/bigmedium)
Height/width dimensions have to be adjusted first, or bottom-margin and right-margin are incorrect.

##  Version 8.12.0 (15 Aug 2020)  (Цой жив)
Added configuration setting to define a custom path to SASS module

##  Version 8.11.0 (11 Aug 2020) 
Author: Josh Clark  (https://github.com/bigmedium)
1) Added support for gradients in border-color
2) When border-style is "none", apply no border style (or remove any existing border style if -pt-border-update is true)

##  Version 8.10.0 (6 Aug 2020) 
Author: Josh Clark  (https://github.com/bigmedium)
This update adds four new properties, which are specifically intended to be helpful for managing the spacing and size within buttons, for example.

Margin enhancements:

-pt-margin-relative-to: "layer name";
This sets margin values relative to the specified layer. The specified layer must be a sibling at the same level in a group, artboard, or symbol) of the layer to which you are applying the margin styles. If not specified, margin will be set relative to the artboard or page (which is the current behavior).

-pt-margin-resize: true;
If true, resize the "margin-relative-to" layer to "fit" the size of the current layer, plus the specified margin. This will make the "margin-relative-to" layer surround the current layer at exactly the requested margin. (Very helpful for effectively setting the padding of buttons and sizing the surrounding background layer to fit.)

Artboard/symbol resizing:

-pt-fit-content: true;
Applies only to artboards and symbol masters: if true, resize the artboard/symbol to fit its content.

-pt-resize-instances: true;
Applies only to symbol masters. If true, resize all instances of a symbol; the same as clicking Sketch's "Shrink instance to fit content" button in the Overrides section of the instance. (This reapplies SmartLayout, useful when you change the size of a symbol.)

##  Version 8.9.0 (26 June 2020)
Added new style 
-pt-text-size-behaviour: fixed-size; // or auto-height or auto-width

##  Version 8.8.4 (6 June 2020)
Hotfix

##  Version 8.8.3 (5 June 2020)
Improved diagnostic for missed Node.ls
User can change path to Node.js in Settings

##  Version 8.8.2 (4 June 2020)
Added ability to enable debug logging

##  Version 8.8.1 (2 June 2020)
Improved async mode for sending statistics

##  Version 8.8.0 (1 June 2020)
New ability:
`-pt-smartlayout: none` clears any smart layout on a symbol master or group (by @bigmedium)
Otjer:
Improved integration with Puzzle Publisher (many fixes in LESS tokens inspection)


##  Version 8.7.4 (28 May 2020)
Handle @import manually to inject tokens into all imported files

##  Version 8.7.3 (26 May 2020)
Update file protocol between Puzzle tokens and Puzzle Publisher

##  Version 8.7.2 (18 May 2020)
New text style should not get "default" borders (reported by @ed-mcry)

##  Version 8.7.1 (17 May 2020)
Disabled debug (hotfix for 8.7.0)

##  Version 8.7.0 (16 May 2020)
Changes:
1) If "box-shadow:none", clear any existing shadows from the layer style (by @bigmedium)
2) Added "-pt-shadow-update: true" property. Use it if you want to replace any previous shadows, instead of adding a new one. (by @bigmedium)
3) PT now sends anonymous usage data (using Google Analytics). You can disable it in Settings. But we need it enabled to plan PT future. Thanks.

##  Version 8.6.0 (05 May 2020)
Fixed "image:" property
Added support for SVG images
https://github.com/ingrammicro/puzzle-tokens/tree/master/Styles/Tests/Buttons

##  Version 8.5.1 (27 Apr 2020)
Hotfix for 8.5.0

##  Version 8.5.0 (27 Apr 2020)
1) Now you can use spaces in style and layer names.   
Old: .Colors__Red .Red__001{  
New: .Colors Red .Red 001{
2) Internal optimisations applied

##  Version 8.4.1 (24 Apr 2020)
Changes:
- Droped Check stage in order to improve total performance
Fixed issues:
- "sklayer-style" doesn't work
- Processing of LARGE scss file freezes

##  Version 8.3.5 (23 Apr 2020)
Fixed issues:
- Failed to parse LESS mixins. 
Example: https://github.com/ingrammicro/puzzle-tokens/blob/master/Styles/Releases/8.3.4/Test.less

##  Version 8.3.3 (23 Apr 2020)
Added "-pt-skip-missed: true;" rule.
Example: https://github.com/ingrammicro/puzzle-tokens/tree/master/Styles/Releases/8.3.3

##  Version 8.3.2 (19 Apr 2020)
New small features:
- Added abiity to exclude library styles from export
- SCSS parser now supports @charset "UTF-8"; instruction

Fixed issues:
- Apply something to master layer reset fills which were assigned before to layer style
- Checking for style name duplicates now process only local styles

##  Version 8.3.1 (19 Apr 2020)
Remove debug messages

##  Version 8.3.0 (17 Apr 2020)
New features:
- height: and width: are applicable to symbol masters and artboards
Fixed issues:
- /* comment */ breaks SAAS parsing

##  Version 8.2.0 (14 Apr 2020)
PT now generates assets for Puzzle Publisher in "_pt-assets" sub-folder
Export supports layer shadows

##  Version 8.1.1 (13 Apr 2020)
Fixed issues:
- Wrong handling of stop positions in style - background-color: linear-gradient(134deg, #004B3A 0%, #2D8B61 51%, #9BD77E 100%);

##  Version 8.1.0 (9 Apr 2020)
Export improved:
-  Color, font sized, family and weight values replaced by tokens
Fixed issues:
-  Generate Preview failed with error

##  Version 8.0.1 (8 Apr 2020)
Added new feature:
- Export text styles to LESS or SCSS file (thanks to @josh1111 for idea and sponsorship)
Added new styles:
-pt-resize-symbol: true; // if you use "height" or "width" styles to resize some layer then you can also resize a symbol which is a parent for affected layer
Fixed issues:
- Wrong parsing of gradient with "white 10%" text included

##  Version 7.0.0 (29 Mar 2020)
- Idenify object as Text Layer by single "line-height" property 
- Create SCSS file with list of plain tokens automatically (enabling in Settings)
- Added "-pt-border-update: true" property. Use it if you want to update the last border, but not create the new
- Fixed error handling
- Added "-pt-layer-type: text/layer" property. Use it if you need to specify a layer type manually
- Added "-pt-smartlayout: LeftToRight/HorizontallyCenter/RightToLeft/TopToBottom/VerticallyCenter/BottomToTop" propery to control Smart Layout settings from LESS/SASS
- Added "-pt-fix-size-height: true/false" to control "Fix Size" settings
- Added "-pt-fix-size-width: true/false" to control "Fix Size" settings
- Added "-pt-pin-left: true/false" to control "Pin to Edge" settings
- Added "-pt-pin-right: true/false" to control "Pin to Edge" settings
- Added "-pt-pin-top: true/false" to control "Pin to Edge" settings
- Added "-pt-pin-botom: true/false" to control "Pin to Edge" settings

##  Version 6.14.0 (23 Feb 2020)
Added support for hsl() and hsla() colors
Example: https://github.com/ingrammicro/puzzle-tokens/tree/master/Styles/Releases/6.14.0

##  Version 6.13.0 (21 Feb 2020)
Added command line API
Details: https://spectrum.chat/puzzle-tokens/general/6-13-0-released~913b6a70-b532-4a83-9bea-f2588427d22d

##  Version 6.12.1 (12 Feb 2020)
Fixed wrong behaviour of pt-paragraph-spacing

##  Version 6.12.0 (9 Feb 2020)
Added "pt-paragraph-spacing" style property to setup Paragraph Spacing
Example: https://github.com/ingrammicro/puzzle-tokens/tree/master/Styles/Releases/6.12.0

##  Version 6.11.0 (9 Feb 2020)
Added experimental support for symbols creation.
More details here: - https://spectrum.chat/puzzle-tokens/general/6-11-0-released~b1d89588-290b-4c5f-93e0-4993e3cf45eb

##  Version 6.10.0 (16 Jan 2020)
Added new layer/style properties:

margin-top:             10px;
margin-left:            10px;
width:                  100px;
height:                 100px;  

Example: https://github.com/ingrammicro/puzzle-tokens/tree/master/Styles/Releases/6.9.0

##  Version 6.9.0 (11 Jan 2020)
- Added new line styles:
border-start-arrowhead:     openarrow; // none / openarrow / filledarrow / opencircle / filledcircle / opensquare / filledsquare
border-end-arrowhead:       openarrow; // none / openarrow / filledarrow / opencircle / filledcircle / opensquare / filledsquare                  

Example: https://github.com/ingrammicro/puzzle-tokens/tree/master/Styles/Releases/6.8.0

##  Version 6.8.0 (10 Jan 2020)
- Added new line styles:
border-line-end:       butt;      // butt OR round OR projecting
border-line-join:      miter;     // miter OR round OR bevel
- Fixed minor layout issue in Styles Overview Generator

##  Version 6.7.1 (27 Dec 2019)
- Fixed issue with multiply shadows

##  Version 6.7.0 (27 Dec 2019)
- Support for multiply shadows. Example: box-shadow: 0 3px 20px 0 rgba(0,0,0,0.12), 0 2px 7px 0 rgba(0,0,0,0.20);

Example: https://github.com/ingrammicro/puzzle-tokens/tree/master/Styles/Releases/6.7.0

##  Version 6.6.3 (26 Dec 2019)
- Fixed assignment of text styles
- Now shared style from any enabled library can be assigned

##  Version 6.6.1 (25 Dec 2019)
- Updated saving of LESS token values

##  Version 6.6.0 (21 Dec 2019)
- Added sklayer-style: and sktext-style: CSS properties

##  Version 6.5.2 (19 Dec 2019)
- Fixed issue with the identical name for symbol instance and symbol master
- Changed command line API for internal scrips (working on less plugins support)

##  Version 6.5.1 (13 Dec 2019)
- Fixed typo

##  Version 6.5.0 (12 Dec 2019)
- Checking for style name duplicates is disabled in default configuration
- Added support for Puzzle Publisher page transition animations

##  Version 6.4.0 (5 Dec 2019)
- Supported colors in "#AABBCC 50%" format

##  Version 6.3.2 (4 Dec 2019)
- Don't show error if empty content come from styles rule

##  Version 6.3.1 (27 Nov 2019)
- Border-style: dotted OR dashed now uses border-width (if exists) (by @mikebronner)
- Show error if found multiple styles with the same name

##  Version 6.3.0 (25 Nov 2019)
- Support for border-style: dotted OR dashed

##  Version 6.2.2 (21 Nov 2019)
- Always reset borders, fills and shadows for style on the fist apply
- Set line-height on first font-size definition
- Specified homepage parameter in manifest (by @abynim)

##  Version 6.2.1 (21 Nov 2019)
- Removed label borders in Preview
- Removed trailed FF in description in Preview

##  Version 6.2.0 (19 Nov 2019)
- Added support for line-spacing
- Added support for text-decoration
- Added support for standaldone opacity
- Other improvements

##  Version 6.1.1 (18 Nov 2019)
- Added missing font weights (by @mikebronner) - TRY #2
- Added style sorting to Styles Overview (can be disabled on Advanced tab)
- Added layer style descriptions

##  Version 6.1.0 (18 Nov 2019)
- Added support for font-style: italic OR normal
- Fixed multiply borders
- Added missing font weights (by @mikebronner)

##  Version 6.0.1 (16 Nov 2019)
- Fixed missed shared style for layers styles

##  Version 6.0.0 (15 Nov 2019)
- Added Style Overview Generator

##  Version 5.3.2 (13 Nov 2019)
- Fixed relative line-height

##  Version 5.3.1 (12 Nov 2019)
- Fixed crash on new installation

##  Version 5.3.0 (11 Nov 2019)
- Added "Created X styles. Updated Y styles" summary info to Apply and Quck Apply
- Made result dialog wider
- Added support for line-height in pixels
- Added support for multiply borders ( and shadows(hacky))

##  Version 5.2.0 (6 Nov 2019)
- Added ability to set opacity for symbol child layers (https://github.com/ingrammicro/puzzle-tokens/tree/master/Examples/Opacity)
- Moved Show Debug and Generate Symbol Files options to Configure dialog
- Relayouted dialogs
- Added "Check changes before" option

##  Version 5.1.1 (5 Nov 2019)
- Fixed border-radius with multi(4) values

##  Version 5.1.0 (4 Nov 2019)
- Added "Quck Apply" command
- Support for "Node/Node/Node" layer name format additonally to "Node / Node / Node"

##  Version 5.0.0 (31 Oct 2019)
- Support for SASS

##  Version 4.1.2 (23 Oct 2019)
- Don't reset border position if it was undefined in tokens

##  Version 4.1.1 (23 Oct 2019)
- Don't reset border position if it was undefined in tokens

##  Version 4.1.0 (21 Oct 2019)
- Resurrected "image" rule

##  Version 4.0.4 (18 Oct 2019)
- Updated labels

##  Version 4.0.3 (16 Oct 2019)
- Fixed inner shadows
- Supported spacec in layers name

##  Version 4.0.2 (16 Oct 2019)
- Added support for background-color: linear-gradient(35deg,black,white,red);
- Added ability to address some layer inside a master symbol (without shared style touching)
  Format: 
    #Controls #Buttons .Group .Text{
        color: white;
    }
    "Controls / Buttons" is symbol master name
        "Group" - layer inside a master
            "Text" - layer inside a "Group" 

##  Version 4.0.1 (14 Oct 2019)
- hotfix for 4.0.0

##  Version 4.0.0 (14 Oct 2019)
Totally new version. Critical changes:
- LESS to Sketch rules now are describing in LESS file too. No more JSON here.
- Renamed many properties in order to use CSS names as much as possible
- Added debug window
- Addded multuply error checks

##  Version 3.1.3 (7 Oct 2019)
- Diagnostic of JSON comments has been improved

##  Version 3.1.2 (7 Oct 2019)
- Diagnostic of JSON errors has been improved

##  Version 3.1.1 (19 Sep 2019)
- Diagnostic of LESS errors has been improved

##  Version 3.1.0 (18 Sep 2019)
- Reworked fill color gradient format

##  Version 3.0.2 (16 Sep 2019)
- Improved error handling 

##  Version 3.0.1 (13 Sep 2019)
- Updated plugin icon

##  Version 3.0.0 (21 Aug 2019)
- moved from https://github.com/MaxBazarov/design-system
