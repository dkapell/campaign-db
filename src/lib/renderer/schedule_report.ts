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
    if (!_.has(options, 'boldStrokeWidth')){
        options.boldStrokeWidth = 0.1;
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
        case 'scenes': await scenesReport(); break;
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

            const headerText = `${options.titlePrefix}: ${attendee.character.name}`;
            doc
                .lineWidth(options.boldStrokeWidth)
                .font('Title Font Bold')
                .fontSize(24 * options.font.title.scale)
                .text(headerText, options.margin, options.margin, {
                    width:doc.page.width - (options.margin*2),
                    align:'center',
                    stroke:options.font.header.strokeForBold, fill:true
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
                            align:'center',
                            stroke:false, fill:true
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
                    timeslotName = timeslot.display_name as string
                }
                doc
                    .font('Header Font Bold')
                    .fontSize(18 * options.font.header.scale)
                    .text(timeslotName, {width:columnWidth, stroke:options.font.header.strokeForBold, fill:true})
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
                            stroke:false, fill:true
                        });


                    if (options.scene.description && scene.description){
                        doc
                            .font('Body Font')
                            .fontSize(18 * options.font.body.scale)
                        doc.moveDown(0.5);
                        markdown(doc, scene.description, {
                            width:columnWidth - options.indent,
                            stroke:false, fill:true
                        });
                    }

                    if (options.scene['printout note'] && scene.printout_note){
                        doc
                            .font('Body Font')
                            .fontSize(18 * options.font.body.scale)
                        doc.moveDown(0.5);
                        markdown(doc, scene.printout_note, {
                            width:columnWidth - options.indent,
                            stroke:false, fill:true
                        });
                    }
                }
                if (timeslot.schedule_busy){
                    doc
                        .font('Body Font')
                        .fontSize(20 * options.font.body.scale)
                        .text(timeslot.schedule_busy.name, {
                            width:columnWidth - options.indent,
                            stroke:false, fill:true
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

    async function scenesReport(){
        const scenes = await models.scene.find({event_id:eventId}); // status?
        for (let scene of scenes){
            scene = await scheduleHelper.formatScene(scene);
            doc.addPage();
            for (const section of options.sections){
                switch (section.type){
                    case 'header': renderHeader(scene, section); break;
                    case 'name': renderName(scene, section); break;
                    case 'timeslot': renderTimeslot(scene, section); break;
                    case 'location': renderLocation(scene, section); break;
                    case 'players': renderPlayers(scene, section); break;
                    case 'description': renderDescription(scene, section); break;
                    case 'printout note': renderPrintoutNote(scene, section); break;
                }
            }
        }
        return doc;

        function renderHeader(scene, sectionOptions){
            doc.strokeColor('#000000')
                .fillColor('#000000')
                .lineWidth(options.boldStrokeWidth);
            doc
                .font('Title Font Bold')
                .fontSize(24 * options.font.title.scale)
                .text(sectionOptions.title, options.margin, options.margin, {
                    width:doc.page.width - (options.margin*2),
                    align:sectionOptions.align?sectionOptions:'center',
                    stroke:options.font.header.strokeForBold,
                    fill:true
                });
            doc.moveDown(0.5);
        }

        function renderName(scene, sectionOptions){
            doc.strokeColor('#000000')
                .fillColor('#000000')
                .lineWidth(options.boldStrokeWidth);
            doc
                .font('Header Font Bold')
                .fontSize(18 * options.font.header.scale)
                .text(`${sectionOptions.name?sectionOptions.name:'Scene Name'}: `,
                    {continued:true, stroke:options.font.header.strokeForBold, fill:true});

            let sceneName = scene.name;
            if (scene.player_name){
                sceneName = scene.player_name;
            }
            doc
                .font('Body Font')
                .fontSize(18 * options.font.body.scale)
                .text(sceneName, {stroke:false, fill:true});

            doc.moveDown(0.5);

        }

        function renderTimeslot(scene, sectionOptions){
            doc.strokeColor('#000000')
                .fillColor('#000000')
                .lineWidth(options.boldStrokeWidth);
            doc.x += options.margin;
            doc
                .font('Header Font Bold')
                .fontSize(18 * options.font.header.scale)
                .text(`${sectionOptions.name?sectionOptions.name:'Timeslot(s)'}: `,
                    {continued:true, stroke:options.font.header.strokeForBold, fill:true, indent:-options.margin});

            const timeslots = [];
            if (scene.timeslots.confirmed){
                for (const timeslot of scene.timeslots.confirmed){
                    if (sectionOptions.display === 'label' && timeslot.display_name){
                        timeslots.push(timeslot.display_name);
                    } else {
                        timeslots.push(timeslot.name);
                    }
                }
            }
            if (scene.timeslots.suggested){
                for (const timeslot of scene.timeslots.suggested){
                    if (sectionOptions.display === 'label' && timeslot.display_name){
                        timeslots.push(timeslot.display_name);
                    } else {
                        timeslots.push(timeslot.name);
                    }
                }
            }
            doc
                .font('Body Font')
                .fontSize(18 * options.font.body.scale)
                .text(timeslots.join(', '), {stroke:false, fill:true, indent:-options.margin});
            doc.x -= options.margin;
            doc.moveDown(0.5);

        }

        function renderLocation(scene, sectionOptions){
            doc.strokeColor('#000000')
                .fillColor('#000000')
                .lineWidth(options.boldStrokeWidth);
            doc.x += options.margin;
            doc
                .font('Header Font Bold')
                .fontSize(18 * options.font.header.scale)
                .text(`${sectionOptions.name?sectionOptions.name:'Location(s)'}: `,
                    {continued:true, stroke:options.font.header.strokeForBold, fill:true, indent:-options.margin});

            const locations = [];
            if (scene.locations.confirmed){
                for (const location of scene.locations.confirmed){
                    if (sectionOptions.display === 'label' && location.display_name){
                        locations.push(location.display_name);
                    } else {
                        locations.push(location.name);
                    }
                }
            }
            if (scene.locations.suggested){
                for (const location of scene.locations.suggested){
                    if (sectionOptions.display === 'label' && location.display_name){
                        locations.push(location.display_name);
                    } else {
                        locations.push(location.name);
                    }
                }
            }
            doc
                .font('Body Font')
                .fontSize(18 * options.font.body.scale)
                .text(locations.join(', '), {stroke:false, fill:true, indent:-options.margin});
            doc.x -= options.margin;

            doc.moveDown(0.5);
        }

        function renderPlayers(scene, sectionOptions){
            doc.strokeColor('#000000')
                .fillColor('#000000')
                .lineWidth(options.boldStrokeWidth);
            doc.x += options.margin;
            doc
                .font('Header Font Bold')
                .fontSize(18 * options.font.header.scale)
                .text(`${sectionOptions.name?sectionOptions.name:'Players(s)'}: `,
                    {continued:true, stroke:options.font.header.strokeForBold, fill:true, indent:-options.margin});

            const players = [];
            if (scene.players.confirmed){
                for (const player of scene.players.confirmed){
                    if (sectionOptions.characters){
                        players.push(player.character.name);
                    } else {
                        players.push(player.name);
                    }
                }
            }
            if (scene.players.suggested){
                for (const player of scene.players.suggested){
                    if (sectionOptions.characters){
                        players.push(player.character.name);
                    } else {
                        players.push(player.name);
                    }
                }
            }
            doc
                .font('Body Font')
                .fontSize(18 * options.font.body.scale)
                .text(players.join(', '), {stroke:false, fill:true, indent:-options.margin});
            doc.x -= options.margin;
            doc.moveDown(0.5);

        }

        function renderDescription(scene, sectionOptions){
            doc.strokeColor('#000000')
                .fillColor('#000000')
                .lineWidth(options.boldStrokeWidth);
            if (!scene.description){ return; }
            if (sectionOptions.name !== ''){
                doc
                    .font('Header Font Bold')
                    .fontSize(18 * options.font.header.scale)
                    .text(`${sectionOptions.name?sectionOptions.name:'Description'}: `,
                        {stroke:options.font.header.strokeForBold, fill:true});
            }
            if (!sectionOptions.noIndent){
                doc.x += options.margin;
            }
            markdown(doc, scene.description.replace(/\n/g, '\n\n'), {stroke:false, fill:true, noLinks:true});
            if (!sectionOptions.noIndent){
                doc.x -= options.margin;
            }
            doc.moveDown(0.5);
        }

        function renderPrintoutNote(scene, sectionOptions){
            doc.strokeColor('#000000')
                .fillColor('#000000')
                .lineWidth(options.boldStrokeWidth);
            if (!scene.printout_note){ return; }
            if (sectionOptions.name !== ''){
                doc
                    .font('Header Font Bold')
                    .fontSize(18 * options.font.header.scale)
                    .text(`${sectionOptions.name?sectionOptions.name:'Note'}: `,
                        {stroke:options.font.header.strokeForBold, fill:true});
            }
            doc.x += options.margin;
            markdown(doc, scene.printout_note, {stroke:false, fill:true, noLinks:true});
            doc.x -= options.margin;
            doc.moveDown(0.5);

        }
    }
}

export default renderReport;

