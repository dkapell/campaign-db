'use strict';
import PDFDocument from 'pdfkit';
import _ from 'underscore';
import async from 'async';
import moment from 'moment';
import pluralize from 'pluralize';
import models from '../models';
import markdown from './markdown';
import pdfHelper from '../pdfHelper';
import scheduleHelper from '../scheduleHelper';

async function renderReport(eventId:number, reportName:string, options): Promise<PDFKit.PDFDocument>{
    if (!_.has(options, 'margin')){
        options.margin = 36;
    }
    if (!_.has(options, 'indent')){
        options.indent = options.margin;
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
        case 'scenelabels': await sceneLabelsReport(); break;
        case 'schedule_busy': await scheduleBusyReport(); break;
    }
    return doc;

    async function playerReport(){
        const players = event.attendees
            .filter(attendee => { return attendee.attending && attendee.user.type === 'player'})
            .sort((a,b) => { return a.character.name.localeCompare(b.character.name);})
        const schedule = await scheduleHelper.getSchedule(eventId);
        for (const attendee of players){
            if (!attendee.attending) { continue; }
            if (attendee.user.type !== 'player'){ continue; }
            if (!_.has(options, 'indent')){
                options.indent = options.margin / 2;
            }
            doc.addPage();
            await renderHeader(attendee);
            doc.moveDown(0.5);
            await renderSchedule(attendee, schedule);
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

        function fillHeight(segment){
            if (segment.markdown){
                doc
                    .font(segment.font)
                    .fontSize(segment.size);
                segment.height = markdown(doc, segment.text, {width:segment.width, getHeight:true});
            } else {
                segment.height = doc
                    .font(segment.font)
                    .fontSize(segment.size)
                    .heightOfString(segment.text, {width:segment.width, fill:true, stroke:segment.stroke});
            }
            if (segment.moveDown){
                segment.height += doc.heightOfString('A') * segment.moveDown;
            }
            return segment;
        }

        async function renderSchedule(attendee, eventSchedule){
            let top = doc.y;

            const columnWidth = (doc.page.width - (options.margin*2) - ((options.columns -1) * options.margin * 0.5)) / options.columns
            const schedule = await scheduleHelper.getUserSchedule(eventId, attendee.user.id, true, false, eventSchedule);
            let column = 0;
            for (const timeslot of schedule){
                if (options.ignoreTimeslots && _.indexOf(options.ignoreTimeslots, timeslot.id) !== -1){
                    continue;
                }

                const timeslotSegments = [];


                const timeslotHeaderSegment = {
                    text: timeslot.name,
                    font: 'Header Font Bold',
                    size: 18 * options.font.header.scale,
                    stroke: options.font.header.strokeForBold,
                    width: columnWidth,
                    offset: 0,
                    moveDown: 0.5
                }

                if (options.timeslotDisplay === 'label' && timeslot.display_name){
                    timeslotHeaderSegment.text = timeslot.display_name as string
                }

                timeslotSegments.push(fillHeight(timeslotHeaderSegment));

                for (const scene of timeslot.scenes){
                    let sceneName = scene.name;
                    if (options.scene.location && scene.locations.confirmed && scene.locations.confirmed.length ){
                        sceneName += ` - ${(_.pluck(scene.locations.confirmed, 'name')).join(', ')}`;
                    }
                    const sceneNameSegment = {
                        text: sceneName,
                        font: scene.non_exclusive?'Body Font Italic':'Body Font',
                        size: 20 * options.font.body.scale,
                        stroke: false,
                        width: columnWidth - options.indent,
                        offset: options.indent,
                        moveDown: 0
                    }
                    timeslotSegments.push(fillHeight(sceneNameSegment));

                    if (options.scene.description && scene.description){
                        timeslotSegments.push(fillHeight({
                            text: scene.description,
                            font: 'Body Font',
                            size: 18 * options.font.body.scale,
                            stroke: false,
                            width: columnWidth - options.indent,
                            offset: options.indent,
                            moveDown: 0.5,
                            markdown:true
                        }));
                    }
                    if (options.scene['printout note'] && scene.printout_note){
                        timeslotSegments.push(fillHeight({
                            text: scene.printout_note,
                            font: 'Body Font',
                            size: 18 * options.font.body.scale,
                            stroke: false,
                            width: columnWidth - options.indent,
                            offset: options.indent,
                            moveDown: 0.5,
                            markdown:true
                        }));
                    }
                }
                if (timeslot.schedule_busy){
                    timeslotSegments.push(fillHeight({
                        text: timeslot.schedule_busy.name,
                        font: 'Body Font',
                        size: 20 * options.font.body.scale,
                        stroke: false,
                        width: columnWidth - options.indent,
                        offset: options.indent,
                        moveDown: 0.5,
                    }));
                }

                const totalHeight = _.pluck(timeslotSegments, 'height').reduce((s,i) => {
                    s+=i;
                    return s;
                }, 0);

                if (doc.page.height - (doc.y + totalHeight) < options.margin){
                    column++;
                    if (column === options.columns){
                        column = 0;
                        doc.addPage();
                        top = options.margin;
                        doc.x = options.margin;
                    } else {
                        doc.x += (columnWidth + (options.margin*0.5));
                    }

                    doc.y = top;
                }

                for (const segment of timeslotSegments){
                    doc
                        .font(segment.font)
                        .fontSize(segment.size)
                    doc.x += segment.offset;
                    if (segment.moveDown){
                        doc.moveDown(segment.moveDown);
                    }

                    if (segment.markdown){
                        markdown(doc, segment.text, {
                            width:segment.width,
                            stroke:segment.stroke, fill:true
                        });
                    } else {
                        doc.text(segment.text, {
                            width:segment.width,
                            stroke:segment.stroke,
                            fill:true
                        });
                    }
                    doc.x -= segment.offset;
                }
            }
        }
    }

    async function scenesReport(){
        const allTimeslots = await models.timeslot.find({campaign_id:campaign.id});
        const scenes = (await models.scene.find({event_id:eventId, status:'confirmed'}))
            .sort((a,b) => {
                const aTimeslots = a.timeslots.filter(timeslot => { return timeslot.scene_schedule_status === 'confirmed'});
                const bTimeslots = b.timeslots.filter(timeslot => { return timeslot.scene_schedule_status === 'confirmed'});
                const aTimeslotIdx = _.findIndex(allTimeslots, {id: aTimeslots[0].id});
                const bTimeslotIdx = _.findIndex(allTimeslots, {id: bTimeslots[0].id});
                if (aTimeslots !== bTimeslotIdx){
                    return aTimeslotIdx - bTimeslotIdx
                }
                return a.name.localeCompare(b.name);
            });
        for (let scene of scenes){
            scene = scheduleHelper.formatScene(scene);
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

            doc
                .font('Body Font')
                .fontSize(18 * options.font.body.scale)
                .text(locations.join(', '), {stroke:false, fill:true, indent:-options.margin});
            doc.x -= options.margin;

            doc.moveDown(0.5);
        }

        function renderPlayers(scene, sectionOptions){
            if (!scene.assign_players){
                return;
            }
            doc.strokeColor('#000000')
                .fillColor('#000000')
                .lineWidth(options.boldStrokeWidth);
            doc.x += options.margin;
            let sectionName = sectionOptions.name?sectionOptions.name:'Player';
            let shortName = sectionOptions.shortName?sectionOptions.shortName:'Player';

            const players = [];
            if (scene.players.confirmed){
                for (const player of scene.players.confirmed){
                    if (sectionOptions.characters){
                        players.push(player.character.name);
                    } else {
                        players.push(player.name);
                    }
                }
                if (players.length > 1){
                    sectionName = pluralize.plural(sectionName);
                }

                if (scene.player_count_max - scene.players.confirmed.length > 0 && !scene.for_anyone){
                    if (scene.player_count_max - scene.players.confirmed.length > 1){
                        shortName = pluralize.plural(shortName);
                    }
                    players.push(`+ up to ${scene.player_count_max - scene.players.confirmed.length} ${shortName}`);

                }
                if (scene.for_anyone){
                    players.push('Anyone');
                }

            }

            doc
                .font('Header Font Bold')
                .fontSize(18 * options.font.header.scale)
                .text(`${sectionName}: `,
                    {continued:true, stroke:options.font.header.strokeForBold, fill:true, indent:-options.margin});

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

    async function sceneLabelsReport(){
        const allTimeslots = await models.timeslot.find({campaign_id:campaign.id});
        const scenes = (await models.scene.find({event_id:eventId, status:'confirmed'}))

        if (options.order && options.order == 'timeslot'){
            scenes.sort((a,b) => {
                const aTimeslots = a.timeslots.filter(timeslot => { return timeslot.scene_schedule_status === 'confirmed'});
                const bTimeslots = b.timeslots.filter(timeslot => { return timeslot.scene_schedule_status === 'confirmed'});
                const aTimeslotIdx = _.findIndex(allTimeslots, {id: aTimeslots[0].id});
                const bTimeslotIdx = _.findIndex(allTimeslots, {id: bTimeslots[0].id});
                if (aTimeslots !== bTimeslotIdx){
                    return aTimeslotIdx - bTimeslotIdx
                }
                return a.name.localeCompare(b.name);
            });
        }

        if (scenes.length){
            doc.addPage({margins:options.margins});
        }
        if (!_.has(options, 'listAfter')){
            options.listAfter = {players: 12, staff:8 }
        }
        if (!_.has(options.listAfter, 'players')){
            options.listAfter.players = 12
        }
        if (!_.has(options.listAfter, 'staff')){
            options.listAfter.staff = 8
        }
        if (!_.has(options, 'countAfter')){
            options.countAfter = {players: 22, staff:20 }
        }
        if (!_.has(options.countAfter, 'players')){
            options.countAfter.players = 22
        }
        if (!_.has(options.countAfter, 'staff')){
            options.countAfter.staff = 20
        }

        const pageWidth = doc.page.width - (options.margins.right + options.margins.left);
        const cellWidth = (pageWidth - (options.gutter.horizontal * (options.columns - 1)))/options.columns;
        const pageHeight = doc.page.height - (options.margins.top + options.margins.bottom);
        const cellHeight = (pageHeight - (options.gutter.vertical * (options.rows - 1)))/options.rows;
        const cellContentsWidth = cellWidth - (options.innerMargin * 2);
        let currentColumn = 0;
        let currentRow = 0;
        let first = true;

        for (let scene of scenes){
            scene = scheduleHelper.formatScene(scene);
            if (!first && currentColumn === 0 && currentRow === 0){
                doc.addPage({margins:options.margins});
            }
            first = false;
            const x = options.margins.left + (cellWidth * currentColumn) + (currentColumn * options.gutter.horizontal);
            const y = options.margins.top + (cellHeight * currentRow) + (currentRow * options.gutter.vertical);
            doc.x = x + options.innerMargin
            doc.y = y + options.innerMargin
            doc.strokeColor('#eeeeee').rect(x, y, cellWidth, cellHeight).stroke();

            const dateStr = moment(event.start_time).format('ll');

            doc
                .font('Body Font')
                .fontSize(8*options.font.body.scale)
                .text( dateStr, x+4, y+3, {
                    width: cellWidth-8,
                    align:'right'
                });
            doc
                .font('Body Font')
                .fontSize(8*options.font.body.scale)
                .text(event.name, x+4, y+3, {
                    width: cellWidth-8,
                    align:'left'
                });

            doc.x = x + options.innerMargin
            doc.y = y + options.innerMargin

            for (const section of options.sections){
                switch (section){
                    case 'name': renderName(scene); break;
                    case 'responsible': renderResponsible(scene); break;
                    case 'timeslot': renderTimeslot(scene); break;
                    case 'location': renderLocation(scene); break;
                    case 'users': renderUsers(scene); break;
                    case 'players': renderPlayers(scene); break;
                    case 'staff': renderStaff(scene); break;
                }
            }
            if (currentColumn+1 < options.columns){
                currentColumn++;
            } else if (currentRow+1 < options.rows) {
                currentColumn = 0;
                currentRow++;
            } else {
                currentColumn = 0;
                currentRow = 0;
            }
        }
        return doc;

        function renderName(scene){
            doc.strokeColor('#000000')
                .fillColor('#000000')
                .lineWidth(options.boldStrokeWidth);
            doc
                .font('Title Font Bold')
                .fontSize(14 * options.font.title.scale)
                .text(scene.name, {
                    width:cellContentsWidth,
                    align:'center',
                    stroke:options.font.header.strokeForBold,
                    fill:true
                });
            doc.moveDown(0.25);
        }
        function renderResponsible(scene){
            const sectionY = doc.y;
            const sectionX = doc.x;
            const sectionWidth = (cellContentsWidth - 18) / 2

            doc.strokeColor('#000000')
                .fillColor('#000000')
                .lineWidth(options.boldStrokeWidth);
            if (scene.writer){
                doc
                    .font('Header Font Bold')
                    .fontSize(10 * options.font.header.scale)
                    .text('Writer: ', doc.x, doc.y,
                        {continued:true, stroke:options.font.header.strokeForBold, fill:true, width:sectionWidth});

                doc
                    .font('Body Font')
                    .fontSize(10 * options.font.body.scale)
                    .text(scene.writer.name, {stroke:false, fill:true, width:sectionWidth});
            }
            if (scene.runner){
                doc
                    .font('Header Font Bold')
                    .fontSize(10 * options.font.header.scale)
                    .text('Runner: ', doc.x + sectionWidth + 19, sectionY,
                        {continued:true, stroke:options.font.header.strokeForBold, fill:true, width:sectionWidth});

                doc
                    .font('Body Font')
                    .fontSize(10 * options.font.body.scale)
                    .text(scene.runner.name, {stroke:false, fill:true, width:sectionWidth});
            }
            doc.x = sectionX;
            doc.moveDown(0.25);
        }
        function renderTimeslot(scene){
            doc.strokeColor('#000000')
                .fillColor('#000000')
                .lineWidth(options.boldStrokeWidth);
            doc.x += options.indent;
            doc
                .font('Header Font Bold')
                .fontSize(10 * options.font.header.scale)
                .text('Timeslot(s): ', {
                    continued:true,
                    stroke:options.font.header.strokeForBold,
                    fill:true,
                    indent:-options.indent,
                    width:cellContentsWidth - options.indent
                });

            const timeslots = [];
            if (scene.timeslots.confirmed){
                for (const timeslot of scene.timeslots.confirmed){
                    if (options.timeslotDisplay === 'label' && timeslot.display_name){
                        timeslots.push(timeslot.display_name);
                    } else {
                        timeslots.push(timeslot.name);
                    }
                }
            }
            doc
                .font('Body Font')
                .fontSize(10 * options.font.body.scale)
                .text(timeslots.join(', '), {stroke:false, fill:true, indent:-options.indent});
            doc.x -= options.indent;
            doc.moveDown(0.25);

        }

        function renderLocation(scene){
            doc.strokeColor('#000000')
                .fillColor('#000000')
                .lineWidth(options.boldStrokeWidth);
            doc.x += options.indent;
            doc
                .font('Header Font Bold')
                .fontSize(10 * options.font.header.scale)
                .text('Locations(s): ', {
                    continued:true,
                    stroke:options.font.header.strokeForBold,
                    fill:true,
                    indent:-options.indent,
                    width:cellContentsWidth - options.indent
                });

            const locations = [];
            if (scene.locations.confirmed){
                for (const location of scene.locations.confirmed){
                    locations.push(location.name);

                }
            }
            doc
                .font('Body Font')
                .fontSize(10 * options.font.body.scale)
                .text(locations.join(', '), {
                    stroke:false,
                    fill:true,
                    indent:-options.indent,
                });
            doc.x -= options.indent;
            doc.moveDown(0.25);

        }
        function renderUsers(scene){
            const sectionY = doc.y;
            const sectionX = doc.x;
            const sectionWidth = (cellContentsWidth - 18) / 2

            doc.strokeColor('#000000')
                .fillColor('#000000')
                    .lineWidth(options.boldStrokeWidth);

            doc
                .font('Header Font Bold')
                .fontSize(10 * options.font.header.scale)
                .text('Players', doc.x, doc.y,
                    {stroke:options.font.header.strokeForBold, fill:true, width:sectionWidth});
            if (!scene.assign_players){
                doc
                    .font('Body Font')
                    .fontSize(10 * options.font.body.scale)
                    .text('No Players Assigned', {stroke:false, fill:true, width:sectionWidth});

            } else if (scene.players.confirmed){
                for (const player of scene.players.confirmed){
                    doc
                        .font('Body Font')
                        .fontSize(10 * options.font.body.scale)
                        .text(player.name, {stroke:false, fill:true, width:sectionWidth});
                }
            }
            const playerY = doc.y;

            doc
                .font('Header Font Bold')
                .fontSize(10 * options.font.header.scale)
                .text('Staff', doc.x + sectionWidth + 18, sectionY,
                    {stroke:options.font.header.strokeForBold, fill:true, width:sectionWidth});

            if (scene.staff.confirmed){
                for (const staff of scene.staff.confirmed){
                    doc
                        .font('Body Font')
                        .fontSize(10 * options.font.body.scale)
                        .text(staff.name, {stroke:false, fill:true, width:sectionWidth});
                }
            }
            doc.x = sectionX;
            doc.y = Math.max(doc.y, playerY);
            doc.moveDown(0.25)
        }

        function renderPlayers(scene){
            const sectionX = doc.x;
            const sectionWidth = (cellContentsWidth - 18) / 2

            doc.strokeColor('#000000')
                .fillColor('#000000')
                .lineWidth(options.boldStrokeWidth);

            doc
                .font('Header Font Bold')
                .fontSize(10 * options.font.header.scale)
                .text('Players', doc.x, doc.y,
                    {stroke:options.font.header.strokeForBold, fill:true});

            if (!scene.assign_players){
                doc
                    .font('Body Font')
                    .fontSize(10 * options.font.body.scale)
                    .text('No Players Assigned', {stroke:false, fill:true, width:sectionWidth});

            } else {

                const players = [];
                if (scene.players.confirmed){
                    if (scene.players.confirmed.length > options.countAfter.players){
                        players.push(`${scene.players.confirmed.length} Players`)
                        if (scene.for_anyone){
                            players.push('+ Anyone');
                        }

                    } else if (scene.players.confirmed.length > options.listAfter.players){
                        for (const player of scene.players.confirmed){
                            players.push(player.name)
                        }
                        if (scene.player_count_max - scene.players.confirmed.length > 0 && !scene.for_anyone && options.show_open_slots){
                            let shortName = 'Player'
                            if (scene.player_count_max - scene.players.confirmed.length > 1){
                                shortName = pluralize.plural(shortName);
                            }
                            players.push(`+ up to ${scene.player_count_max - scene.players.confirmed.length} ${shortName}`);
                        }
                        if (scene.for_anyone){
                            players.push('+ Anyone');
                        }

                    } else {
                        for (const player of scene.players.confirmed){
                            const itemY = doc.y;
                            doc
                                .font('Body Font')
                                .fontSize(10 * options.font.body.scale)
                                .text(player.name, sectionX, itemY, {stroke:false, fill:true, width:sectionWidth});

                            const postY = doc.y;

                            doc
                                .font('Body Font')
                                .fontSize(10 * options.font.body.scale)
                                .text(player.character.name, sectionX + sectionWidth + 18, itemY, {stroke:false, fill:true, width:sectionWidth});
                            if (postY > doc.y){
                                doc.y = postY;
                            }
                        }
                        if (scene.player_count_max - scene.players.confirmed.length > 0 && !scene.for_anyone && options.show_open_slots){
                            let shortName = 'Player'
                            if (scene.player_count_max - scene.players.confirmed.length > 1){
                                shortName = pluralize.plural(shortName);
                            }
                            doc
                                .font('Body Font')
                                .fontSize(10 * options.font.body.scale)
                                .text(`+ up to ${scene.player_count_max - scene.players.confirmed.length} ${shortName}`, sectionX, doc.y, {stroke:false, fill:true, width:sectionWidth});
                        }
                        if (scene.for_anyone){
                            doc
                                .font('Body Font')
                                .fontSize(10 * options.font.body.scale)
                                .text('+ Anyone', sectionX, doc.y, {stroke:false, fill:true, width:sectionWidth});
                        }

                    }
                }
                if (players.length){
                    doc
                        .font('Body Font')
                        .fontSize(10 * options.font.body.scale)
                        .text(players.join(', '), sectionX, doc.y, {stroke:false, fill:true, width:cellContentsWidth});
                }
            }

            doc.x = sectionX;
            doc.moveDown(0.25)
        }

        function renderStaff(scene){
            const sectionX = doc.x;
            const sectionWidth = (cellContentsWidth - 18) / 2

            doc.strokeColor('#000000')
                .fillColor('#000000')
                .lineWidth(options.boldStrokeWidth);

            doc
                .font('Header Font Bold')
                .fontSize(10 * options.font.header.scale)
                .text('Staff', doc.x, doc.y,
                    {stroke:options.font.header.strokeForBold, fill:true});

            const staffList = [];

            if (scene.staff.confirmed){
                if (scene.staff.confirmed.length > options.countAfter.staff){
                    staffList.push(`${scene.staff.confirmed.length} Staff`)

                } else if (scene.staff.confirmed.length > options.listAfter.staff){
                    for (const staff of scene.staff.confirmed){
                        if (staff.npc){
                            staffList.push(`${staff.name} (${staff.npc})`);
                        } else {
                            staffList.push(staff.name);
                        }
                    }

                } else {
                    for (const staff of scene.staff.confirmed){
                        const itemY = doc.y;
                        doc
                            .font('Body Font')
                            .fontSize(10 * options.font.body.scale)
                            .text(staff.name, sectionX, itemY, {stroke:false, fill:true, width:sectionWidth});

                        const postY = doc.y;

                        if (staff.npc){
                            doc
                                .font('Body Font')
                                .fontSize(10 * options.font.body.scale)
                                .text(staff.npc, sectionX + sectionWidth + 18, itemY, {stroke:false, fill:true, width:sectionWidth});
                        }

                        if (postY > doc.y){
                            doc.y = postY;
                        }
                    }
                }
            }
            if (staffList.length){
                doc
                    .font('Body Font')
                    .fontSize(10 * options.font.body.scale)
                    .text(staffList.join(', '), sectionX, doc.y, {stroke:false, fill:true, width:cellContentsWidth});
            }

            doc.x = sectionX;
            doc.moveDown(0.25)
        }
    }
    async function scheduleBusyReport(){
        const allTimeslots = await models.timeslot.find({campaign_id:campaign.id});
        const schedule_busy_types = await models.schedule_busy_type.find({campaign_id:campaign.id});

        for (const schedule_busy_type of schedule_busy_types){
            doc.addPage();

            renderHeader(schedule_busy_type);
            const sectionX = doc.x;
            for (const timeslot of allTimeslots){
                if (options.ignoreTimeslots && _.indexOf(options.ignoreTimeslots, timeslot.id) !== -1){
                    continue;
                }
                const schedule_busies = await models.schedule_busy.find({event_id:eventId, timeslot_id:timeslot.id, type_id:schedule_busy_type.id})

                let timeslotName = timeslot.name;
                if (options.timeslotDisplay === 'label' && timeslot.display_name){
                    timeslotName = timeslot.display_name as string
                }

                if (schedule_busies.length){
                    const users = await async.map(schedule_busies, async(schedule_busy) => {
                        return models.user.get(campaign.id, schedule_busy.user_id)
                    });

                    const lineY = doc.y
                    doc.font('Body Font Bold')
                        .fontSize(16 * options.font.body.scale)
                        .text(timeslotName, sectionX, doc.y);
                    doc.font('Body Font')
                        .fontSize(16 * options.font.body.scale)
                        .text(_.pluck(users, 'name').join(', '), 72*2.5, lineY, {width:doc.page.width - options.margin*2 - 72*2.5});

                } else {
                    doc.font('Body Font Bold').fontSize(16);
                    doc.text(timeslotName, sectionX, doc.y, {align:'left'});
                }
                doc.moveDown(0.25)
            }
        }
        function renderHeader(schedule_busy_type){
            const headerText = `${event.name}: ${schedule_busy_type.name}`;
            doc
                .lineWidth(options.boldStrokeWidth)
                .font('Title Font Bold')
                .fontSize(24 * options.font.title.scale)
                .text(headerText, options.margin, options.margin, {
                    width:doc.page.width - (options.margin*2),
                    align:'center',
                    stroke:options.font.header.strokeForBold, fill:true
                });
        }

    }
}

export default renderReport;

