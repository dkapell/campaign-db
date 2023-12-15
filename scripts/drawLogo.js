'use strict';
const fs = require('fs');
const _ = require('underscore');
const Jimp = require('jimp');
const PDFDocument = require('pdfkit');
const star = require('../lib/renderer/star');

const images = {
    mandala: __dirname + '/../images/Mandala-background.png',
    starfield: __dirname + '/../images/starfield.jpg'
};

(async function main() {
    const doc = await buildPDF(true);

    doc.pipe(fs.createWriteStream('./ritual-logo.pdf'));
    doc.end();
})().catch((error) => {
    process.exitCode = 1;
    console.trace(error);
});




async function buildPDF(circle){
    const doc = new PDFDocument({size: [ 5*72, 5*72 ]});
    let cardNum = 0;
    const margin = 5;

    const background = await getBackground(doc.page.width - margin*2, doc.page.height - margin*2);
    
    if (circle){
        doc.save();
        //doc.roundedRect(margin, margin, doc.page.width-margin*2, doc.page.height-margin*2, margin).clip();
        //doc.circle(doc.page.width/2, doc.page.height/2, doc.page.width/2 - margin*2.9).clip();
    }
    //doc.image(background, 0,0 , {fit: [doc.page.width, doc.page.height], align: 'center', valign: 'center'});

    const mandala = await getMandala();
    doc.image(mandala, margin*3, margin*3, {fit: [doc.page.width - margin*6, doc.page.height - margin*6], align: 'center', valign: 'center'});

    //const points = star(doc, [], doc.page.width/3.6, doc.page.width/2, doc.page.height/2, '#000000', false);
    //const points = star(doc, [], doc.page.width/3.33, doc.page.width/2, doc.page.height/2, 'white', false);

    /*
    for(let i = 0; i < points.byways.length; i++){
        const x = points.byways[i].x;
        const y = points.byways[i].y;
        doc.save();
        doc.circle(x, y, points.objSize-points.objStroke/2).clip();
        doc.image(background, margin, margin, {fit: [doc.page.width - margin*2, doc.page.height - margin*2], align: 'center', valign: 'center'});
        doc.restore();

    }
      for(let i = 0; i < points.paths.length; i++){
        const x = points.paths[i].x;
        const y = points.paths[i].y;
        const objSize = points.objSize-(points.objStroke/2);
        doc.save();
        doc.rect(x-objSize,y-objSize,objSize*2,objSize*2).clip();
        doc.image(background, margin, margin, {fit: [doc.page.width - margin*2, doc.page.height - margin*2], align: 'center', valign: 'center'});
        doc.restore();

    }
    */
    
    return doc;
}

async function getMandala(){
    const image = await Jimp.read(images.mandala);
    //await image.invert();
    //await image.opacity(0.5);
    return image.getBase64Async(Jimp.MIME_PNG);
}

async function getBackground(width, height){
    const image = await Jimp.read(images.starfield);
    await image.crop(0, 0, image.bitmap.height, image.bitmap.height);
    //await image.crop(0, 0, width*15, height*15);
    return image.getBase64Async(Jimp.MIME_JPEG);
}
