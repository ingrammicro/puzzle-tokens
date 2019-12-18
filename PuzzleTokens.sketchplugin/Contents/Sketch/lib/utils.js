@import "constants.js";
const Rectangle = require('sketch/dom').Rectangle

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


    // s:  "0 4px 16px 0 #000000"
    //  or 
    // s:  "inset 0 4px 16px #000000"
    static splitCSSShadow(src) {

        var inset = false
        if (src.indexOf("inset") >= 0) {
            inset = true
            src = src.replace("inset ", "")
        }

        src = src.replace(/(,{1}\s+)/g, ',').replace(/(\s+)/g, ' ')

        var pxFunc = function (s) {
            s = s.replace('px', '')
            return parseInt(s)
        }

        var items = src.split(' ')

        var spread = items.length > 4 ? pxFunc(items[3]) : 0
        var color = Utils.RGBAToHexA(items[items.length - 1])

        return {
            'inset': inset,
            'x': pxFunc(items[0]),
            'y': pxFunc(items[1]),
            'blur': pxFunc(items[2]),
            'spread': spread,
            'color': color
        }
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


    // str: white or #32333 or #12345678 or #112233 %10
    // opacity: see opacityToHex()
    static strToHEXColor(str, opacity = undefined) {
        // process #112233 %10
        if (str.includes("transparent")) {
            return "#FFFFFF" + Utils.opacityToHex(0)
        }
        if (str.includes(" ") && str.includes("%")) {
            const list = str.split(" ")
            str = Utils.stripStr(list[0]) + Utils.opacityToHex(list[1])
        }
        if (undefined != opacity) {
            str = Utils.stripStr(str) + Utils.opacityToHex(opacity)
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
        var task = NSTask.alloc().init();

        var pipe = NSPipe.alloc().init()
        task.setStandardOutput_(pipe);
        task.setStandardError_(pipe);
        task.setLaunchPath_(command);
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

        const sourcePath = app.context.plugin.url().URLByAppendingPathComponent("Contents").URLByAppendingPathComponent("Sketch").URLByAppendingPathComponent(resFolder).path() + "/" + scriptName

        let error = MOPointer.alloc().init()

        if (!fileManager.copyItemAtPath_toPath_error(sourcePath, targetPath, error)) {
            app.UI.alert('Can`t copy script', error.value().localizedDescription())
            return undefined
        }

        return targetPath

    }

}

