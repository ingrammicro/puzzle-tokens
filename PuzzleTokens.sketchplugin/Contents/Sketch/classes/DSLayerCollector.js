@import("constants.js")

Sketch = require('sketch/dom')


function _clearName(name){
    return name.replace(/(\ )/g,'').replace("/(\/)/g",'\\')
}

class DSLayerCollector {

    constructor() { 
        this.layers = {}
    }

    collectLayers(){
        app.nDoc.pages().forEach(function (nPage) {
            const name = nPage.name() 
            this.layers[name] = {
                name: nPage.name(),
                isPage: true,
                nlayer: nPage
            }        
            this._collectLayersFromGroup(nPage.artboards(),name)
        },this)

        return this.layers
    }

    _collectLayersFromGroup(nLayers,path,insideMaster=false){

        nLayers.forEach(function(nLayer){            
            let childs = {}
                    
            const name = nLayer.name()
            const newPath = _clearName(path + "/" + name)

            const mLayer = {
                name: name,
                path: newPath,
                insideMaster: insideMaster,
                nlayer: nLayer,
                slayer: Sketch.fromNative(nLayer),
            }
            this.layers[newPath] = mLayer


            if(this.isLayerGroup(nLayer)){
                insideMaster = insideMaster || nLayer.isKindOfClass(MSSymbolMaster)
                this._collectLayersFromGroup(nLayer.layers(),newPath,insideMaster)            
            }

        },this)

    }


    isLayerGroup(nLayer){
        if(nLayer.isKindOfClass(MSLayerGroup)) return true
        if(nLayer.isKindOfClass(MSSymbolMaster)) return true
        return false
    }

    
}
