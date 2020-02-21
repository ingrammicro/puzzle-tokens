#!/bin/bash

sketchFile="$1"
stylesFile="$2"
commands="$3"
saveAs="$4"


help="./run-pt.sh path_to_sketch_file path_to_styles_file commands(apply,save,close) path_to_NEW_sketch_file(optional)"

if [ "$commands" == "" ]; then
    echo $help
    exit -1
fi


context='"file":"'
context+=$sketchFile
context+='","styles":"'
context+=$stylesFile
context+='","commands":"'
context+=$commands
context+='"'
if [ "$saveAs" != "" ]; then
    context+=',"saveAs":"'
    context+=$saveAs
    context+='"'
fi

qc="{"
qc+=$context
qc+="}"


/Applications/Sketch.app/Contents/Resources/sketchtool/bin/sketchtool --without-activating=YES --new-instance=No run ~/Library/Application\ Support/com.bohemiancoding.sketch3/Plugins/PuzzleTokens.sketchplugin "cmdRun"  --context=$qc
