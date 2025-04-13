'use strict'

import fontHelper from './fontHelper';
import _ from 'underscore';

async function registerFonts(doc:PDFKit.PDFDocument, options): Promise<void>{
    const fontsDir = __dirname + '/../../../fonts/'

    try {
        if (!options.headerFontId){
            throw new Error('No Header Font Provided')
        }
        doc.registerFont('Header Font', await fontHelper.buffer(options.headerFontId));
        doc.registerFont('Header Font Bold', await fontHelper.buffer(options.headerFontId, 'bold'));
        doc.registerFont('Header Font Italic', await fontHelper.buffer(options.headerFontId, 'italic'));
        doc.registerFont('Header Font BoldItalic', await fontHelper.buffer(options.headerFontId, 'bolditalic'));
    } catch (err){
        console.log(`Something went wrong loading remote font for headers, using defaults. ${err.message}`);
        doc.registerFont('Header Font', fontsDir + 'Montserrat-Regular.ttf');
        doc.registerFont('Header Font Bold', fontsDir + 'Montserrat-Bold.ttf');
        doc.registerFont('Header Font Italic', fontsDir + 'Montserrat-Italic.ttf');
        doc.registerFont('Header Font BoldItalic', fontsDir + 'Montserrat-BoldItalic.ttf');
    }

    try{
        if (!options.bodyFontId){
            throw new Error('No Body Font Provided')
        }
        doc.registerFont('Body Font', await fontHelper.buffer(options.bodyFontId));
        doc.registerFont('Body Font Bold', await fontHelper.buffer(options.bodyFontId, 'bold'));
        doc.registerFont('Body Font Italic', await fontHelper.buffer(options.bodyFontId, 'italic'));
        doc.registerFont('Body Font BoldItalic', await fontHelper.buffer(options.bodyFontId, 'bolditalic'));

    } catch (err){
        console.log(`Something went wrong loading remote font for body, using defaults. ${err.message}`);
        const fontsDir = __dirname + '/../../../fonts/'
        doc.registerFont('Body Font', fontsDir + 'Lato-Regular.ttf');
        doc.registerFont('Body Font Bold', fontsDir + 'Lato-Bold.ttf');
        doc.registerFont('Body Font Italic', fontsDir + 'Lato-Italic.ttf');
        doc.registerFont('Body Font BoldItalic', fontsDir + 'Lato-BoldItalic.ttf');
    }
}

function capitalize(string:string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function renderGoogleDocument(doc:PDFKit.PDFDocument, text:string|GoogleDocTextRun[][], options){
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
                        doc.font('Header Font').fontSize(20*options.headerScale);
                        isHeader = true;
                        break;
                    case 'HEADING_2':
                        doc.moveDown();
                        doc.font('Header Font').fontSize(18*options.headerScale);
                        isHeader = true;
                        break;
                    case 'HEADING_3':
                        doc.moveDown();
                        doc.font('Header Font').fontSize(16*options.headerScale);
                        isHeader = true;
                        break;
                    case 'HEADING_4':
                        doc.font('Header Font').fontSize(14*options.headerScale);
                        isHeader = true;
                        break;
                    case 'HEADING_5':
                        doc.font('Header Font').fontSize(12*options.headerScale);
                        isHeader = true;
                        break;
                    default:
                        doc.font('Body Font').fontSize(12*options.bodyScale);
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
}
export default {
    registerFonts,
    capitalize,
    renderGoogleDocument
}
