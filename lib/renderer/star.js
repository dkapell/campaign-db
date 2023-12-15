'use strict';
const _ = require('underscore');

const paths = [
    'Ritual of Shadow',
    'Ritual of Blood',
    'Ritual of Steel',
    'Ritual of Words',
    'Ritual of Sky',
];
const byways = [
    'Dreamwalker',
    'Harrier',
    'Strategist',
    'Stalker',
    'Chirurgeon',
    'Sanguinist',
    'Warder',
    'Windcaller',
    'Champion',
    'Shaper',
    'Emissary',
    'Chronicler',
    'Wordsinger',
    'Woodspeaker',
    'Starseer'
];


module.exports = function draw(doc, sources, size, Xcenter, Ycenter, lineColor, noFill){
    const numberOfSides = 5;
    const bywayPush = size / (numberOfSides===5?6:8);
    const connectionStroke=size/75;
    const objStroke = size/50;
    const objSize = size / 7;

    if (lineColor){
        doc.strokeColor(lineColor);
    }

    // some vector graphics
    doc.save();
    //doc.moveTo(Xcenter, Ycenter);
    const pathPoints = [];
    let x = Xcenter +  size * Math.sin(0);
    let y = Ycenter -  size * Math.cos(0);
    pathPoints.push({x:x,y:y});
    const bywayPoints = [];
    doc.lineWidth(connectionStroke);
    for (let i = 1 ; i <= numberOfSides; i++){
        let newX = Xcenter + size * Math.sin(i * 2 * Math.PI / numberOfSides);
        let newY = Ycenter - size * Math.cos(i * 2 * Math.PI / numberOfSides);
        pathPoints.push({x:newX,y:newY});

        doc.moveTo(x, y).lineTo(newX, newY);
        x=newX;
        y=newY;
    }
    doc.stroke();
    x = y = null;

    for(let i = 1; i < pathPoints.length; i++){
        const x = pathPoints[i].x;
        const y = pathPoints[i].y;
        let bywayX = null;
        let bywayY = null;
        if (i > 0){
            // on-line byways (halfway between)
            bywayX = (x + pathPoints[i-1].x)/2;
            bywayY = (y + pathPoints[i-1].y)/2;
            bywayPoints.push({x:bywayX, y:bywayY});

            //center byways (between each and two up, shifted out from the center)
            bywayX = (x + pathPoints[(i+2)%numberOfSides].x)/2;
            bywayY = (y + pathPoints[(i+2)%numberOfSides].y)/2;

            let lenAB = Math.sqrt(Math.pow( bywayX - Xcenter, 2.0) + Math.pow(bywayY - Ycenter, 2.0));
            bywayX  = bywayX + (bywayX - Xcenter) / lenAB * bywayPush;
            bywayY  = bywayY + (bywayY - Ycenter) / lenAB * bywayPush;

            doc.moveTo(x, y).lineTo(bywayX, bywayY).lineWidth(connectionStroke).stroke();
            bywayPoints.push({x:bywayX, y:bywayY});

            // byway lines

            bywayX = (x + pathPoints[(i+(numberOfSides - 2))%numberOfSides].x)/2;
            bywayY = (y + pathPoints[(i+(numberOfSides - 2))%numberOfSides].y)/2;

            lenAB = Math.sqrt(Math.pow( bywayX - Xcenter, 2.0) + Math.pow(bywayY - Ycenter, 2.0));

            bywayX  = bywayX + (bywayX - Xcenter) / lenAB * bywayPush;
            bywayY  = bywayY + (bywayY - Ycenter) / lenAB * bywayPush;

            doc.moveTo(x, y).lineTo(bywayX, bywayY).lineWidth(connectionStroke).stroke();

            // Outer byways
            lenAB = Math.sqrt(Math.pow( x - Xcenter, 2.0) + Math.pow(y - Ycenter, 2.0));
            bywayX  = x + (x - Xcenter) / lenAB * bywayPush*3;
            bywayY  = y + (y - Ycenter) / lenAB * bywayPush*3;
            bywayPoints.push({x:bywayX, y:bywayY});
            doc.moveTo(x, y).lineTo(bywayX, bywayY).lineWidth(connectionStroke).stroke();

            if (numberOfSides > 5 && i%2){
                lenAB = Math.sqrt(Math.pow( x - Xcenter, 2.0) + Math.pow(y - Ycenter, 2.0));
                bywayX  = x - (bywayX - Xcenter) / lenAB * bywayPush * 4.3;
                bywayY  = y - (bywayY - Ycenter) / lenAB * bywayPush * 4.3;
                bywayPoints.push({x:bywayX, y:bywayY});

                doc.moveTo(x, y).lineTo(bywayX, bywayY).lineWidth(connectionStroke).stroke();

                const pathX = pathPoints[(i+(numberOfSides - 3))%numberOfSides].x;
                const pathY = pathPoints[(i+(numberOfSides - 3))%numberOfSides].y;

                //lenAB = Math.sqrt(Math.pow( bywayX - Xcenter, 2.0) + Math.pow(bywayY - Ycenter, 2.0));
                doc.moveTo(pathX, pathY).lineTo(bywayX, bywayY).lineWidth(connectionStroke).stroke();


            }

        }
        let pathColor = '#FFFFFF';
        if (_.findWhere(sources, {name: paths[i-1]})){
            pathColor = '#aaaaaa';
        }
        if(noFill){
            doc.rect(x-objSize,y-objSize,objSize*2,objSize*2).lineWidth(objStroke).fillColor(pathColor).stroke();

        } else {
            doc.rect(x-objSize,y-objSize,objSize*2,objSize*2).lineWidth(objStroke).fillColor(pathColor).fillAndStroke();
        }

    }
    for(let i = 0; i < bywayPoints.length; i++){
        const x = bywayPoints[i].x;
        const y = bywayPoints[i].y;
        let bywayColor = '#FFFFFF';
        if (_.findWhere(sources, {name: byways[i]})){
            bywayColor = '#aaaaaa';
        }
        if (noFill){
            doc.circle(x, y, objSize).fillColor(bywayColor).lineWidth(objStroke).stroke();
        } else {
            doc.circle(x, y, objSize).fillColor(bywayColor).lineWidth(objStroke).fillAndStroke();
        }
    }
    return {
        paths: pathPoints,
        byways: bywayPoints,
        objSize: objSize,
        objStroke: objStroke
    };

};
