# Change Log

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
