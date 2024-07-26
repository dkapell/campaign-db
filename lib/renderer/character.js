'use strict';
const addTextbox = require('textbox-for-pdfkit');
const PDFDocument = require('pdfkit');
const config = require('config');
const _ = require('underscore');
const moment = require('moment');
const models = require('../models');
const Drive = require('../Drive');
const markdown = require('./markdown');

const fs = require('fs');


const colors = {
    success: '#18bc9c',
    warning: '#f39c12',
    danger: '#e74c3c',
    primary: '#2c3e50',
    secondary: '#95a5a6',
    info: '#3498db',
    dark: '#7b8a8b'
};
module.exports = async function renderCharacter(character, options){
    if (!options) {
        options = {};
    }
    const doc = new PDFDocument({size: 'LETTER'});

    if (!_.has(options, 'margin')){
        options.margin = 20;
    }
    registerFonts(doc);

    // Draw a nice border
    doc.on('pageAdded', () => {
        renderPage(false);
    });
    renderPage(true);

    let row = options.margin;
    row = renderHeader();

    row = renderAttributes(row);

    const tagHeight = renderTagSkills(row);

    const languageHeight = renderLanguages(row);

    doc.text('', options.margin + 10, Math.max(row, tagHeight, languageHeight) + 10);

    renderDiagnose();

    const skills = _.reject(character.provides.skills, function(skill){
        return _.has(skill.details, 'hide_on_sheet') && skill.details.hide_on_sheet;
    });

    const grouped = _.groupBy(skills, 'usage_id');

    const skill_usages = await models.skill_usage.find({campaign_id: character.campaign_id});
    for (const usage of skill_usages){
        if (_.has(grouped, ''+usage.id)){
            renderSkills(grouped[''+usage.id]);
        }
    }

    if (options.skillDescriptions){
        doc.addPage({margin: options.margin*2});
        renderAllSkills();
    }

    return doc;

    function addText(text, options, maxFontSize, x, y, maxWidth, maxHeight){
        if (!options.font){
            options.font = 'Body Font';
        }
        const features = {
            width: maxWidth,
            lineBreak: !options.nowrap
        };
        if (options.align){
            features.align = options.align;
        }

        doc
            .font(options.font)
            .fontSize(sizeText(text, options, maxWidth, maxHeight, maxFontSize))
            .text(text, x, y, features);
    }



    function renderHeader(){
        doc.strokeColor('#000000')
            .fillColor('#000000');
        const maxNameWidth = doc.page.width - (options.margin*2 + 220);
        const maxTraitWidth = doc.page.width - (options.margin*2 + 220);
        addText(character.name, {font: 'Header Font', nowrap:true}, 26, options.margin + 10, options.margin + 5, maxNameWidth, 100);
        addText(character.user.name, {font: 'Header Font', nowrap:true}, 8, options.margin + 10, options.margin + 35, maxNameWidth/2, 100);
        addText(`${character.cp} CP`, {font: 'Header Font', nowrap:true}, 8, options.margin + maxNameWidth/2, options.margin + 35, maxNameWidth/2, 100);

        // List Traits by category
        let traitRow = options.margin + 45;
        for (const traitType in character.provides.traits){
            const traits = character.provides.traits[traitType];
            addText(`${capitalize(traitType)} Traits`, {font: 'Body Font Bold', nowrap:true}, 12, options.margin + 10, traitRow, 90, 12);
            addText(traits.join(', '), {nowrap:true}, 12, options.margin + 110, traitRow, maxTraitWidth - 90, 12);
            traitRow += 15;
        }

        // List Weapon Styles
        addText('Weapon Styles', {font: 'Body Font Bold', nowrap:true}, 12, options.margin+10, traitRow, 90, 12);
        const styles = [];
        for (const style in character.provides.styles){
            let styleStr = style;
            const quantity = character.provides.styles[style];
            if (quantity > 1){
                styleStr += ` (${quantity})`;
            }
            styles.push(styleStr);
        }
        addText(styles.join(', '), {nowrap:true}, 12, options.margin + 110, traitRow, maxTraitWidth - 90, 12);
        traitRow += 15;

        // List Sources
        const sources = _.groupBy(character.sources, (item) => {
            if (!item.type.display_on_sheet){
                return 'skip';
            }
            return item.type.name;
        });

        let headerRow = options.margin+5;
        for (const sourceType in sources){
            if (sourceType === 'skip'){
                continue;
            }
            addText(capitalize(sourceType), {font: 'Body Font Bold'}, 10, doc.page.width - (options.margin + 200), headerRow, 70, 15 );
            for (const source of sources[sourceType]){
                addText(source.name, {nowrap: true}, 10, doc.page.width - (options.margin + 125), headerRow, 70, 15 );
                headerRow += 15;
            }
        }

        return Math.max(traitRow, headerRow);
    }

    function renderAttributes(row){
        const attributeBoxHeight = 40;

        const numAttributes = character.provides.attributes.length;

        doc.lineWidth(0.5).rect(options.margin+10, row, doc.page.width - (options.margin*2 + 20), attributeBoxHeight).stroke();

        const attributeWidth = (doc.page.width - (options.margin*2 + 20)) / numAttributes;

        let offsetX = options.margin + 10 + 5;
        let offsetY = row + 5;

        for (const attribute of character.provides.attributes){
            addText(attribute.name, {font: 'Header Font', nowrap:true, align:'center'}, 14, offsetX, offsetY, attributeWidth - 10, 15);
            addText('' + attribute.value, {font: 'Body Font Bold', nowrap:true, align:'center'}, 14, offsetX, offsetY + 15, attributeWidth - 10, 15);
            offsetX += attributeWidth;
        }

        return row + attributeBoxHeight;
    }

    function renderTagSkills(row){
        if (!character.provides.tagskills.length){
            return 0;
        }
        const sectionX = options.margin + 10;
        const sectionY = row + 5;
        const numSections = character.provides.languages.length ? 2 : 1;
        const sectionWidth = (doc.page.width - (options.margin*2) /numSections) - 20;
        const sectionHeader = 'Tag Reading Skills';
        const sectionBody = character.provides.tagskills.join(', ');

        doc.text('', sectionX, sectionY);
        doc.font('Header Font').fontSize(12).text(sectionHeader, {width: sectionWidth});
        let sectionHeight = doc.heightOfString(sectionHeader, {width: sectionWidth});
        doc.x += 5;
        doc.font('Body Font Bold').fontSize(11).text(sectionBody, {width: sectionWidth});
        doc.x -= 5;
        return row + sectionHeight + doc.heightOfString(sectionBody, {width: sectionWidth});
    }
    function renderLanguages(row){
        if (!character.provides.languages.length){
            return 0;
        }

        const numSections = character.provides.tagskills.length?2:1;
        const sectionX = options.margin + 10 + (doc.page.width/2*(numSections-1));
        const sectionY = row + 5;
        const sectionWidth = (doc.page.width - (options.margin*2) /numSections) - 20;

        const sectionHeader = 'Languages';
        const sectionBody = character.provides.languages.join(', ');


        doc.text('', sectionX, sectionY);
        doc.font('Header Font').fontSize(12).text(sectionHeader, {width: sectionWidth});
        let sectionHeight = doc.heightOfString(sectionHeader, {width: sectionWidth});
        doc.x += 5;
        doc.font('Body Font Bold').fontSize(11).text(sectionBody, {width: sectionWidth});
        doc.x -= 5;
        return row + sectionHeight + doc.heightOfString(sectionBody, {width: sectionWidth});
    }


    function renderDiagnose(){
        if (!character.provides.diagnose.length){
            return;
        }
        doc.font('Header Font').fontSize(12).text('Diagnose Traits and Effects');
        doc.x += 5;
        doc.font('Body Font').fontSize(10).text(character.provides.diagnose.join(', '));
        doc.moveDown(0.5);
        doc.x -= 5;
    }

    function renderSkills(skills){

        const skillsReduced = skills.reduce((o, e) => {
            const skill = _.findWhere(o, {name:e.name});
            if (!skill) {
                e.count = 1;
                o.push(e);
            } else {
                skill.count++;
            }
            return o;
        }, []);

        const skillsSorted = _.sortBy(skillsReduced, 'name');

        doc.font('Header Font').fontSize(12).text(`${skills[0].usage?skills[0].usage.name:'Unset Usage'} Skills`);
        doc.x += 5;
        for (const skill of skillsSorted){
            doc.font('Body Font Italic').fontSize(10).text(`${skill.name} `, {
                continued:true,
                paragraphGap:3
            });
            if (skill.count > 1){
                doc.font('Body Font Bold').fontSize(10).text(`X${skill.count} `, {continued:true});
            }

            for (const tag of skill.tags){
                if (tag.display_to_pc && tag.on_sheet){
                    doc.fillColor(colors[tag.color?tag.color:'info']);
                    doc.font('Body Font').fontSize(10).text('[', {continued:true});
                    doc.font('Body Font Bold').fontSize(10).text(tag.name, {continued:true});
                    doc.font('Body Font').fontSize(10).text('] ', {continued:true});
                    doc.fillColor('#000000');
                }
            }

            doc.font('Body Font').fontSize(10).text('- ', {continued:true});

            doc.font('Body Font').fontSize(10);
            if (skill.details && skill.details.sheet_note){
                markdown(doc, skill.summary, {continued:true});
                doc.font('Body Font').text('  ●  ', {continued:true});
                doc.font('Header Font Italic').text(skill.details.sheet_note);
            } else {
                markdown(doc, skill.summary);
            }
        }
        doc.moveDown(0.5);
        doc.x -= 5;

    }

    function renderAllSkills(){

        let skills = _.sortBy(character.skills, 'name');

        const skillsAdded = [];

        for (const skill of skills){
            if (_.indexOf(skillsAdded, skill.id) !== -1){
                continue;
            }
            skillsAdded.push(skill.id);
            if (doc.page.height - doc.y < 72*1.5){
                doc.addPage({margin: 50});
            }

            doc.font('Header Font Italic').fontSize(12).text(`${skill.name} `, {continued:true});

            for (const tag of skill.tags){
                if (tag.display_to_pc){
                    const color = colors[tag.color?tag.color:'info'];
                    doc.fillColor(color).font('Body Font').fontSize(10).text('[', {continued:true});
                    doc.fillColor(color).font('Body Font Bold').fontSize(10).text(tag.name, {continued:true});
                    doc.fillColor(color).font('Body Font').fontSize(10).text('] ', {continued:true});
                    doc.fillColor('#000000');
                }
            }

            doc.font('Header Font').fontSize(12).text(skill.source.name, {align:'right'});

            doc.x += 5;
            doc.fontSize(10);

            const details = [];
            for (const detail of _.pluck(_.where(skills, {id:skill.id}), 'details')){
                if (_.isNull(detail)){
                    continue;
                }
                for (const type of ['trait', 'style', 'attribute', 'language', 'tagskill']){
                    if (detail && _.has(detail, type)){
                        details.push(detail[type]);
                    }
                }
            }

            if (details.length){
                markdown(doc, skill.summary, {continued:true});
                doc.font('Header Font').text(`  [${details.join(', ')}]`);
                doc.moveDown(0.5);


            } else {
                markdown(doc, skill.summary);
            }
            markdown(doc, skill.description);
            if (skill.details && skill.details.sheet_note){
                doc.font('Body Font Bold').text('Sheet Note: ', {continued:true});
                doc.font('Body Font').text(skill.details.sheet_note);
            }
            if (skill.details && skill.details.notes){
                doc.font('Body Font Bold').text('Note: ', {continued:true});
                markdown(doc, skill.details.notes);
            }
            doc.x -= 5;
            doc.moveDown(0.5);

        }

    }

    function renderPage(firstPage){
        const fontSize = doc.fontSize();
        const fillColor = doc.fillColor();
        const strokeColor = doc.strokeColor();
        doc.strokeColor('#000000')
            .fillColor('#000000');
        doc.rect(options.margin, options.margin, doc.page.width - options.margin*2, doc.page.height - options.margin*2).stroke();

        doc.fontSize(8).font('Body Font').text(
            moment().format('lll'),
            options.margin + 2,
            firstPage?doc.page.height - (options.margin + 10):options.margin +2,
            {
                width: doc.page.width - (options.margin*2 + 4),
                height: options.margin,
                align:'right'
            }
        );

        if (!firstPage){
            doc.fontSize(8).font('Body Font').text(
                character.name,
                options.margin + 2,
                options.margin + 2,
                {
                    width: doc.page.width - (options.margin*2 + 4),
                    height: options.margin,
                    align:'left'
                }
            );
        }
        doc.fontSize(fontSize);
        doc.fillColor(fillColor);
        doc.strokeColor(strokeColor);
        doc.x = options.margin*2;
        doc.y = options.margin*2;
    }
};


function sizeText(text, options, maxWidth, maxHeight, maxFontSize){
    const doc = new PDFDocument({size: 'LETTER'});
    registerFonts(doc);

    doc.font(options.font);
    doc.fontSize(maxFontSize);
    let actualSize = maxFontSize;

    while (doc.widthOfString(text) > maxWidth || doc.heightOfString(text) > maxHeight){
        actualSize -= 0.1;
        doc.fontSize(actualSize, {lineBreak: !options.nowrap});
    }
    return actualSize;
}

function registerFonts(doc){
    doc.registerFont('Header Font', __dirname + '/../../fonts/Montserrat-Regular.ttf');
    doc.registerFont('Header Font Bold', __dirname + '/../../fonts/Montserrat-Bold.ttf');
    doc.registerFont('Header Font Italic', __dirname + '/../../fonts/Montserrat-Italic.ttf');
    doc.registerFont('Header Font BoldItalic', __dirname + '/../../fonts/Montserrat-BoldItalic.ttf');
    doc.registerFont('Body Font', __dirname + '/../../fonts/Lato-Regular.ttf');
    doc.registerFont('Body Font Bold', __dirname + '/../../fonts/Lato-Bold.ttf');
    doc.registerFont('Body Font Italic', __dirname + '/../../fonts/Lato-Italic.ttf');
    doc.registerFont('Body Font BoldItalic', __dirname + '/../../fonts/Lato-BoldItalic.ttf');
}

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
