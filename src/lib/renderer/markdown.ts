'use strict';
import { markdown } from 'markdown';
import CodeMirror from 'codemirror/addon/runmode/runmode.node';

// style definitions for markdown
const styles = {
    h1: {
        fontSize: 25,
        padding: 15
    },
    h2: {
        fontSize: 18,
        padding: 10
    },
    h3: {
        fontSize: 18,
        padding: 10
    },
    para: {
        //padding: 2
    },
    code: {
        fontSize: 9
    },
    code_block: {
        padding: 10,
        background: '#2c2c2c'
    },
    inlinecode: {
        fontSize: 10
    },
    listitem: {
        fontSize: 10,
        padding: 6
    },
    link: {
        color: '#18bc9c',
        font: ' Italic',
        underline: true
    },
    example: {
        fontSize: 9,
        color: 'black',
        padding: 10
    },
    strong: {
        font: ' Bold'
    },
    italic: {
        font: ' Italic'
    }
};

// syntax highlighting colors
// based on Github's theme
const colors = {
    keyword: '#cb4b16',
    atom: '#d33682',
    number: '#009999',
    def: '#2aa198',
    variable: '#108888',
    'variable-2': '#b58900',
    'variable-3': '#6c71c4',
    property: '#2aa198',
    operator: '#6c71c4',
    comment: '#999988',
    string: '#dd1144',
    'string-2': '#009926',
    meta: '#768E04',
    qualifier: '#b58900',
    builtin: '#d33682',
    bracket: '#cb4b16',
    tag: '#93a1a1',
    attribute: '#2aa198',
    header: '#586e75',
    quote: '#93a1a1',
    link: '#93a1a1',
    special: '#6c71c4',
    default: '#002b36'
};

let codeBlocks = [];
let lastType = null;

interface Style {
    font?:string,
    background?:string,
    fontSize?:number,
    padding?:number,
    color?:string,
    align?:'right'|'left'|'center'|'justify',
}

interface RenderOptions{
    align?: 'right'|'left'|'center'|'justify'
    link?: string
    continued?: boolean
    lineGap?: number
    paragraphGap?: number
    font?:string
    getHeight?: boolean
}

interface NodeAttrs {
    level?:number
    continued?:boolean
    color?:string
    [key:string]:unknown
}


// This class represents a node in the markdown tree, and can render it to pdf
class Node {
    type: string;
    text: string;
    attrs: NodeAttrs;
    content: Node[];
    style: Style;

    constructor(tree) {
    // special case for text nodes
        if (typeof tree === 'string') {
            this.type = 'text';
            this.text = tree;
            return;
        } else {
            this.type = (tree.shift() as string);
        }

        this.attrs = {};

        if (typeof tree[0] === 'object' && !Array.isArray(tree[0])) {
            this.attrs = (tree.shift() as NodeAttrs);
        }

        // parse sub nodes
        this.content = [];
        while (tree.length) {
            const data = (tree.shift() as Node);
            this.content.push(new Node(data));
        }

        switch (this.type) {

            case 'header':
                this.type = `h${this.attrs.level}`;
                break;

            case 'code_block': {
                // use code mirror to syntax highlight the code block
                const code = this.content[0].text;
                this.content = [];
                CodeMirror.runMode(code, 'javascript', (text, style) => {
                    const color = colors[style] || colors.default;
                    const opts = {
                        color,
                        continued: text !== '\n'
                    };

                    return this.content.push(new Node(['code', opts, text]));
                });

                if (this.content.length) {
                    this.content[this.content.length - 1].attrs.continued = false;
                }
                codeBlocks.push(code);
                break;
            }
            /*
            case 'img':
                // images are used to generate inline example output
                // stores the JS so it can be run
                // in the render method

                console.log(JSON.stringify(this.attrs, null, 2));

                this.type = 'image';
                code = codeBlocks[this.attrs.alt];
                if (code) {
                    this.code = code;
                }
                this.height = +this.attrs.title || 0;

               break;
               */
        }

        this.style = styles[this.type] || styles.para;
    }

    // sets the styles on the document for this node
    setStyle (doc: PDFKit.PDFDocument, renderOptions: RenderOptions) {
        if (this.style.font) {
            if (renderOptions.font){
                doc.font(`${renderOptions.font}${this.style.font}`);
            } else {
                doc.font(`Body Font${this.style.font}`);
            }
        } else {
            if (renderOptions.font){
                doc.font(renderOptions.font);
            } else {
                doc.font('Body Font');
            }
        }

        if (this.style.fontSize) {
            doc.fontSize(this.style.fontSize);
        }

        if (this.style.color || this.attrs.color) {
            doc.fillColor(this.style.color || this.attrs.color);
        } else {
            doc.fillColor('black');
        }

        const options: RenderOptions = {};

        options.align = this.style.align;
        options.link = (this.attrs.href as string) || null; // override continued link
        if (this.attrs.continued != null) {
            options.continued = (this.attrs.continued as boolean);
        }
        if (renderOptions.continued){
            options.continued = renderOptions.continued;
        }
        return options;
    }

    // renders this node and its subnodes to the document
    render (doc:PDFKit.PDFDocument, renderOptions: RenderOptions) {
        if (renderOptions.continued == null) {
            renderOptions.continued = false;
        }

        let height = 0;

        if (this.type === 'img'){
            this.setStyle(doc, renderOptions);
            const filepath = __dirname + '/../../public' + this.attrs.href;
            const position = {
                x: doc.x ,
                y: doc.y +1
            };
            //if ( doc._wrapper ) { position.x += doc._wrapper.continuedX; }
            const yBackup = doc.y ;

            doc.image(filepath, position.x, position.y, {height:12});
            //if ( doc._wrapper ) { doc._wrapper.continuedX += 22 ; }

            doc.y = yBackup;

        } else {

            // loop through subnodes and render them
            for (let index = 0; index < this.content.length; index++) {
                const fragment = this.content[index];
                if (fragment.type === 'text') {
                    // add a new page for each heading, unless it follows another heading
                    if (
                        ['h1', 'h2'].includes(this.type) &&
                                  lastType != null &&
                                  lastType !== 'h1'
                    ) {
                        doc.addPage();
                    }

                    /*
                    if (this.type === 'h1') {
                        doc.h1Outline = doc.outline.addItem(fragment.text);
                    } else if (this.type === 'h2' && doc.h1Outline !== null) {
                        doc.h1Outline.addItem(fragment.text);
                    }*/

                    // set styles and whether this fragment is continued (for rich text wrapping)
                    const options = this.setStyle(doc, renderOptions);
                    if (options.continued == null) {
                        options.continued = renderOptions.continued || index < this.content.length - 1;
                    }
                    if (renderOptions.lineGap){
                        options.lineGap = renderOptions.lineGap;
                    }
                    if (renderOptions.paragraphGap){
                        options.paragraphGap = renderOptions.paragraphGap;
                    }

                    // remove newlines unless this is code
                    if (this.type !== 'code') {
                        fragment.text = fragment.text.replace(/[\r\n]\s*/g, ' ');
                    }
                    if (renderOptions.getHeight){
                        height += doc.heightOfString(fragment.text, options);
                    } else {
                        doc.text(fragment.text, options);
                    }
                } else {
                    const newOptions = JSON.parse(JSON.stringify(renderOptions));
                    if (! renderOptions.continued){
                        newOptions.continued = index < this.content.length - 1 && this.type !== 'bulletlist';
                    }
                    fragment.render(
                        doc,
                        newOptions
                    );
                }


                lastType = this.type;
            }
        }
        if (renderOptions.getHeight){
            return height;
        }

        if (this.style.padding) {
            return (doc.y += this.style.padding);
        }
    }
}

// reads and renders a markdown/literate javascript file to the document
function render(doc:PDFKit.PDFDocument, input, options?:RenderOptions){
    codeBlocks = [];
    const tree = markdown.parse(input);
    tree.shift();

    if (!options){
        options = {};
    }
    if (options.getHeight){
        let height = 0;
        while (tree.length) {
            const node = new Node(tree.shift());
            height += node.render(doc, options);
        }
        return height;
    } else {
        const result = [];
        while (tree.length) {
            const node = new Node(tree.shift());
            result.push(node.render(doc, options));
        }
        return result;
    }
};

export default render
