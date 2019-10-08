var fs = require('fs');

const args = process.argv.slice(2)
var pathToLess1 = args[0]
var pathToLess2 = args[1]
var pathToJSON = args[2]
var lessVars = {}
var sketchRules = []

if(undefined==pathToLess1 || undefined==pathToLess2 ){
    console.log("nsconvert.js PATH_TO_LESS_FILE1 PATH_TO_LESS_FILE2(OPT) PATH_TO_JSON_FILE")
    return false
}
if(undefined == pathToJSON){
    pathToJSON = pathToLess2
    pathToLess2 = undefined
}

/*console.log("Path to source LESS:" +pathToLess1)
if(pathToLess2!=undefined)
    console.log("pathToLess2:" +pathToLess2)
console.log("Path to destination JSON:" +pathToJSON)
console.log("")*/

console.log("Started")

loadLessVars(pathToLess1,pathToLess2)    

function loadLessVars(fileName1,fileName2){
    console.log("Read LESS: running...")
    
    var less = require("/usr/local/lib/node_modules/less")   

    var data = ''
    const data1 = fs.readFileSync(fileName1, 'utf8');
    if(null==data1){
        console.log("Can't open file by path:"+fileName1)
        return lessVars
    }
    data = data + data1;
    if(fileName2!=undefined){
        data = data + "\n"+fs.readFileSync(fileName2, 'utf8');
    }

    options1 = { 
        async: false,
        fileAsync: false
    }

    try {
        less.parse(data, options1, function (err, root, imports, options) {
            //console.log(imports)
            if(undefined!=err) console.log(err)
            
            var evalEnv = new less.contexts.Eval(options);
            var evaldRoot = root.eval(evalEnv);
            var ruleset = evaldRoot.rules;

            ruleset.forEach(function (rule) {                            
                if(rule.isLineComment){
                    return
                }else if (rule.variable === true) {                
                    var name;
                    name = rule.name.substr(1);					

                    var value = rule.value;
                    lessVars[name] = value.toCSS(options);				

                    console.log(name+" : "+value.toCSS(options))
                }else{                                 
                    parseSketchRule(rule,null,[])                                      
                }
            });
            //console.log("----------------------------------------")
            //console.log(lessVars)
            
            // completed
            //saveData(lessVars,pathToJSON)
            saveData(sketchRules,pathToJSON)
            console.log("Completed")
        });
    } catch ( e ) {
        console.log("Failed to parse LESS with error message:\n")
        console.log(e.message)
        process.exit(-1)
    }
    
    console.log("Read LESS: done")
    return lessVars
}


function parseSketchRule(rule,elements,path){
    //console.log("----------------- parseSketchRule -----------------------")
    //console.log(rule)

    if(null!=elements){
        elements.forEach(function (el) { 
            path = path.concat([el.value])
        })
    }else{
        if(rule.selectors!=null && rule.selectors.length>0){
            rule.selectors.forEach(function (sel) {
                parseSketchRule(rule,sel.elements,path)
            })
            return
        }
    }
    ///
    if( rule.rules && !(rule.rules[0].rules)){
        saveSketchRule(rule,path)
    }else if( rule.rules ){
        rule.rules.forEach(function (oneRule) { 
            parseSketchRule(oneRule,null,path)
        })
    }
}

function saveSketchRule(rule,path){
    var sketchPath = path.join("/")
    //console.log(sketchPath)
    sketchPath = sketchPath.replace(/(\.)/g, '').replace(/^\./,'')
    const sketchRule = {
        path: sketchPath,
        props: {
            __lessTokens:{}
        }
    }
    rule.rules.forEach(function (oneRule) { 
        if(oneRule.isLineComment) return
        var value = String(oneRule.value.value)
        if('box-shadow'==oneRule.name){
            const shadowValues = oneRule.value.value.map(function(v){        
                if(v.unit && v.unit.numerator){
                    return String(v.value) + String((v.unit && v.unit.numerator &&  v.unit.numerator.length>0)? v.unit.numerator[0]:"")
                }else if (v.rgb){
                    return String(v.value)
                }                
            })
            value = shadowValues.join(" ")
        }

        sketchRule.props[String(oneRule.name)] = value
        sketchRule.props.__lessTokens["token"] = true
    })
    sketchRules.push(sketchRule)
}



function saveData(data,pathToJSON){   
    var json = JSON.stringify(data,null,'    ')
    fs.writeFileSync(pathToJSON, json, 'utf8');

    return true
}




