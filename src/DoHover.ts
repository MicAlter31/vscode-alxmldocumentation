import { languages, Hover, workspace } from "vscode";
import { ALSyntaxUtil } from './util/ALSyntaxUtil';
import { ALLangServerProxy } from './util/ALLangServerProxy';
import { isNullOrUndefined } from "util";

export class DoHover {    
    constructor() {            
        languages.registerHoverProvider(
            { language: 'al' }, {
                async provideHover(document, position, token) {    
                    // check configuration for enabled Summary presentation
                    if (!workspace.getConfiguration("bdev-al-xml-doc").enableSummaryHover) {
                        return;
                    }                   

                    // retrieve source code from language server
                    let alLangServerProxy = new ALLangServerProxy();     
                    const alSourceCode = await alLangServerProxy.GetALSourceCode(document.uri.toString(), position);
                    if (alSourceCode === undefined) {
                        return;
                    }
                    
                    // extract xml documentation if exist (search backwards from line no given by GoToDefinition)
                    var docBuffer = '';
                    let alSourceCodeLines = alSourceCode.value.split(/\r\n|\r|\n/);
                    for (var i = (alSourceCode.pos.line - 1); (i > 0); i--) {
                        let line = alSourceCodeLines[i];
                        if (line.trim().startsWith('///')) {
                            docBuffer = `${line.replace('///','').trim()}\r\n${docBuffer}`;
                        }
                        if ((ALSyntaxUtil.IsProcedure(line)) || (ALSyntaxUtil.IsObject(line))) {
                            break;
                        }
                    }
                    if (docBuffer === '') {
                        return;
                    }

                    // transform xml to json
                    var parser = require('fast-xml-parser');
                    var options = {
                        attributeNamePrefix : "",
                        attrNodeName: "attr",
                        textNodeName : "value",
                        ignoreAttributes : false,
                        ignoreNameSpace : true,
                        parseAttributeValue : true
                    };
                    try {
                        var docJson = parser.parse(`<?xml version="1.0."?><root>${docBuffer}</root>`, options, true);
                    } catch(ex) {
                        return;
                    }

                    // build hover text with summary
                    let hoverText: string[] = [];
                    if ((docJson.root.summary) && (docJson.root.summary !== "")) {
                        hoverText.push(docJson.root.summary);
                    } else {
                        return; // don't show w/o summary
                    }

                    if ((docJson.root.remarks) && (docJson.root.remarks !== "")) {
                        hoverText.push(`**Remarks:** ${docJson.root.remarks}`);
                    } 

                    if (!isNullOrUndefined(hoverText)) {
                        return new Hover(hoverText);
                    } else {
                        return;
                    }
                }
            }
        );
    }

    public dispose() {
    }
}