var fs = require('fs');
var nodePath = require('path');


const args = parseArgs(process.argv.slice(2))
var pathToSass = args['-styles']
var pathToJSON = args['-json']
var argsPathToSassModule = args['-sassmodule']
var sassPath = ''
var sketchRules = []

/////////////////////////////////////////////
console.log("Started")

// INIT DATA
if (!initPaths()) process.exit(0)

// LOAD LESS
var strSrcSass = loadSassFromFiles(pathToSass)
if (null == strSrcSass) process.exit(-1)

// SAVE TOKENS AS COMMENTS IN SASS
var strSass = injectTokensIntoSass(strSrcSass)

// RENDER SASS TO JSON
transformSASStoJSON(strSass)

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function parseArgs(args) {
    let list = []
    args.forEach(function (arg) {
        const v = arg.split("=")
        if (0 == v.length) return
        list[v[0]] = v[1]
    })
    return list
}

function initPaths() {
    if (undefined == pathToSass) {
        console.log("nsconvert_sass.js PATH_TO_SAAS_FILE PATH_TO_JSON_FILE")
        return false
    }

    // REMOVE OLD RESULTS
    if (pathToJSON && fs.existsSync(pathToJSON)) {
        fs.unlinkSync(pathToJSON)
    }

    // CHANGE CURRENT PATH TO LESS FOLDER TO ENABLE IMPORTS
    sassPath = nodePath.dirname(pathToSass)
    process.chdir(sassPath)

    return true
}

function injectTokensIntoSass(srcData) {
    var sassLines = srcData.split("\n")
    var newData = ""

    sassLines.forEach(function (line) {

        // drop comment lines
        line = line.trim()
        if (line.startsWith("//")) return

        var found = line.match(/\${1}([\w-]*)\w{0,};/)
        if (null != found && found.length >= 1) {
            var token = found[1]
            var commentPos = line.indexOf("//")
            if (commentPos > 0) {
                line = line.substring(0, commentPos)
            }
            line += " //!" + token + "!"
        }
        newData += line + "\n"
    })

    return newData
}

function loadSassFromFiles(fileName1, fileName2) {
    console.log("Read SASS: running...")

    var data = ''
    const data1 = fs.readFileSync(fileName1, 'utf8');
    if (null == data1) {
        console.log("Can't open file by path:" + fileName1)
        return null
    }
    data = data + data1;
    if (fileName2 != undefined) {
        data = data + "\n" + fs.readFileSync(fileName2, 'utf8');
    }

    return data
}

function transformSASStoJSON(data) {
    var pathToSassModule = _getpathToSassModule()
    console.log(pathToSassModule)
    var sass = require(pathToSassModule)

    process.on('unhandledRejection', error => {
        // Will print "unhandledRejection err is not defined"
        console.log('Failed to parse SASS with error message:', error.message);
        process.exit(-1)
    });


    try {
        result = sass.renderSync({
            data: data,
            outputStyle: "expanded"
        })
        console.log("Completed")
        saveData(result.css.toString(), pathToJSON)
        console.log("Saved")

    } catch (e) {
        console.log("Failed to parse SASS with error message:\n")
        console.log(e.message)
        process.exit(-1)
    }

    //console.log(sketchRules)


    console.log("Read SASS: done")
}


function saveData(strCSS, pathToJSON) {
    var data = []
    console.log("CSS:")
    //console.log(strCSS)
    //console.log("-------------------")

    //
    var sassLines = strCSS.split("\n")
    var node = null
    var inComments = false
    sassLines.forEach(function (line) {
        //console.log(line)
        if (line.startsWith("/*") && line.endsWith("*/")) {
        } else if (line.startsWith("/*")) {
            inComments = true
        } else if (line.startsWith("*/")) {
            inComments = false
        } else if (inComments) {
            // skip comment
        } else if (line.endsWith("{")) {
            // start node declaration
            const paths = line.replace(" {", "").split(' ').join("*")
            node = {
                path: paths,
                props: {
                    "__tokens": {
                    }
                }
            }
        } else if (line.endsWith("}")) {
            // complete node declaration
            data.push(node)
        } else if (node) {
            // save css rule
            line = line.replace(/^(\s*)/, "")
            var ruleName = line.replace(/(:+\s+.+;+)/, "")
            var ruleValue = line.replace(/(\S+\s+)/, "").replace(/(;+)$/, "")
            node.props[ruleName] = ruleValue
        }
    })
    //

    var json = JSON.stringify(data, null, '    ')

    if (pathToJSON && pathToJSON != '') {
        fs.writeFileSync(pathToJSON, json, 'utf8');
    } else {
        //console.log(json)
    }

    return true
}

function _getpathToSassModule() {
    var path = ""
    if (argsPathToSassModule !== undefined && argsPathToSassModule != "")
        path = argsPathToSassModule
    else {
        var result = require('child_process').execSync("node /usr/local/bin/npm -g root", { env: process.env.PATH })
        path = result.toString().replace("\n", "")
    }
    return path + "/sass"
}