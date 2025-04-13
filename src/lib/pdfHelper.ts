'use strict'

import fontHelper from './fontHelper';
import _ from 'underscore';

async function registerFonts(doc:PDFKit.PDFDocument, options): Promise<void>{
    const fontsDir = __dirname + '/../../fonts/'

    try {
        if (!options.titleFontId){
            throw new Error('No Title Font Provided')
        }
        doc.registerFont('Title Font', await fontHelper.buffer(options.titleFontId));
        doc.registerFont('Title Font Bold', await fontHelper.buffer(options.titleFontId, 'bold'));
        doc.registerFont('Title Font Italic', await fontHelper.buffer(options.titleFontId, 'italic'));
        doc.registerFont('Title Font BoldItalic', await fontHelper.buffer(options.titleFontId, 'bolditalic'));
    } catch (err){
        console.log(`Something went wrong loading remote font for headers, using defaults. ${err.message}`);
        doc.registerFont('Title Font', fontsDir + 'Montserrat-Regular.ttf');
        doc.registerFont('Title Font Bold', fontsDir + 'Montserrat-Bold.ttf');
        doc.registerFont('Title Font Italic', fontsDir + 'Montserrat-Italic.ttf');
        doc.registerFont('Title Font BoldItalic', fontsDir + 'Montserrat-BoldItalic.ttf');
    }

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
                doc.fillColor('black');
                doc.lineGap(0);
                if (!chunk) {
                    doc.moveDown();
                    continue;
                }
                let fontStyle = 'Body';
                 switch (chunk.paragraphStyle){
                     case 'TITLE':
                        doc.lineGap(6);
                        doc.font('Title Font').fontSize(22*options.titleScale);
                        fontStyle = 'Title';

                        break;
                    case 'SUBTITLE':
                        doc.lineGap(5);
                        doc.font('Title Font').fontSize(15*options.titleScale);
                        doc.fillColor('gray')
                        fontStyle = 'Title';
                        break;
                    case 'HEADING_1':
                        doc.lineGap(4);
                        doc.font('Header Font').fontSize(20*options.headerScale);
                        fontStyle = 'Header';
                        break;
                    case 'HEADING_2':
                        doc.lineGap(4);
                        doc.font('Header Font').fontSize(18*options.headerScale);
                        fontStyle = 'Title';
                        break;
                    case 'HEADING_3':
                        doc.lineGap(4);
                        doc.font('Header Font').fontSize(16*options.headerScale);
                        fontStyle = 'Title';
                        break;
                    case 'HEADING_4':
                        doc.font('Header Font').fontSize(14*options.headerScale);
                        fontStyle = 'Title';
                        break;
                    case 'HEADING_5':
                        doc.font('Header Font').fontSize(12*options.headerScale);
                        fontStyle = 'Title';
                        break;
                    default:
                        doc.font('Body Font').fontSize(12*options.bodyScale);
                        fontStyle = 'Body';
                        break;
                }


                if (chunk.textStyle.bold && chunk.textStyle.italic){
                    doc.font(`${fontStyle} Font BoldItalic`);
                } else if (chunk.textStyle.bold){
                    doc.font(`${fontStyle} Font Bold`);

                } else if (chunk.textStyle.italic){
                    doc.font(`${fontStyle} Font Italic`);
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
