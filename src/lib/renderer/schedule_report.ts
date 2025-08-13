'use strict';
import PDFDocument from 'pdfkit';
import _ from 'underscore';
import models from '../models';
import markdown from './markdown';
import pdfHelper from '../pdfHelper';
import scheduleHelper from '../scheduleHelper';

async function renderReport(eventId:number, reportName:string, options): Promise<PDFKit.PDFDocument>{
    if (!_.has(options, 'margin')){
        options.margin = 36;
    }
    const doc = new PDFDocument({autoFirstPage: false, size: 'LETTER', margin: options.margin});

    const event = await models.event.get(eventId);
    const campaign = await models.campaign.get(event.campaign_id);

    const fontOptions = {
        useDefaults: false,
        titleFontId: (await models.font.findOne({campaign_id:campaign.id, name: options.font.title.name})).id,
        headerFontId: (await models.font.findOne({campaign_id:campaign.id, name: options.font.header.name})).id,
        bodyFontId: (await models.font.findOne({campaign_id:campaign.id, name: options.font.body.name})).id
    };

    options.titleScale = options.font.title.scale;
    options.headerScale = options.font.body.scale;
    options.bodyScale = options.font.body.scale;

    const sizeDoc = new PDFDocument({size: 'LETTER'});

    await pdfHelper.registerFonts(doc, fontOptions);
    await pdfHelper.registerFonts(sizeDoc, fontOptions);

    switch (reportName){
        case 'player': await playerReport(); break;
    }

    return doc;

    async function playerReport(){
        for (const attendee of event.attendees){
            if (!attendee.attending) { continue; }
            if (attendee.user.type !== 'player'){ continue; }
            if (!_.has(options, 'indent')){
                options.indent = options.margin / 2;
            }
            doc.addPage();
            await renderHeader(attendee);
            doc.moveDown(1);
            await renderSchedule(attendee);
        }

        async function renderHeader(attendee){
            doc.strokeColor('#000000')
                .fillColor('#000000');
            const headerText = `${options.titlePrefix}: ${attendee.character.name}`;
            doc
                .font('Title Font Bold')
                .fontSize(24 * options.font.title.scale)
                .text(headerText, options.margin, options.margin, {
                    width:doc.page.width - (options.margin*2),
                    align:'center'
                });

            if (options.extraTitle){
                const field = await models.custom_field.findOne({campaign_id:campaign.id, name:options.extraTitle});
                if (!field){ throw new Error('header field not found'); }
                const fieldData = await models.character_custom_field.findOne({character_id: attendee.character.id, custom_field_id:field.id});
                if (fieldData && fieldData.value !== null){
                    doc
                        .font('Title Font')
                        .fontSize(20 * options.font.title.scale)
                        .text(fieldData.value, {
                            width:doc.page.width - (options.margin*2),
                            align:'center'
                        });
                };

            }
        }

        async function renderSchedule(attendee){
            const top = doc.y;

            const columnWidth = (doc.page.width - (options.margin*2) - ((options.columns -1) * options.margin * 0.5)) / options.columns
            const schedule = await scheduleHelper.getUserSchedule(eventId, attendee.user.id, false, true);
            for (const timeslot of schedule){
                let timeslotName = timeslot.name;
                if (options.timeslotDisplay === 'label' && timeslot.display_name){
                    timeslotName = timeslot.display_name
                }
                doc
                    .font('Header Font Bold')
                    .fontSize(18 * options.font.header.scale)
                    .text(timeslotName, {width:columnWidth})
                doc.x += options.indent;
                for (const scene of timeslot.scenes){

                    let sceneName = scene.name;
                    if (options.scene.location && scene.locations.confirmed && scene.locations.confirmed.length ){
                        sceneName += ` - ${(_.pluck(scene.locations.confirmed, 'name')).join(', ')}`;
                    }

                    doc
                        .font('Body Font')
                        .fontSize(20 * options.font.body.scale)
                        .text(sceneName, {
                            width:columnWidth - options.indent,
                        });


                    if (options.scene.description && scene.description){
                        doc
                            .font('Body Font')
                            .fontSize(18 * options.font.body.scale)
                        doc.moveDown(0.5);
                        markdown(doc, scene.description, {
                            width:columnWidth - options.indent,
                        });
                    }

                    if (options.scene['printout note'] && scene.printout_note){
                        doc
                            .font('Body Font')
                            .fontSize(18 * options.font.body.scale)
                        doc.moveDown(0.5);
                        markdown(doc, scene.printout_note, {
                            width:columnWidth - options.indent,
                        });
                    }
                }
                if (timeslot.schedule_busy){
                    doc
                        .font('Body Font')
                        .fontSize(20 * options.font.body.scale)
                        .text(timeslot.schedule_busy.name, {
                            width:columnWidth - options.indent,
                        });
                }
                doc.x -= options.indent;
                if (doc.page.height - doc.y < options.margin*4){
                    doc.y = top;
                    doc.x += (columnWidth + (options.margin*0.5))
                }
            }
        }

    }
}

export default renderReport;
