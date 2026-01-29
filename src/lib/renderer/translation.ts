'use strict';
import PDFDocument from 'pdfkit';
import _ from 'underscore';
import addTextbox  from 'textbox-for-pdfkit';
import {Readable} from 'stream';

import models from '../models';
import Drive from '../Drive';
import fontHelper from '../fontHelper';
import pdfHelper from '../pdfHelper';

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
            runesOnly: file.runes_only,
            headerFontId: file.header_font_id?file.header_font_id:campaign.default_translation_header_font_id,
            bodyFontId: file.body_font_id?file.body_font_id:campaign.default_translation_body_font_id,
            bodyScale: (file.body_font_scale ||= 1) * (campaign.translation_scale ||= 1),
            headerScale: (file.header_font_scale ||= 1) * (campaign.translation_scale ||= 1),
            titleFontId:  file.title_font_id?file.title_font_id:campaign.default_translation_title_font_id,
            titleScale: (file.title_font_scale ||= 1) * (campaign.translation_scale ||= 1)
        });

        const outputFolder = await Drive.createFolder(campaign.translation_drive_folder, 'Translation PDF Output');
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
    await pdfHelper.registerFonts(doc, options);


    if (options.label){

        doc.rect(doc.page.width/4, options.margin-20, doc.page.width/2, 40).stroke();

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
    }

    if (options.border){
        if (options.label){
             doc
                .moveTo(doc.page.width/4, options.margin)
                .lineTo(options.margin, options.margin)
                .lineTo(options.margin, doc.page.height - options.margin)
                .lineTo(doc.page.width - options.margin, doc.page.height - options.margin)
                .lineTo(doc.page.width - options.margin, options.margin)
                .lineTo(3*doc.page.width/4, options.margin)
                .stroke();
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
    if (!options.runesOnly){

        doc
            .addPage()
            .fontSize(12*options.bodyScale)
            .moveTo(options.margin*1.5, options.margin*1.5)
            .text('');

        pdfHelper.renderGoogleDocument(doc, text, options);
    }

    doc.end();
    return doc;

}
export default renderFile;
