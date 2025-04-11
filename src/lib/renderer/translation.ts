'use strict';
import PDFDocument from 'pdfkit';
import _ from 'underscore';
import addTextbox  from 'textbox-for-pdfkit';
import {Readable} from 'stream';

import models from '../models';
import Drive from '../Drive';
import fontHelper from '../fontHelper';


interface PDFFeatures {
    columns?:number
    lineGap?:number
    paragraphGap?:number
    columnGap?:number
    continued?:boolean
    underline?:boolean
    strike?:boolean
}

async function renderFile(id){
    try{
        const file = await models.translation.get(id);
        if (!file) { return; }

        const text = await Drive.getTextWithFormatting( file.doc_id );
        const campaign = await models.campaign.get(file.campaign_id);
        const pdf = await render(_.pluck(text[file.preview], 'content').join(''), text, {
            fontId: file.font_id,
            border: file.border,
            label: file.label,
            headerFontId: file.header_font_id?file.header_font_id:campaign.default_translation_header_font_id,
            bodyFontId: file.body_font_id?file.body_font_id:campaign.default_translation_body_font_id
        });

        const outputFolder = await Drive.createFolder(campaign.translation_drive_folder, 'Output');
        await Drive.uploadFile(outputFolder.id, `${file.name}.pdf`, 'application/pdf', pdf as unknown as Readable );
    } catch (err){
        console.trace(err);
        throw err;
    }
};

async function render(preview:string, text:GoogleDocTextRun[][], options): Promise<PDFKit.PDFDocument>{

    const doc = new PDFDocument({size: 'LETTER'});

    if (!_.has(options, 'margin')){
        options.margin = 50;
    }

    const font = await models.font.get(options.fontId);
    if (!font){
        throw new Error ('font not found');
    }

    if (!_.has(options, 'language')){
        if (font.language){
            options.language = font.language;
        } else {
            options.language = font.name;
        }
    }
    const fontBuffer = await fontHelper.buffer(font.id);


    doc.registerFont(font.name, fontBuffer);
    await registerFonts(doc, options);

    if (options.border){

        if (options.label){

            doc.rect(doc.page.width/4, options.margin-20, doc.page.width/2, 40).stroke();

            doc
                .moveTo(doc.page.width/4, options.margin)
                .lineTo(options.margin, options.margin)
                .lineTo(options.margin, doc.page.height - options.margin)
                .lineTo(doc.page.width - options.margin, doc.page.height - options.margin)
                .lineTo(doc.page.width - options.margin, options.margin)
                .lineTo(3*doc.page.width/4, options.margin)
                .stroke();

            const headerArray = [
                {
                    text: `Language: ${options.language}`,
                    font: 'Header Font Bold'
                },
                {
                    text: ' Only',
                    font: 'Header Font'
                }
            ];

            addTextbox(headerArray, doc, doc.page.width/4, options.margin-5, doc.page.width/2, {
                fontSize: 14,
                align: 'center',
            });

        } else {
            doc.rect(options.margin, options.margin, doc.page.width - options.margin*2, doc.page.height - options.margin*2).stroke();
        }
    }
    doc.font(font.name);
    doc.fontSize(font.size);
    doc.text('', options.margin*1.5, options.margin*2);

    let actualSize = font.size;

    let maxHeight = doc.page.height - options.margin * (options.border?4:4);

    if (font.transformation){
        switch (font.transformation){
            case 'uppercase': preview = preview.toUpperCase(); break;
            case 'lowercase': preview = preview.toLowerCase(); break;
        }
    }

    const features: PDFFeatures = {};

    if (font.vertical){
        preview = preview.split('').join('\n');
        features.columns = 14;
        features.lineGap = -5;
        features.paragraphGap = 0;
        features.columnGap = 5;
        maxHeight = maxHeight * 14;
    }


    while (doc.heightOfString(preview, features) > maxHeight){
        actualSize -= 0.1;
        doc.fontSize(actualSize);
    }

    if (font.lettersonly){
        const parts = preview.split(/([^\w ])/);
        doc.moveTo(options.margin*1.5, options.margin*2);
        features.continued = true;
        for (const part of parts){
            if (part.match(/[\w ]+$/)){
                doc.font(font.name)
                    .text(part, features);
            } else {
                doc.font('Body Font')
                    .text(part,features);
            }
        }
        features.continued = false;
    } else {
        doc.text(preview, options.margin*1.5, options.margin*2,features);
    }

    doc
        .addPage()
        .fontSize(12)
        .moveTo(options.margin*1.5, options.margin*1.5)
        .text('');

    if (_.isString(text)){
        doc.text(text);
    } else {
        for (const paragraph of text){
            for (let i = 0; i < paragraph.length; i++){
                const chunk = paragraph[i];
                const features: PDFFeatures = {};
                if ( i < paragraph.length - 1){
                    features.continued = true;
                }

                doc.font('Body Font');
                if (!chunk) { continue; }
                let isHeader = false;
                 switch (chunk.paragraphStyle){
                    case 'HEADING_1':
                        doc.moveDown();
                        doc.font('Header Font').fontSize(20);
                        isHeader = true;
                        break;
                    case 'HEADING_2':
                        doc.moveDown();
                        doc.font('Header Font').fontSize(18);
                        isHeader = true;
                        break;
                    case 'HEADING_3':
                        doc.moveDown();
                        doc.font('Header Font').fontSize(16);
                        isHeader = true;
                        break;
                    case 'HEADING_4':
                        doc.font('Header Font').fontSize(14);
                        isHeader = true;
                        break;
                    case 'HEADING_5':
                        doc.font('Header Font').fontSize(12);
                        isHeader = true;
                        break;
                    default:
                        doc.font('Body Font').fontSize(12);
                        break;
                }


                if (chunk.textStyle.bold && chunk.textStyle.italic){
                    if (isHeader){
                        doc.font('Header Font BoldItalic');
                    } else {
                        doc.font('Body Font BoldItalic');
                    }
                } else if (chunk.textStyle.bold){
                    if (isHeader){
                        doc.font('Header Font Bold');
                    } else {
                        doc.font('Body Font Bold');
                    }
                } else if (chunk.textStyle.italic){
                    if (isHeader){
                        doc.font('Header Font Italic');
                    } else {
                        doc.font('Body Font Italic');
                    }
                }

                if (chunk.textStyle.underline){
                    features.underline = true;
                } else {
                    features.underline = false;
                }

                if (chunk.textStyle.strikethrough){
                    features.strike = true;
                } else {
                    features.strike = false;
                }

                doc.text(chunk.content, features);

            }
        }
    }

    doc.end();
    return doc;

}

async function registerFonts(doc:PDFKit.PDFDocument, options): Promise<void>{
    doc.registerFont('Header Font', await fontHelper.buffer(options.headerFontId));
    doc.registerFont('Header Font Bold', await fontHelper.buffer(options.headerFontId, 'bold'));
    doc.registerFont('Header Font Italic', await fontHelper.buffer(options.headerFontId, 'italic'));
    doc.registerFont('Header Font BoldItalic', await fontHelper.buffer(options.headerFontId, 'bolditalic'));

    doc.registerFont('Body Font', await fontHelper.buffer(options.bodyFontId));
    doc.registerFont('Body Font Bold', await fontHelper.buffer(options.bodyFontId, 'bold'));
    doc.registerFont('Body Font Italic', await fontHelper.buffer(options.bodyFontId, 'italic'));
    doc.registerFont('Body Font BoldItalic', await fontHelper.buffer(options.bodyFontId, 'bolditalic'));
}

export default renderFile;
