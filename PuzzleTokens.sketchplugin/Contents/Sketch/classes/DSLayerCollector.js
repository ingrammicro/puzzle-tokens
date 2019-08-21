@import("constants.js")

Sketch = require('sketch/dom')

class DSLayerCollector {

    constructor() { 
    }

    collectPages(){
        let pages = {}

        app.nDoc.pages().forEach(function (nPage) {
            const page = {
                name: nPage.name(),
                nlayer: nPage,
                childs: this.collectPageArtboards(nPage)
            }
            pages[page.name] = page
        },this)

        return pages
    }

    collectPageArtboards(nPage){
        const artboards = {}

        nPage.artboards().forEach(function(nArtboard){            
            const artboard = {
                name: nArtboard.name(),
                nlayer: nArtboard,
                childs: this.collectLayers(nArtboard.layers())                
            }
            artboards[artboard.name] = artboard
        },this)

        return artboards
    }

    collectLayers(nLayers){
        const layers = {}

        nLayers.forEach(function(nLayer){            
            let childs = {}
            
            if(this.isLayerGroup(nLayer)){
                childs = this.collectLayers(nLayer.layers())
            }

            const layer = {
                name: nLayer.name(),
                nlayer: nLayer,
                slayer: Sketch.fromNative(nLayer),
                childs: childs
            }
            layers[layer.name] = layer
        },this)

        return layers
    }


    isLayerGroup(nlayer){
        if(nlayer.isKindOfClass(MSLayerGroup)) return true
        if(nlayer.isKindOfClass(MSSymbolMaster)) return true
        return false
    }

    
}
