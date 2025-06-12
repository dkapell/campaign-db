/* globals _ scenedetailsTemplate unscheduledusersTemplate */
$(function(){
    $('.scene-item-draggable').draggable({
        snap:'.schedule-slot',
        handle: '.handle',
        cursor: 'move',
        zIndex: 9999,
        snapMode:'inner',
        revert: true,
        revertDuration: 0,
        start: function(event, ui){
            startDragScene($(this));
        },
        stop: function (event, ui) {
            stopDragScene($(this));
        },
        containment:'#schedule-container-grid'

    });

    $('.schedule-slot').droppable({
        accept: '.scene-item',
        tolerance: 'pointer',
        drop: updateSceneSchedule,
        classes: {
            'ui-droppable-hover': 'border-success'
        }

    });

    $('#schedule-alert .btn-close').on('click', ()=>{
        $('#schedule-alert').hide();
    });

    $('.issue-icon[data-bs-toggle="popover"]').popover({
        trigger: 'hover',
        delay: { 'show': 300, 'hide': 100 },
        content: function(elem){
            return elem.getAttribute('content');
        },
        customClass:'scene-info-popover'
    });

    $('.scene-details').on('show.bs.collapse', function(e){
        const $scene = $(e.target).closest('.scene-item');
        updateSceneDetails($scene);
    });


    $('[data-bs-toggle="tooltip"]').tooltip({
        delay: { 'show': 300, 'hide': 100 },
    });

    $('#confirm-schedule-btn').confirmation({
        title:'Confirm all scheduled scenes?'
    }).on('click', confirmAllScenes);

    $('.unscheduled-users-btn').on('click', showUnscheduledUsersBtn);

    $('.resizer-close').on('click', function(){
        closePickerArea();
        clearTimeslotHighlight();
    });
    $('.resizer-expand').on('click', function(){
        fullPickerArea();
    });
    $('.resizer-restore').on('click', function(){
        splitPickerArea();
    });

    updateAllSlots();
    validateAllScenes();

    $('.resizer').each(function(){
        resizable($(this)[0]);
    });
});

function clearTimeslotHighlight(){
    $('.timeslot-header').removeClass('text-bg-info');
    $('.schedule-cell').removeClass('text-bg-info');
    $('.users-btn').removeClass('active');
    $('.scene-item').removeClass('scene-item-droppable');
    const sceneIds = JSON.parse($('#unscheduled-users').attr('scenes'));
    for (const sceneId of sceneIds){

        $(`.scene-item[data-scene-id=${sceneId}]`).find('.scene-details').collapse('hide');
    }
}

function updateAllSlots(){
    $('.schedule-slot').each(function(){
        updateSlotScenes($(this));
    });
}

async function updateSceneDetails($scene){
    const sceneId = $scene.data('scene-id');
    const result = await fetch(`/scene/${sceneId}?api=true`);
    const data = await result.json();
    $(`.scene-item[data-scene-id=${sceneId}]`).each(function(){
        const $scene = $(this);
        $scene.find('.scene-details').html(scenedetailsTemplate(data));
        $scene.find('.scene-details').find('[data-bs-toggle="tooltip"]').tooltip({
            delay: { 'show': 300, 'hide': 100 },
        });
        $scene.find('.confirm-scene-btn').on('click', confirmSceneBtn);
        $scene.find('.unconfirm-scene-btn').on('click', unconfirmSceneBtn);
        $scene.find('.unschedule-user-btn').on('click', unscheduleSceneUserBtn);
        $scene.find('.schedule-user-btn').on('click', scheduleSceneUserBtn);
    });
}

async function updateSceneSchedule(event, ui){
    const $slot = $(event.target);
    const $scene = $(ui.draggable);

    const reasons = validateMove($scene, $slot);

    if (reasons.length) {
        $('#schedule-alert').find('.alert-text').html(reasons.join('<br>'));
        $('#schedule-alert').show();
        return;
    }
    $('#schedule-alert').hide();

    const $old = $(`#${$scene.attr('cell')}`);

    $scene.attr('cell', $slot.attr('id'));

    if ($slot.attr('id') === 'unscheduled'){
        $scene.appendTo($slot);
    } else {
        $scene.appendTo($slot.parent());
    }

    await updateSlotScenes($slot);
    await updateSlotScenes($old);

    await recordScheduleUpdate($scene, $slot);

    await validateAllScenes();
}

function validateMove($scene, $slot){
    const reasons = [];
    $(`.scene-item[cell=${$slot.attr('id')}`).each(function (){
        if ($(this).data('scene-id') === $scene.data('scene-id') &&
            $slot.attr('id') !== 'unscheduled' &&
            $(this).attr('id') !== $scene.attr('id')){
            reasons.push('Can not schedule two of the same scene in the same location/timeslot.');
        }
    });
    if ($slot.attr('id') !== 'unscheduled'){
        const $scenes = $(`.scene-item[data-scene-id=${$scene.data('scene-id')}]`);
        if ($scenes.length > 1){
            $scenes.each(function(){
                if ($(this).data('locationIdx') === $scene.data('locationIdx')){
                    return;
                }
                const $itemSlot = $(`#${$(this).attr('cell')}`);
                if ($itemSlot.attr('id') === 'unscheduled'){
                    return;
                }
                if ($itemSlot.data('timeslot-id') !== $slot.data('timeslot-id')){

                    reasons.push('Can not schedule two locations of the same scene in different timeslots.');
                }
            });
        }
    }
    return reasons;
}

async function recordScheduleUpdate($scene){
    const sceneId = $scene.data('scene-id');
    const eventId = $('#eventId').val();
    const $scenes = $(`.scene-item[data-scene-id=${sceneId}]`);

    const data = {
        timeslot: 'none',
        locations: []
    };

    $scenes.each(function(){
        const $slot = $(`#${$(this).attr('cell')}`);
        data.locations.push( $slot.data('locationId'));
        if ($slot.data('timeslot-id') !== 'none'){
            data.timeslot = $slot.data('timeslot-id');
        }
    });
    const url = `/event/${eventId}/scene/${sceneId}`;
    const result = await fetch(url, {
        method:'PUT',
        headers: {
            'CSRF-Token': $('#csrfToken').val(),
            'Content-Type': 'application/json'
        },
        body:JSON.stringify({scene:data})

    });

    const resultObj = await result.json();
    if (resultObj.success){
        $scene.attr('timeslots', JSON.stringify(resultObj.scene.timeslots));
        $scene.attr('locations', JSON.stringify(resultObj.scene.locations));
    } else {
        $('#schedule-alert').find('.alert-text').html(resultObj.error);
        $('#schedule-alert').show();
    }
}

async function confirmSceneBtn(e){
    e.preventDefault();
    const $scene = $(this).closest('.scene-item');

    $(this).one('hidden.bs.tooltip', async () =>{
        confirmScene($scene);
    });
    $(this).tooltip('hide');
}

async function unconfirmSceneBtn(e){
    e.preventDefault();
    const $scene = $(this).closest('.scene-item');

    $(this).one('hidden.bs.tooltip' , async() => {
        unconfirmScene($scene);
    });
    $(this).tooltip('hide');
}

async function confirmScene($scene){
    const sceneId = $scene.data('scene-id');
    const eventId = $('#eventId').val();
    const url = `/event/${eventId}/scene/${sceneId}/confirm`;

    const result = await fetch(url, {
        method:'PUT',
        headers: {
            'CSRF-Token': $('#csrfToken').val()
        }
    });

    const resultObj = await result.json();
    if (resultObj.success){
        updateScene($scene, resultObj.scene.status);
        const $slot = $(`#${$scene.attr('cell')}`);
        await updateSceneDetails($scene);
        updateSlotScenes($slot);
    } else {
        $('#schedule-alert').find('.alert-text').html(resultObj.error);
        $('#schedule-alert').show();
    }
}

async function unconfirmScene($scene){
    const sceneId = $scene.data('scene-id');
    const eventId = $('#eventId').val();
    const url = `/event/${eventId}/scene/${sceneId}/unconfirm`;
    const result = await fetch(url, {
        method:'PUT',
        headers: {
            'CSRF-Token': $('#csrfToken').val()
        }
    });

    const resultObj = await result.json();
    if (resultObj.success){
        updateScene($scene, resultObj.scene.status);
        const $slot = $(`#${$scene.attr('cell')}`);
        await updateSceneDetails($scene);
        updateSlotScenes($slot);
    } else {
        $('#schedule-alert').find('.alert-text').html(resultObj.error);
        $('#schedule-alert').show();
    }
}

async function confirmAllScenes(e){
    e.preventDefault();
    $('.scene-item').each(async function() {
        const $scene = $(this);
        if ($scene.attr('cell') === 'unscheduled' || $scene.attr('status') !== 'scheduled'){
            return;
        }
        await confirmScene($scene);
    });
}

function updateSlotScenes($slot){

    const $children = $(`.scene-item[cell=${$slot.attr('id')}`);
    const xAxisType = $('#xAxisType').val();

    let gridY = $slot.data('pos-y');
    let gridX = $slot.data('pos-x');
    let maxRows = 1;
    let xCounter = 0;

    $children.each(function(idx){
        const $scene = $(this);
        const timeslotCount = $scene.data('timeslot-count');
        let rows = xAxisType==='location'?timeslotCount:$('#cellsPerSlot').val();
        let cols = xAxisType==='location'?$('#cellsPerSlot').val():timeslotCount;

        if ($slot.attr('id') === 'unscheduled'){
            $scene.find('.scene-display').addClass('m-1');

            const columnCount = $('#locationColumns').val();
            $scene.appendTo($slot);

            let maxCells = columnCount;
            if (xAxisType === 'location'){
                maxCells = Math.floor(columnCount / cols);

                gridX = $slot.data('pos-x') + idx%maxCells * cols;

                if ((idx+1) * cols > columnCount){
                    gridY += maxRows;
                    maxRows = 1;
                }

                if (rows > maxRows){
                    maxRows = rows;
                }
            } else {
                gridX = $slot.data('pos-x') + xCounter;
                if ((gridX + timeslotCount) > columnCount){
                    gridX = $slot.data('pos-x');
                    xCounter = 0;
                    gridY++;
                }
                xCounter += timeslotCount;
            }

        } else {
            $scene.appendTo($slot.parent());
            if (xAxisType === 'location'){
                if ($children.length > $slot.data('children-count')){

                    $scene.find('.scene-display').removeClass('m-1');
                    const width = $slot.width();
                    const left = 5 + idx* width / ($children.length * 1.5);
                    const top = 0.25 + idx*0.25;
                    const right = ($children.length - idx) * 0.25;

                    $scene.css('margin', `${top}rem ${right}rem 0.25rem ${ left}px`);
                    gridX =  $slot.data('pos-x');
                } else {
                    cols = Math.floor(cols / $children.length);
                    $scene.find('.scene-display').addClass('m-1');
                    $scene.css('margin', 0);
                    gridX = $slot.data('pos-x') + idx*cols;
                }
            } else {
                if ($children.length > $slot.data('children-count')){

                    $scene.find('.scene-display').removeClass('m-1');
                    const width = $slot.width();
                    const left = 5 + idx* width / ($children.length * 1.5);
                    const top = 0.25 + idx*0.25;
                    const right = ($children.length - idx) * 0.25;

                    $scene.css('margin', `${top}rem ${right}rem 0.25rem ${ left}px`);
                    gridX =  $slot.data('pos-x');
                } else {
                    rows = Math.floor(rows / $children.length);
                    $scene.find('.scene-display').addClass('m-1');
                    $scene.css('margin', 0);
                    gridY = $slot.data('pos-y') + idx*rows;
                }

            }
        }
        $scene
            .css('grid-row', `${gridY} / span ${rows}`)
            .css('grid-column', `${gridX} / span ${cols}`)
            .removeClass('d-none').addClass('d-flex');

        updateScene($scene);
    });
}

function updateScene($scene, status){
    const sceneId = $scene.data('scene-id');
    $(`.scene-item[data-scene-id=${sceneId}]`).each(function(){
        const $scene = $(this);
        if (status){
            $scene.attr('status', status);
        }
        const $slot = $(`#${$scene.attr('cell')}`);
        if ($slot.attr('id') === 'unscheduled'){
            $scene.find('.scene-display').removeClass('border-success');
            $scene.find('.scene-display').removeClass('border-warning');
        } else if ($scene.attr('status') === 'confirmed'){
            $scene.find('.scene-display').addClass('border-success');
            $scene.find('.scene-display').removeClass('border-warning');
        } else {
            $scene.find('.scene-display').addClass('border-warning');
            $scene.find('.scene-display').removeClass('border-success');
        }
    });
}

async function validateAllScenes(){
    const sceneIds = [];
    $('.scene-item').each(function(){
        sceneIds.push($(this).data('scene-id'));
    });
    const url = `/event/${$('#eventId').val()}/scene/validate?`;

    const result = await fetch(url + new URLSearchParams({
        scenes: _.uniq(sceneIds)
    }).toString());

    const data = await result.json();
    if (data.success){
        for (const scene of data.scenes){
            const $scenes = $(`.scene-item[data-scene-id=${scene.id}]`);
            $scenes.each(function() {
                const $scene = $(this);
                if (scene.issues.warning.length){
                    $scene.addClass('validation-warning');
                    $scene.find('.scene-warning').attr('content', makeValidationHtml(scene.issues.warning)[0].innerHTML);
                } else {
                    $scene.removeClass('validation-warning');
                }
                if (scene.issues.info.length){
                    $scene.addClass('validation-info');
                    $scene.find('.scene-info').attr('content', makeValidationHtml(scene.issues.info)[0].innerHTML);
                } else {
                    $scene.removeClass('validation-info');
                }
            });
        }
    }
    updateTimeslotUsersCount();
}

function makeValidationHtml(issues){
    const $ul = $('<ul>');
    for (const issue of issues){
        const $li = $('<li>');
        $li.text(issue);
        $ul.append($li);
    }
    return $ul;
}

function startDragScene($elem){
    const $details = $elem.find('.scene-details');
    $details.collapse('hide');

    const timeslots = JSON.parse($elem.attr('timeslots'));
    const locations = JSON.parse($elem.attr('locations'));
    $elem.attr('status', 'suggested');

    for (const timeslot of timeslots){
        const $header = $(`#timeslot-${timeslot.id}-header`);
        switch (timeslot.scene_request_status){
            case 'requested': $header.addClass('bg-warning-subtle'); break;
            case 'required': $header.addClass('bg-info-subtle'); break;
            case 'rejected': $header.addClass('bg-danger-subtle'); break;
        }
        /*switch (timeslot.scene_schedule_status){
            case 'suggested': $header.addClass(`bg-warning-subtle`); break;
            case 'confirmed': $header.addClass(`bg-success-subtle`); break;
            case 'rejected': $header.addClass(`bg-danger-subtle`); break;
        }*/
    }
    for (const location of locations){
        const $header = $(`#location-${location.id}-header`);
        switch (location.scene_request_status){
            case 'requested': $header.addClass('bg-warning-subtle'); break;
            case 'required': $header.addClass('bg-info-subtle'); break;
            case 'rejected': $header.addClass('bg-danger-subtle'); break;
        }
        /*switch (location.scene_schedule_status){
            case 'suggested': $header.addClass(`bg-warning-subtle`); break;
            case 'confirmed': $header.addClass(`bg-success-subtle`); break;
            case 'rejected': $header.addClass(`bg-danger-subtle`); break;
        }*/
    }

    $('.schedule-slot').each(function(){
        let cellClass = false;

        const cellTimeslotId = $(this).data('timeslot-id');
        const cellLocationId = $(this).data('location-id');

        const sceneTimeslotData = _.findWhere(timeslots, {id:cellTimeslotId});
        const sceneLocationData = _.findWhere(locations, {id:cellLocationId});

        if (sceneTimeslotData && sceneLocationData){
            switch (sceneTimeslotData.scene_request_status){
                case 'requested':
                    switch (sceneLocationData.scene_request_status){
                        case 'requested': cellClass = 'warning'; break;
                        case 'required': cellClass = 'info'; break;
                        case 'rejected': cellClass = 'danger'; break;
                    }
                    /*switch (sceneLocationData.scene_schedule_status){
                        case 'suggested': cellClass = 'warning'; break;
                        case 'confirmed': cellClass = 'success'; break;
                        case 'rejected': cellClass = 'danger'; break;
                    }*/
                    break;
                case 'required':
                    switch (sceneLocationData.scene_request_status){
                        case 'requested': cellClass = 'info'; break;
                        case 'required': cellClass = 'success'; break;
                        case 'rejected': cellClass = 'danger'; break;
                    }/*
                    switch (sceneLocationData.scene_schedule_status){
                        case 'suggested': cellClass = 'warning'; break;
                        case 'confirmed': cellClass = 'success'; break;
                        case 'rejected': cellClass = 'danger'; break;
                    }*/
                    break;
                case 'rejected':
                    cellClass = 'danger';
                    break;
            }/*
            switch (sceneTimeslotData.scene_schedule_status){
                case 'suggested':
                    switch (sceneLocationData.scene_request_status){
                        case 'requested': cellClass = 'info'; break;
                        case 'required': cellClass = 'warning'; break;
                        case 'rejected': cellClass = 'danger'; break;
                    }
                    switch (sceneLocationData.scene_schedule_status){
                        case 'suggested': cellClass = 'warning'; break;
                        case 'confirmed': cellClass = 'success'; break;
                        case 'rejected': cellClass = 'danger'; break;
                    }
                    break;
                case 'confirmed':
                    switch (sceneLocationData.scene_request_status){
                        case 'requested': cellClass = 'success'; break;
                        case 'required': cellClass = 'success'; break;
                        case 'rejected': cellClass = 'danger'; break;
                    }
                    switch (sceneLocationData.scene_schedule_status){
                        case 'suggested': cellClass = 'success'; break;
                        case 'confirmed': cellClass = 'success'; break;
                        case 'rejected': cellClass = 'danger'; break;
                    }

                    break
                case 'rejected':
                    cellClass = 'danger';
                    break;

            }*/
        }

        const reasons = validateMove($elem, $(this));
        if (reasons.length){
            cellClass = 'danger';
        }

        $(this).addClass(`bg-${cellClass}-subtle`);
    });
}

function stopDragScene($elem){
    $('.schedule-cell').removeClass('bg-success-subtle');
    $('.schedule-cell').removeClass('bg-info-subtle');
    $('.schedule-cell').removeClass('bg-danger-subtle');
    $('.schedule-cell').removeClass('bg-warning-subtle');
    $('.schedule-cell').removeClass('bg-primary-subtle');
}

async function showUnscheduledUsersBtn(e){
    e.preventDefault();
    const $btn = $(this);
    const timeslotId = $btn.data('timeslot-id');
    const type = $btn.data('type');
    $('.users-btn').removeClass('active');
    if (Number($('#unscheduled-users').attr('timeslot-id')) !== timeslotId){
        clearTimeslotHighlight();
    }

    if (Number($('#unscheduled-users').attr('timeslot-id')) === timeslotId &&
        $('#unscheduled-users').attr('type') === type &&
        $('#adjustable-content').hasClass('show')){
        clearTimeslotHighlight();
        closePickerArea();
        return;
    }
    $btn.addClass('active');
    $btn.find('i.fas')
        .removeClass('fa-user')
        .removeClass('fa-users')
        .addClass('fa-spin')
        .addClass('fa-sync');
    $btn.tooltip('hide');
    await updateUnscheduledUsersPanel(timeslotId, type);
    if (!$('#adjustable-content').hasClass('show')){
        await splitPickerArea();
    }
    scrollToTimeslot(timeslotId);

    $(`.timeslot-header[data-timeslot-id=${timeslotId}]`).addClass('text-bg-info');
    $(`.schedule-cell[data-timeslot-id=${timeslotId}]`).addClass('text-bg-info');

    let icon = 'fa-users';
    if (type === 'player'){icon = 'fa-user'; }
    if (type === 'all'){icon = 'fa-globe'; }

    $btn.find('i.fas')
        .removeClass('fa-sync')
        .removeClass('fa-spin')
        .addClass(icon);
}

async function updateUnscheduledUsersPanel(timeslotId, type){
    $('#unscheduled-users').find('.content').hide();
    $('#unscheduled-users').find('.loading').show();
    $('#unscheduled-users').find('.title').text('Loading');
    if (!timeslotId){
        timeslotId = $('#unscheduled-users').attr('timeslot-id');
    }
    if (!type){
        type = $('#unscheduled-users').attr('type');
    }
    if (type === 'init'){
        return;
    }
    $('#unscheduled-users').attr('type', type);
    $('#unscheduled-users').attr('timeslot-id', timeslotId);
    const eventId = $('#eventId').val();
    const result = await fetch(`/event/${eventId}/timeslot/${timeslotId}?type=${type}`);
    const data = await result.json();
    if (data.success){
        formatUnscheduledUsersData(data, type);
        $('#unscheduled-users').find('.loading').hide();
    } else {
        $('#schedule-alert').find('.alert-text').html(data.error);
        $('#schedule-alert').show();
    }
}

function formatUnscheduledUsersData(data, type){
    let title = `Unscheduled Players at ${data.timeslot.name}`;
    if (type === 'staff'){
        title = `Unscheduled Staff at ${data.timeslot.name}`;
    } else if (type === 'all'){
        title = `All Attendees at ${data.timeslot.name}`;
    }
    data.capitalize=function capitalize(string){
        return string.charAt(0).toUpperCase() + string.slice(1);
    };
    data.type = type;
    $('#unscheduled-users').attr('timeslot-id', data.timeslot.id);
    $('#unscheduled-users').attr('scenes', JSON.stringify(_.pluck(data.scenes, 'id')));
    $('#unscheduled-users').find('.title').text(title);
    $('#unscheduled-users').find('.content').html(unscheduledusersTemplate(data)).show();

    for (const scene of data.scenes){
        console.log(scene.name);
        $(`.scene-item[data-scene-id=${scene.id}]`).addClass('scene-item-droppable');
        $(`.scene-item[data-scene-id=${scene.id}]`).find('.scene-details').collapse('show');
    }


    $('#unscheduled-users').find('.user-item').draggable({
        snap:'.scene-item-droppable',
        handle: '.handle',
        cursor: 'move',
        zIndex: 9999,
        snapMode:'inner',
        revert: true,
        revertDuration: 0,
        appendTo: 'body',
        helper: 'clone',
        start: function(event, ui){
            startDragUser($(this), data);
        },
        stop: function (event, ui) {
            stopDragUser($(this));
        },
    });

    $('.scene-item-droppable').droppable({
        accept: '.user-item',
        tolerance: 'pointer',
        drop: updateSceneUser,
        classes: {
            'ui-droppable-hover': 'scene-item-droppable-hover'
        }

    });

}

function startDragUser($user, data){
    $user.addClass('disabled');
    const userId = $user.data('user-id');
    $('.scene-item').each( function() {
        const sceneId = $(this).data('scene-id');
        const scene = _.findWhere(data.scenes, {id:Number(sceneId)});
        if (scene){
            const scene_user = _.findWhere(scene.users, {id:userId});
            if (scene_user){
                const $sceneDisplay = $(this).find('.scene-display');
                switch (scene_user.scene_request_status){
                    case 'requested': $sceneDisplay.addClass('bg-info-subtle'); break;
                    case 'required': $sceneDisplay.addClass('bg-success-subtle'); break;
                    case 'rejected': $sceneDisplay.addClass('bg-danger-subtle'); break;
                }
            }
        } else {
            $(this).addClass('disabled');
        }
    });

}

function stopDragUser($user, data){
    $user.removeClass('disabled');

    $('.scene-item').removeClass('disabled');
    $('.scene-display').removeClass('bg-info-subtle');
    $('.scene-display').removeClass('bg-success-subtle');
    $('.scene-display').removeClass('bg-danger-subtle');
}

async function updateSceneUser(event, ui){
    const $scene = $(event.target);
    const $user = $(ui.draggable);
    $scene.find('.scene-details').collapse('show');

    const userId = $user.data('user-id');
    await assignUserToScene(userId, $scene, 'confirmed');
}

async function unscheduleSceneUserBtn(e){
    e.preventDefault();
    const $scene = $(this).closest('.scene-item');
    const userId = $(this).data('user-id');
    $(this).tooltip('hide');
    $(this).on('hidden.bs.tooltip', async function(){
        await assignUserToScene(userId, $scene, 'unscheduled');
    });
}

async function scheduleSceneUserBtn(e){
    e.preventDefault();
    const $scene = $(this).closest('.scene-item');
    const userId = $(this).data('user-id');
    $(this).one('hidden.bs.tooltip', async () =>{
        await assignUserToScene(userId, $scene, 'confirmed');
    });
    $(this).tooltip('hide');
}

async function assignUserToScene(userId, $scene, status='confirmed'){
    $('#schedule-alert').hide();
    const sceneId = $scene.data('scene-id');
    const eventId = $('#eventId').val();
    const data = {
        scene_id: sceneId,
        status: status
    };
    const url = `/event/${eventId}/user/${userId}`;
    const result = await fetch(url, {
        method:'PUT',
        headers: {
            'CSRF-Token': $('#csrfToken').val(),
            'Content-Type': 'application/json'
        },
        body:JSON.stringify({user:data})
    });

    const resultObj = await result.json();

    if (resultObj.success){
        await updateSceneDetails($scene);
        await updateUnscheduledUsersPanel();
        await validateAllScenes();
    } else {
        $('#schedule-alert').find('.alert-text').html(resultObj.error);
        $('#schedule-alert').show();
    }
}

async function updateTimeslotUsersCount(){
    const eventId = $('#eventId').val();
    const url = `/event/${eventId}/timeslot`;
    const result = await fetch(url);
    const data = await result.json();
    if (data.success){
        for (const record of data.timeslots){
            const unassignedPlayers = record.users.filter(user => {return user.type === 'player' && user.schedule_status==='unscheduled';});
            const unassignedStaff = record.users.filter(user => {return user.type !== 'player' && user.schedule_status==='unscheduled';});
            const $elem = $(`.users-cell[data-timeslot-id=${record.timeslot.id}]`);
            if (unassignedPlayers.length){
                $elem.find('.unscheduled-players-btn .user-count').text(unassignedPlayers.length);
            } else {
                $elem.find('.unscheduled-players-btn .user-count').text('');
            }
            if (unassignedStaff.length){
                $elem.find('.unscheduled-staff-btn .user-count').text(unassignedStaff.length);
            } else {
                $elem.find('.unscheduled-staff-btn .user-count').text('');
            }
        }
    } else {
        $('#schedule-alert').find('.alert-text').html(data.error);
        $('#schedule-alert').show();
    }
}

async function closePickerArea(){
    new Promise((resolve, reject) => {
        if (!$('#adjustable-content').hasClass('show')){
            return;
        }

        $('#schedule-container')
            .removeClass('d-none')
            .addClass('d-flex')
            .css({overflow:'hidden'})
            .animate({height:'100%'}, 200);

        $('#adjustable-content')
            .addClass('d-none')
            .removeClass('show')
            .css({overflow:'hidden'})
            .animate({height:'0'}, 200, ()=>{
                resolve();
            });
    });
}

async function fullPickerArea(hideAdjust, hideClose = false){
    new Promise((resolve, reject)=>{
        let minSize = 0;
        if ($('#schedule-container').attr('min-size')){
            minSize = $('#schedule-container').attr('min-size');
        }
        $('#schedule-container')
            .removeClass('d-none')
            .addClass('d-flex')
            .animate({height:`${minSize}%`}, 200);
        if(hideAdjust){
            $('#adjustable-content').addClass('d-none');
        } else {
            $('#adjustable-content').removeClass('d-none');
        }

        if (hideClose){
            $('#adjustable-content >> .resizer-close').addClass('d-none');
        } else {
            $('#adjustable-content >> .resizer-close').removeClass('d-none');
        }
        $('#adjustable-content .resizer-expand').hide();
        $('#adjustable-content .resizer-restore').show();
        $('#adjustable-content')
            .removeClass('d-none')
            .addClass('show')
            .css({overflow:'visible'})
            .animate({height:`${100-minSize}%`}, 200, ()=>{
                resolve();
            });
    });
}

async function splitPickerArea(hideClose = false){
    new Promise((resolve, reject) => {
        if (hideClose){
            $('#adjustable-content .resizer-close').addClass('d-none');
        } else {
            $('#adjustable-content .resizer-close').removeClass('d-none');
        }

        $('#adjustable-content .resizer-expand').show();
        $('#adjustable-content .resizer-restore').hide();
        $('#schedule-container')
            .removeClass('d-none')
            .addClass('d-flex')
            .show()
            .animate({height:'60%'}, 200);
        $('#adjustable-content')
            .removeClass('d-none')
            .addClass('show')
            .css({overflow:'visible'})
            .show();

        if(!$('#adjustable-content').hasClass('show')){
            $('#adjustable-content').css({height:'0%'});
        }
        $('#adjustable-content .resizer-expand').show();
        $('#adjustable-content .resizer-restore').hide();
        $('#adjustable-content').animate({height:'40%'}, 200, () => {
            resolve();
        });
    });
}


function resizable(resizer) {
    const direction = resizer.getAttribute('data-direction') || 'horizontal';
    const prevSibling = resizer.parentElement.previousElementSibling;
    const nextSibling = resizer.parentElement;
    const minSize = Number(prevSibling.getAttribute('min-size'));
    // The current position of mouse
    let x = 0;
    let y = 0;
    let prevSiblingHeight = 0;
    let prevSiblingWidth = 0;

    // Handle the mousedown event
    // that's triggered when user drags the resizer
    const mouseDownHandler = function(e) {
        // Get the current mouse position
        x = e.clientX;
        y = e.clientY;
        const rect = prevSibling.getBoundingClientRect();
        prevSiblingHeight = rect.height;
        prevSiblingWidth = rect.width;

        // Attach the listeners to `document`
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    };

    const mouseMoveHandler = function(e) {
        // How far the mouse has been moved
        const dx = e.clientX - x;
        const dy = e.clientY - y;


        switch (direction) {
            case 'vertical':{
                let h = (prevSiblingHeight + dy) * 100 / prevSibling.parentNode.getBoundingClientRect().height;
                if (minSize && h < minSize){
                    h = minSize;
                }

                prevSibling.style.height = `${h}%`;
                nextSibling.style.height = `${100-h}%`;
                break;
            }
            case 'horizontal':
            default:{
                let w = (prevSiblingWidth + dx) * 100 / resizer.parentNode.getBoundingClientRect().width;
                if (minSize && w < minSize){
                    w = minSize;
                }
                prevSibling.style.width = `${w}%`;
                break;
            }
        }

        const cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
        resizer.style.cursor = cursor;
        document.body.style.cursor = cursor;

        prevSibling.style.userSelect = 'none';
        prevSibling.style.pointerEvents = 'none';

        nextSibling.style.userSelect = 'none';
        nextSibling.style.pointerEvents = 'none';
        if (direction === 'vertical'){
            if (parseInt(prevSibling.style.height) < (minSize+3)){
                $(resizer).find('.resizer-expand').hide();
                $(resizer).find('.resizer-restore').show();
            } else {
                $(resizer).find('.resizer-expand').show();
                $(resizer).find('.resizer-restore').hide();
            }
        }
    };

    const mouseUpHandler = function() {
        resizer.style.removeProperty('cursor');
        document.body.style.removeProperty('cursor');

        prevSibling.style.removeProperty('user-select');
        prevSibling.style.removeProperty('pointer-events');

        nextSibling.style.removeProperty('user-select');
        nextSibling.style.removeProperty('pointer-events');

        // Remove the handlers of `mousemove` and `mouseup`
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
        if (parseInt(nextSibling.style.height) < 10){
            closePickerArea();
            clearTimeslotHighlight();
        }
    };

    // Attach the handler
    resizer.addEventListener('mousedown', mouseDownHandler);

    resizer.addEventListener('dblclick', function(){
        const height = parseInt($('#schedule-container')[0].style.height);
        if ( height < (minSize+5)){
            splitPickerArea();

        } else {
            fullPickerArea();
        }
    });
}

function scrollToTimeslot(timeslotId){
    const $header = $(`.timeslot-header[data-timeslot-id=${timeslotId}]`);
    if ($($header).length){
        const $container= $('#schedule-container');
        $container.animate({
            scrollTop:  $container.scrollTop() + ($header.position().top - $container.position().top) - 50

        }, 100);
    }
}
