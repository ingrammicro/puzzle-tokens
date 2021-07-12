@import "constants.js";
var DEBUG = Constants.LOGGING || require('sketch/settings').settingForKey(SettingKeys.PLUGIN_LOGDEBUG_ENABLED)

Rectangle.prototype.round = function () {
    this.x = Math.round(this.x)
    this.y = Math.round(this.y)
    this.height = Math.round(this.height)
    this.width = Math.round(this.width)
}

Rectangle.prototype.insideRectangle = function (r) {
    return this.x >= r.x && this.y >= r.y
        && ((this.x + this.width) <= (r.x + r.width))
        && ((this.y + this.height) <= (r.y + r.height))
}

Rectangle.prototype.copy = function () {
    return new Rectangle(this.x, this.y, this.width, this.height)
}
Rectangle.prototype.copyToRect = function () {
    return NSMakeRect(this.x, this.y, this.width, this.height)
}

class Utils {
    static askPath(currentPath = null, buttonName = "Select") {
        let panel = NSOpenPanel.openPanel()
        panel.setTitle("Choose a location...")
        panel.setPrompt(buttonName)
        panel.setCanChooseDirectories(true)
        panel.setCanChooseFiles(false)
        panel.setAllowsMultipleSelection(false)
        panel.setShowsHiddenFiles(false)
        panel.setExtensionHidden(false)
        if (currentPath != null && currentPath != undefined) {
            let url = [NSURL fileURLWithPath: currentPath]
            panel.setDirectoryURL(url)
        }
        const buttonPressed = panel.runModal()
        const newURL = panel.URL()
        panel.close()
        panel = null
        if (buttonPressed == NSFileHandlingPanelOKButton) {
            return newURL.path() + ''
        }
        return null
    }

    static askFilePath(currentPath = null, buttonName = "Select") {
        let panel = NSOpenPanel.openPanel()
        panel.setTitle("Choose a file...")
        panel.setPrompt(buttonName)
        panel.setCanChooseDirectories(false)
        panel.setCanChooseFiles(true)
        panel.setAllowsMultipleSelection(false)
        panel.setShowsHiddenFiles(false)
        panel.setExtensionHidden(false)
        if (currentPath != null && currentPath != undefined) {
            let url = [NSURL fileURLWithPath: currentPath]
            panel.setDirectoryURL(url)
        }
        const buttonPressed = panel.runModal()
        const newURL = panel.URL()
        panel.close()
        panel = null
        if (buttonPressed == NSFileHandlingPanelOKButton) {
            return newURL.path() + ''
        }
        return null
    }

    static writeToFile(str, filePath) {
        const objcStr = NSString.stringWithFormat("%@", str);
        return objcStr.writeToFile_atomically_encoding_error(filePath, true, NSUTF8StringEncoding, null);
    }

    static readFile(path) {
        return NSString.stringWithContentsOfFile_encoding_error(path, NSUTF8StringEncoding, null);
    }

    static fileExistsAtPath(filePath) {
        const fileManager = NSFileManager.defaultManager();
        return fileManager.fileExistsAtPath(filePath);
    }

    static deleteFile(filePath) {
        const fileManager = NSFileManager.defaultManager();

        let error = MOPointer.alloc().init();
        if (fileManager.fileExistsAtPath(filePath)) {
            if (!fileManager.removeItemAtPath_error(filePath, error)) {
                log(error.value().localizedDescription());
            }
        }
    }

    static RGBAStructToRGBAStr(rgba) {
        return "rgba(" + rgba.join(",") + ")"
    }

    static RGBAToHexA(rgba) {
        if (rgba.startsWith('#')) return rgba

        let sep = rgba.indexOf(",") > -1 ? "," : " ";
        rgba = rgba.substr(5).split(")")[0].split(sep);
        //log("RGBAToHexA ")
        //log(rgba )

        // Strip the slash if using space-separated syntax
        if (rgba.indexOf("/") > -1)
            rgba.splice(3, 1);

        for (let R in rgba) {
            let r = rgba[R];
            if (r.indexOf("%") > -1) {
                let p = r.substr(0, r.length - 1) / 100;

                if (R < 3) {
                    rgba[R] = Math.round(p * 255);
                } else {
                    rgba[R] = p;
                }
            }
        }

        let r = (+rgba[0]).toString(16),
            g = (+rgba[1]).toString(16),
            b = (+rgba[2]).toString(16),
            a = Math.round(+rgba[3] * 255).toString(16);

        if (r.length == 1)
            r = "0" + r;
        if (g.length == 1)
            g = "0" + g;
        if (b.length == 1)
            b = "0" + b;
        if (a.length == 1)
            a = "0" + a;

        return "#" + r + g + b + a;
    }

    // tries to split >> 0 7px 40px 0 rgba(0,0,0,0.13), 0 2px 8px 0 rgba(0,0,0,0.24) <<
    // return array of {}
    static splitCSSShadows(src) {
        const parsed = Utils.parseBoxShadow(src)
        return parsed.map(s => Utils.splitCSSShadow(s))
    }

    // > object from parseBoxShadow()
    static splitCSSShadow(s) {
        return {
            'enabled': true,
            'type': 'Shadow',
            'inset': s.inset,
            'x': s.offsetX,
            'y': s.offsetY,
            'blur': s.blurRadius,
            'spread': s.spreadRadius,
            'color': Utils.RGBAToHexA(s.color)
        }
    }

    // thanks to https://github.com/jxnblk/css-box-shadow
    // [{ inset: false,
    //   offsetX: 0,
    //   offsetY: 0,
    //   blurRadius: 0,
    //   spreadRadius: 32,
    //   color: 'tomato' }]
    static parseBoxShadow(str) {
        //  do workaround to support invalid REGEXP
        str = str.replace(/\(/g, "X").replace(/\)/g, "Z")

        const isLength = v => v === '0' || LENGTH_REG.test(v)
        const toNum = v => {
            if (!/px$/.test(v) && v !== '0') return v
            const n = parseFloat(v)
            return !isNaN(n) ? n : v
        }
        const toPx = n => typeof n === 'number' && n !== 0 ? (n + 'px') : n

        const LENGTH_REG = /^[0-9]+[a-zA-Z%]+?$/
        const VALUES_REG = /,(?![^X]*Z)/
        const PARTS_REG = /\s(?![^X]*Z)/
        //const VALUES_REG = /,(?![^\(]*\))/
        //const PARTS_REG = /\s(?![^(]*\))/


        const parseValue = str => {
            const parts = str.split(PARTS_REG)
            const inset = parts.includes('inset')
            const last = parts.slice(-1)[0]
            let color = !isLength(last) ? last : ""
            //  reverse workaround to support invalid REGEXP
            color = color.replace(/X/g, "(").replace(/Z/g, ")")

            const nums = parts
                .filter(n => n !== 'inset')
                .filter(n => n !== color)
                .map(toNum)
            const [offsetX, offsetY, blurRadius, spreadRadius] = nums

            return {
                inset,
                offsetX,
                offsetY,
                blurRadius,
                spreadRadius,
                color
            }
        }

        return str.split(VALUES_REG).map(s => s.trim()).map(parseValue)
    }


    static hexColorToRGBA(hex) {
        return {
            r: parseInt(hex.substr(1, 2), 16),
            g: parseInt(hex.substr(3, 2), 16),
            b: parseInt(hex.substr(5, 2), 16),
            a: parseInt(hex.substr(7, 2), 16)
        }
    }

    // it will drop optional opacity
    static invertHexColor(hex) {
        hex = hex.substr(0, 7)
        return '#' + hex.match(/[a-f0-9]{2}/ig).map(e => (255 - parseInt(e, 16) | 0).toString(16).replace(/^([a-f0-9])$/, '0$1')).join('')
    }

    // source: https://codepen.io/jkantner/pen/VVEMRK    
    static HSLAToHexA(hsla) {
        let ex = /^hsla\(((((([12]?[1-9]?\d)|[12]0\d|(3[0-5]\d))(\.\d+)?)|(\.\d+))(deg)?|(0|0?\.\d+)turn|(([0-6](\.\d+)?)|(\.\d+))rad)(((,\s?(([1-9]?\d(\.\d+)?)|100|(\.\d+))%){2},\s?)|((\s(([1-9]?\d(\.\d+)?)|100|(\.\d+))%){2}\s\/\s))((0?\.\d+)|[01]|(([1-9]?\d(\.\d+)?)|100|(\.\d+))%)\)$/i;
        if (ex.test(hsla)) {
            let sep = hsla.indexOf(",") > -1 ? "," : " ";
            hsla = hsla.substr(5).split(")")[0].split(sep);

            // strip the slash
            if (hsla.indexOf("/") > -1)
                hsla.splice(3, 1);

            let h = hsla[0],
                s = hsla[1].substr(0, hsla[1].length - 1) / 100,
                l = hsla[2].substr(0, hsla[2].length - 1) / 100,
                a = hsla[3];

            // strip label and convert to degrees (if necessary)
            if (h.indexOf("deg") > -1)
                h = h.substr(0, h.length - 3);
            else if (h.indexOf("rad") > -1)
                h = Math.round(h.substr(0, h.length - 3) * (180 / Math.PI));
            else if (h.indexOf("turn") > -1)
                h = Math.round(h.substr(0, h.length - 4) * 360);
            if (h >= 360)
                h %= 360;

            // strip % from alpha, make fraction of 1 (if necessary)
            if (a.indexOf("%") > -1)
                a = a.substr(0, a.length - 1) / 100;

            let c = (1 - Math.abs(2 * l - 1)) * s,
                x = c * (1 - Math.abs((h / 60) % 2 - 1)),
                m = l - c / 2,
                r = 0,
                g = 0,
                b = 0;

            if (0 <= h && h < 60) {
                r = c; g = x; b = 0;
            } else if (60 <= h && h < 120) {
                r = x; g = c; b = 0;
            } else if (120 <= h && h < 180) {
                r = 0; g = c; b = x;
            } else if (180 <= h && h < 240) {
                r = 0; g = x; b = c;
            } else if (240 <= h && h < 300) {
                r = x; g = 0; b = c;
            } else if (300 <= h && h < 360) {
                r = c; g = 0; b = x;
            }
            r = Math.round((r + m) * 255).toString(16);
            g = Math.round((g + m) * 255).toString(16);
            b = Math.round((b + m) * 255).toString(16);
            a = Math.round(a * 255).toString(16);

            if (r.length == 1)
                r = "0" + r;
            if (g.length == 1)
                g = "0" + g;
            if (b.length == 1)
                b = "0" + b;
            if (a.length == 1)
                a = "0" + a;

            return "#" + r + g + b + a;
        } else {
            app.logError("HSLAToHexA() Invalid input color: " + hsla)
            return "#000000FF"
        }
    }

    // source: https://codepen.io/jkantner/pen/VVEMRK    
    static HSLToHex(hsl) {
        let ex = /^hsl\(((((([12]?[1-9]?\d)|[12]0\d|(3[0-5]\d))(\.\d+)?)|(\.\d+))(deg)?|(0|0?\.\d+)turn|(([0-6](\.\d+)?)|(\.\d+))rad)((,\s?(([1-9]?\d(\.\d+)?)|100|(\.\d+))%){2}|(\s(([1-9]?\d(\.\d+)?)|100|(\.\d+))%){2})\)$/i;
        if (ex.test(hsl)) {
            let sep = hsl.indexOf(",") > -1 ? "," : " ";
            hsl = hsl.substr(4).split(")")[0].split(sep);

            let h = hsl[0],
                s = hsl[1].substr(0, hsl[1].length - 1) / 100,
                l = hsl[2].substr(0, hsl[2].length - 1) / 100;

            // strip label and convert to degrees (if necessary)
            if (h.indexOf("deg") > -1)
                h = h.substr(0, h.length - 3);
            else if (h.indexOf("rad") > -1)
                h = Math.round(h.substr(0, h.length - 3) * (180 / Math.PI));
            else if (h.indexOf("turn") > -1)
                h = Math.round(h.substr(0, h.length - 4) * 360);
            if (h >= 360)
                h %= 360;

            let c = (1 - Math.abs(2 * l - 1)) * s,
                x = c * (1 - Math.abs((h / 60) % 2 - 1)),
                m = l - c / 2,
                r = 0,
                g = 0,
                b = 0;

            if (0 <= h && h < 60) {
                r = c; g = x; b = 0;
            } else if (60 <= h && h < 120) {
                r = x; g = c; b = 0;
            } else if (120 <= h && h < 180) {
                r = 0; g = c; b = x;
            } else if (180 <= h && h < 240) {
                r = 0; g = x; b = c;
            } else if (240 <= h && h < 300) {
                r = x; g = 0; b = c;
            } else if (300 <= h && h < 360) {
                r = c; g = 0; b = x;
            }
            // having obtained RGB, convert channels to hex
            r = Math.round((r + m) * 255).toString(16);
            g = Math.round((g + m) * 255).toString(16);
            b = Math.round((b + m) * 255).toString(16);

            // prepend 0s if necessary
            if (r.length == 1)
                r = "0" + r;
            if (g.length == 1)
                g = "0" + g;
            if (b.length == 1)
                b = "0" + b;

            return "#" + r + g + b;

        } else {
            app.logError("HSLToHex() Invalid input color: " + hsl)
            return "#000000"
        }
    }

    // str: white or #32333 or #12345678 or #112233 %10
    // opacity: see opacityToHex()
    static strToHEXColor(str, opacity = undefined) {
        // process #112233 %10
        if (str.includes("transparent")) {
            return "#FFFFFF" + Utils.opacityToHex(0)
        }
        if (str.startsWith('"')) {
            const swatchName = str.substr(1, str.length - 2)
            var swatches = app.sDoc.swatches
            var s = swatches.find(sw => sw.name == swatchName)
            if (!s) {
                app.logError("strToHEXColor() Can not find color variable named as \"" + swatchName + "\"")
                return "black"
            }
            return s.referencingColor
        }
        if (str.toLowerCase().includes("hsla")) {
            str = Utils.HSLAToHexA(str)
        } else if (str.toLowerCase().includes("hsl")) {
            str = Utils.HSLToHex(str)
        } else if (str.toLowerCase().includes("rgba")) {
            str = Utils.RGBAToHexA(str)
        }
        if (str.includes(" ") && str.includes("%")) {
            const list = str.split(" ")
            let color = Utils.stripStr(list[0])
            // convert color from "white" to "#ffffff"
            if (!color.startsWith("#")) {
                if (color in COLOR_NAMES)
                    color = COLOR_NAMES[color]
            }
            str = color + Utils.opacityToHex(list[1])
        }
        if (undefined != opacity) {
            str = Utils.stripStr(str);
            // convert color from "white" to "#ffffff"
            if (!str.startsWith("#")) {
                if (str in COLOR_NAMES)
                    str = COLOR_NAMES[str]
            }
            str = str + Utils.opacityToHex(opacity)
        }
        return str
    }

    // opacity: 0 .. 1.0(transparent) or 0(transparent)..100%
    static opacityToHex(opacity) {
        if (typeof opacity == 'string' && opacity.indexOf("%") >= 0) {
            opacity = opacity.replace("%", "")
            opacity = parseInt(opacity) / 100
        }

        var i = Math.round(opacity * 100) / 100;

        var alpha = Math.round(i * 255);
        var hex = (alpha + 0x10000).toString(16).substr(-2).toUpperCase();
        return hex
    }


    // opacity: 0 .. 1.0(transparent) or 0(transparent)..100% to 1.0 
    static cssOpacityToSketch(opacity) {
        if (typeof opacity == 'string' && opacity.indexOf("%") >= 0) {
            opacity = opacity.replace("%", "")
            opacity = parseInt(opacity) / 100
        }
        return parseFloat(opacity)
    }

    static stripStr(str) {
        return str.replace(/^\s+|\s+$/g, '');
    }

    static cloneDict(dict) {
        return Object.assign({}, dict);
    }


    static copyRect(rect) {
        return NSMakeRect(rect.origin.x, rect.origin.y, rect.size.width, rect.size.height)
    }

    // rect: GRect instnct
    static copyRectToRectangle(rect) {
        return new Rectangle(rect.x(), rect.y(), rect.width(), rect.height())
    }

    // rect: Rectangle instance
    static transformRect(rect, cw, ch) {
        rect.x = rect.x * cw
        rect.y = rect.y * ch
        rect.width = rect.width * cw
        rect.width = rect.height * ch
    }

    static quoteString(str) {
        return str.split('"').join('\\"')
    }

    static toFilename(name, dasherize = true) {
        if (dasherize == null) {
            dasherize = true;
        }
        const dividerCharacter = dasherize ? "-" : "_"
        return name.replace(/[/]/g, "").replace(/[\s_-]+/g, dividerCharacter).toLowerCase()
    }


    static getArtboardGroups(artboards, context) {
        const artboardGroups = [];

        artboards.forEach(function (artboard) {
            // skip marked by '*'
            if (artboard.name().indexOf("*") == 0) {
                return
            }
            artboardGroups.push([{ artboard: artboard, baseName: artboard.name() }]);
        });
        return artboardGroups;
    }



    static isSymbolsPage(page) {
        return page.artboards()[0].isKindOfClass(MSSymbolMaster);
    }

    static removeFilesWithExtension(path, extension) {
        const error = MOPointer.alloc().init();
        const fileManager = NSFileManager.defaultManager();
        const files = fileManager.contentsOfDirectoryAtPath_error(path, null);
        files.forEach(function (file) {
            if (file.pathExtension() == extension) {
                if (!fileManager.removeItemAtPath_error(path + "/" + file, error)) {
                    log(error.value().localizedDescription());
                }
            }
        });
    }


    static runCommand(command, args) {
        if (DEBUG) {
            log(command + " " + args.join(" "))
        }

        // check if launch path exists
        if (!Utils.fileExistsAtPath(command)) {
            return {
                result: false,
                output: command + "does not exists"
            }
        }

        var task = NSTask.alloc().init();
        var pipe = NSPipe.alloc().init()
        task.setStandardOutput_(pipe);
        task.setStandardError_(pipe);
        task.setLaunchPath(command);
        task.arguments = args;
        task.launch();
        task.waitUntilExit();

        var fileHandle = pipe.fileHandleForReading()
        var data = [fileHandle readDataToEndOfFile];
        var outputString = [[NSString alloc] initWithData: data encoding: NSUTF8StringEncoding];

        return {
            result: (task.terminationStatus() == 0),
            output: outputString
        }
    }

    static getPathToTempFolder() {
        const fileManager = NSFileManager.defaultManager()
        return fileManager.temporaryDirectory().path() + ""
    }

    static copyScript(scriptName, pathTo) {

        const fileManager = NSFileManager.defaultManager()

        const resFolder = Constants.RESOURCES_FOLDER
        const targetPath = pathTo + "/" + scriptName

        // delete old copy
        Utils.deleteFile(targetPath)

        const sourcePath = app.context.plugin.url().URLByAppendingPathComponent("Contents").URLByAppendingPathComponent("Sketch").URLByAppendingPathComponent(resFolder).URLByAppendingPathComponent(scriptName)

        let error = MOPointer.alloc().init()


        if (!fileManager.copyItemAtPath_toPath_error(sourcePath, targetPath, error)) {
            app.logError('Can`t copy script', error.value().localizedDescription())
            return undefined
        }

        return targetPath

    }


    static createFolder(path) {
        let error;
        const fileManager = NSFileManager.defaultManager();

        if (fileManager.fileExistsAtPath(path)) {
            return true
        }
        error = MOPointer.alloc().init();
        if (!fileManager.createDirectoryAtPath_withIntermediateDirectories_attributes_error(path, true, null, error)) {
            log(error.value().localizedDescription());
        }
        return true

    }
}

