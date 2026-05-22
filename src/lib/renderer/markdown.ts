'use strict';
import { Marked } from 'marked';
import {decode} from 'html-entities';

const marked = new Marked({breaks:true});

// style definitions for markdown
const styles:Record<string, Style> = {
    h1: {
        fontSize: 25,
        padding: 15
    },
    h2: {
        fontSize: 18,
        padding: 10
    },
    h3: {
        fontSize: 16,
        padding: 8
    },
    h4: {
        fontSize: 12,
        padding: 2
    },
    para: {
        fontSize: 'default',
        //padding: 0
    },
    text: {
        fontSize: 'default',
        //padding: 0
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
    list_item: {
        fontSize: 'default',
        padding: 2
    },
    link: {
        color: '#18bc9c',
        font: ' Italic',
        underline: true,
    },
    example: {
        fontSize: 9,
        color: 'black',
        padding: 10
    },
    strong: {
        font: ' Bold',
        fontSize: 'default'
    },
    italic: {
        font: ' Italic',
        fontSize: 'default',
    },
    em: {
        font: ' Italic',
        fontSize: 'default',
    }
};

let lastType:string|null = null;

interface Style {
    font?:string,
    background?:string,
    fontSize?:number|'default',
    padding?:number,
    color?:string,
    align?:'right'|'left'|'center'|'justify',
    oblique?:boolean|number
    underline?:boolean
}

interface RenderOptions{
    align?: 'right'|'left'|'center'|'justify'
    link?: string
    continued?: boolean
    lineGap?: number
    paragraphGap?: number
    font?:string
    getHeight?: boolean
    width?:number
    stroke?:boolean
    fill?:boolean
    noLinks?:boolean
    indent?:number
    defaultFontSize?:number
    oblique?:boolean|number
    fontOptions?:PDFFontOptions
}

interface NodeAttrs {
    level?:number
    continued?:boolean
    color?:string
    [key:string]:unknown
}

interface CDBPdf extends PDFKit.PDFDocument{
    _fontSize?:number,
}



// This class represents a node in the markdown tree, and can render it to pdf
class Node {
    type: string|null = null;
    text: string = '';
    attrs: NodeAttrs = {};
    content: Node[] = [];
    style: Style = {};
    depth?:number
    tokens?:Node[]
    items?:Node[]

    constructor(tree:string|Node) {
    // special case for text nodes
        if (typeof tree === 'string') {
            this.type = 'text';
            this.text = tree;
            return;
        } else if (tree.type === 'heading'){
            this.type = `h${tree.depth}`;
            this.text = tree.text
        } else {
            this.type = tree.type as string;
            this.text = tree.text
        }

        this.attrs = {};
/*
        if (typeof tree[0] === 'object' && !Array.isArray(tree[0])) {
            this.attrs = (tree.shift() as NodeAttrs);
        }
*/
        // parse sub nodes
        this.content = [];
        if (tree.tokens){
            for (const data of tree.tokens as Node[]){
                this.content.push(new Node(data));
            }
        }

        switch (this.type) {

            case 'header':
                this.type = `h${this.attrs.level}`;
                break;

            case 'list':
                while (tree.items && tree.items.length) {
                    const data = (tree.items.shift() as Node);
                    this.content.push(new Node(data));
                }
                break;

        }
        if (Object.hasOwn(styles, this.type)){
            this.style = styles[this.type] ? JSON.parse(JSON.stringify(styles[this.type])) : {};
        } else {
            this.style = JSON.parse(JSON.stringify(styles.para));
        }
    }

    // sets the styles on the document for this node
    setStyle (doc: PDFKit.PDFDocument, renderOptions: RenderOptions) {
        const options: RenderOptions = {
            oblique:false
        };

        if (this.style.font) {
            if (renderOptions.font){
                doc.font(`${renderOptions.font}${this.style.font}`);
                options.oblique = renderOptions.fontOptions?.fontOblique?.[renderOptions.font]
            } else {
                doc.font(`Body Font${this.style.font}`);
                options.oblique = renderOptions.fontOptions?.fontOblique?.[`Body Font${this.style.font}`]
            }
        } else {
            if (renderOptions.font){
                doc.font(renderOptions.font);
                options.oblique = renderOptions.fontOptions?.fontOblique?.[renderOptions.font]
            } else {
                doc.font('Body Font');
            }
        }

        if (this.style.fontSize) {
            if (this.style.fontSize === 'default'){
                this.style.fontSize = Number(renderOptions.defaultFontSize)
                doc.fontSize(this.style.fontSize);
            } else {
                doc.fontSize(this.style.fontSize);
            }
        }

        if (this.style.color || this.attrs.color) {
            if (this.style.color){
                doc.fillColor(this.style.color)
            } else if (this.attrs.color){
                doc.fillColor(this.attrs.color);
            }
        } else {
            doc.fillColor('black');
        }

        options.align = this.style.align;
        if (this.attrs.href){
            options.link = (this.attrs.href as string); // override continued link
        }

        if (this.attrs.continued != null) {
            options.continued = (this.attrs.continued as boolean);
        }
        if (renderOptions.continued){
            options.continued = renderOptions.continued;
        }
        if (renderOptions.width){
            options.width = renderOptions.width;
        }
        if (!renderOptions.align){
            options.align = 'left'
        }
        return options;
    }

    // renders this node and its subnodes to the document
    render (doc:PDFKit.PDFDocument, renderOptions: RenderOptions) {
        if (renderOptions.continued == null) {
            renderOptions.continued = false;
        }

        const startX = doc.x;

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

            if (this.type === 'space'){
                const options = this.setStyle(doc, renderOptions);
                height += doc.heightOfString(' ', options);

                if (!renderOptions.getHeight){
                    doc.moveDown(1)
                }

            }
            const oldWidth = renderOptions.width;
            if (this.type === 'list'){
                height += 5;
                doc.x += 15;
                if (!renderOptions.getHeight){
                    doc.y += 5;
                }
                if (renderOptions.width){
                    renderOptions.width -= 15;
                }

            }
            if (this.type === 'list_item'){
                this.content.unshift(new Node({
                    type: 'strong',
                    tokens: [
                        '•  '
                    ]
                } as unknown as Node))
            }

            // loop through subnodes and render them
            for (let index = 0; index < this.content.length; index++) {
                const fragment = this.content[index];

                let bulletAdded = false;

                if (fragment.type === 'text' && !fragment.content.length) {
                    // add a new page for each heading, unless it follows another heading
                    if (
                        this.type && ['h1', 'h2'].includes(this.type) &&
                                  lastType != null &&
                                  lastType !== 'h1'
                    ) {
                        doc.addPage();
                    }

                    let text = decode(fragment.text);;

                    if (this.type === 'list_item' && !bulletAdded){
                        text = `•  ${text}`;
                        bulletAdded = true;
                    }

                    // set styles and whether this fragment is continued (for rich text wrapping)
                    const options = this.setStyle(doc, renderOptions);
                    if (options.continued == null) {
                        options.continued = renderOptions.continued || (index < this.content.length - 1 && this.content[index+1].type !== 'br');
                    }

                    if (renderOptions.lineGap){
                        options.lineGap = renderOptions.lineGap;
                    }
                    if (renderOptions.paragraphGap){
                        options.paragraphGap = renderOptions.paragraphGap;
                    }

                    // remove newlines unless this is code
                    if (this.type !== 'code') {
                        text = text.replace(/[\r\n]\s*/g, ' ');
                    }

                    if (renderOptions.getHeight){
                        height += doc.heightOfString(text, options);
                    } else {
                        doc.text(text, options);
                    }
                } else {
                    const newOptions = JSON.parse(JSON.stringify(renderOptions));
                    if (! renderOptions.continued){
                        newOptions.continued = index < this.content.length - 1 && this.type !== 'list' && this.content[index+1]?.type !== 'br' ;

                    }
                    const fragmentHeight = Number(fragment.render(
                        doc,
                        newOptions
                    ));
                    height += fragmentHeight;
                }

                lastType = this.type;
            }

            if (this.type === 'list'){
                renderOptions.width = oldWidth;
            }
            doc.x = startX
        }
        if (renderOptions.getHeight){
            if (this.style.padding){
                height += this.style.padding;
            }
            return height;
        }

        if (this.style.padding) {
            return (doc.y += this.style.padding);
        }
    }
}

// reads and renders a markdown/literate javascript file to the document
function render(doc:CDBPdf, input:string, renderOptions?:RenderOptions){

    const tree = marked.lexer(input);//, {breaks:true});

    const options = {
        ...renderOptions
    };

    if (!options.defaultFontSize){
        options.defaultFontSize = doc._fontSize;
    }
    if (options.getHeight){
        let height = 0;
        while (tree.length) {
            const node = new Node(tree.shift() as unknown as Node);
            height += Number(node.render(doc, options));
        }
        return height;
    } else {
        const result = [];
        while (tree.length) {
            const node = new Node(tree.shift() as unknown as Node);
            result.push(node.render(doc, options));
        }
        return result;
    }
};

export default render
