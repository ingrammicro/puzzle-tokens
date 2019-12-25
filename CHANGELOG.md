# Change Log

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
