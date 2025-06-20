/* globals _ scenedetailsTemplate userslistTemplate busyuserslistTemplate async */
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
        hideError();
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

    $('#clear-schedule-btn').confirmation({
        title:'Clear all non-confirmed scenes?'
    }).on('click', clearUnconfirmedScenes);

    $('#run-scheduler-btn').confirmation({
        title:'Run Scheduler for all non-confirmed Scenes?'
    }).on('click', runSchedulerBtn);

    $('.users-btn').on('click', showUsersBtn);

    $('.resizer-close').on('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        closeDetailPanel();
        clearTimeslotHighlight();
    });
    $('.resizer-expand').on('click', function(){
        fullDetailPanel();
    });
    $('.resizer-restore').on('click', function(){
        splitDetailPanel();
    });
    async.parallel([
        validateAllScenes,
        updateAllSlots,
    ]);

    $('.resizer').each(function(){
        resizable($(this)[0]);
    });

    $('.complex-select2').each(function(e){
        const $select = $(this);
        $select.select2({
            theme:'bootstrap-5',
            minimumResultsForSearch: 6,
            width:'resolve',
            escapeMarkup: function(markup) {
                return markup;
            },
            templateResult: function(data) {
                return $(data.element).data('html');
            },
            templateSelection: function(data) {
                if (data.id === '') {
                    return $select.data('placeholder');
                }
                return $(data.element).data('text');
            }
        });
    });

    $('#schedule-user-picker').on('change', userPickerSelect);
    $('#highlight-user-scenes').on('change', highlightUserScenesToggle);

});

function clearTimeslotHighlight(){
    $('.timeslot-header').removeClass('text-bg-info');
    $('.schedule-cell').removeClass('text-bg-info');
    $('.users-btn').removeClass('active');
    $('.scene-item').removeClass('scene-item-droppable');
    const sceneIds = JSON.parse($('#users-panel').attr('scenes'));
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
    data.scheduleType = $('#scheduleType').val();
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
        showError(reasons.join('<br>'));
        return;
    }
    hideError();

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
    return _.uniq(reasons);
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
        showError(resultObj.error);
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
        updateSceneStatus($scene, resultObj.scene.status);
        const $slot = $(`#${$scene.attr('cell')}`);
        await updateSceneDetails($scene);
        updateSlotScenes($slot);
    } else {
        showError(resultObj.error);
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
        updateSceneStatus($scene, resultObj.scene.status);
        const $slot = $(`#${$scene.attr('cell')}`);
        await updateSceneDetails($scene);
        updateSlotScenes($slot);
    } else {
        showError(resultObj.error);
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

    $children.sort((a, b) => {
        return $(a).data('scene-name').localeCompare($(b).data('scene-name'))
    }).each(function(idx){
        const $scene = $(this);
        const timeslotCount = $scene.data('timeslot-count');
        let rows = xAxisType==='location'?timeslotCount:$('#cellsPerSlot').val();
        let cols = xAxisType==='location'?$('#cellsPerSlot').val():timeslotCount;

        if ($slot.attr('id') === 'unscheduled'){
            $scene.find('.scene-display').addClass('m-1');

            const columnCount = $('#locationColumns').val();
            $scene.appendTo($slot);

            if (xAxisType === 'location'){
                gridX = $slot.data('pos-x') + xCounter;

                if (gridX >= columnCount){
                    gridY += maxRows;
                    gridX = $slot.data('pos-x')
                    xCounter = 0;
                    maxRows = 1;
                }

                if (rows > maxRows){
                    maxRows = rows;
                }
                xCounter += Number(cols);
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

        updateSceneStatus($scene);
    });
}

function updateSceneStatus($scene, status){
    const sceneId = $scene.data('scene-id');
    $(`.scene-item[data-scene-id=${sceneId}]`).each(function(){
        const $scene = $(this);
        if (status){
            $scene.attr('status', status);
        }
        const $slot = $(`#${$scene.attr('cell')}`);
        if ($scene.data('scheduler')){
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
        } else {
            $scene.find('.scene-display').addClass('border-info');
        }
    });
}

async function validateAllScenes(){
    if ($('#userType').val() === 'player'){
        return;
    }
    const sceneIds = [];
    async.parallel([
        async ()=>{
            $('.scene-item').each(function(){
                if (!$(this).data('busy')){
                    sceneIds.push($(this).data('scene-id'));
                }
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
            } else {
                showError('Scene Validation Failed');
            }
        },
        updateTimeslotUsersCount
    ]);
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
    }
    for (const location of locations){
        const $header = $(`#location-${location.id}-header`);
        switch (location.scene_request_status){
            case 'requested': $header.addClass('bg-warning-subtle'); break;
            case 'required': $header.addClass('bg-info-subtle'); break;
            case 'rejected': $header.addClass('bg-danger-subtle'); break;
        }
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
                    break;
                case 'required':
                    switch (sceneLocationData.scene_request_status){
                        case 'requested': cellClass = 'info'; break;
                        case 'required': cellClass = 'success'; break;
                        case 'rejected': cellClass = 'danger'; break;
                    }
                    break;
                case 'rejected':
                    cellClass = 'danger';
                    break;
            }
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

async function showUsersBtn(e){
    e.preventDefault();
    const $btn = $(this);
    const timeslotId = $btn.data('timeslot-id');
    const type = $btn.data('type');
    $('.users-btn').removeClass('active');
    if (Number($('#users-panel').attr('timeslot-id')) !== timeslotId){
        clearTimeslotHighlight();
    }

    if (Number($('#users-panel').attr('timeslot-id')) === timeslotId &&
        $('#users-panel').attr('type') === type &&
        $('#detail-container').hasClass('show')){
        clearTimeslotHighlight();
        closeDetailPanel();
        return;
    }
    $btn.addClass('active');
    $btn.find('i.fas')
        .removeClass('fa-user')
        .removeClass('fa-users')
        .addClass('fa-spin')
        .addClass('fa-sync');
    $btn.tooltip('hide');

    await updateUsersPanel(timeslotId, type);

    if (!$('#detail-container').hasClass('show')){
        await splitDetailPanel();
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

async function updateUsersPanel(timeslotId, type){
    if ($('#scheduleType').val() !== 'edit'){
        return;
    }
    if (!timeslotId){
        timeslotId = $('#users-panel').attr('timeslot-id');
    }
    if (!type){
        type = $('#users-panel').attr('type');
    }
    if (type === 'init'){
        return;
    }

    $('#users-panel').attr('type', type);
    $('#users-panel').attr('timeslot-id', timeslotId);

    $('#users-panel').find('.content').hide();
    $('#users-panel').find('.loading').show();
    $('#users-panel').find('.title').text('Loading');
    const eventId = $('#eventId').val();
    let url = '';
    if (type === 'busy-all'){
        url = `/event/${eventId}/timeslot/${timeslotId}/busy`;
    } else {
        url = `/event/${eventId}/timeslot/${timeslotId}?type=${type}`;
    }

    const result = await fetch(url);
    const data = await result.json();
    if (data.success){
        formatUsersData(data, type);
        $('#users-panel').find('.loading').hide();
    } else {
        showError(data.error);
    }
}

function formatUsersData(data, type){
    let title = `Unscheduled Players at ${data.timeslot.name}`;
    if (type === 'staff'){
        title = `Unscheduled Staff at ${data.timeslot.name}`;
    } else if (type === 'all'){
        title = `All Attendees at ${data.timeslot.name}`;
    } else if (type === 'busy-all'){
        title = `Busy Attendees at ${data.timeslot.name}`;
    }

    data.capitalize=function capitalize(string){
        return string.charAt(0).toUpperCase() + string.slice(1);
    };
    data.type = type;
    const $panel = $('#users-panel');
    $panel.attr('timeslot-id', data.timeslot.id);
    $panel.attr('scenes', JSON.stringify(_.pluck(data.scenes, 'id')));
    $panel.find('.title').text(title);
    let content = '';
    if (type === 'busy-all'){
        content = busyuserslistTemplate(data);

    } else {
        content = userslistTemplate(data);
    }

    $panel.find('.content').html(content).show();

    $panel.find('.content').find('[data-bs-toggle="tooltip"]').tooltip({
        delay: { 'show': 300, 'hide': 100 },
    });
    for (const scene of data.scenes){
        $(`.scene-item[data-scene-id=${scene.id}]`).addClass('scene-item-droppable');
        $(`.scene-item[data-scene-id=${scene.id}]`).find('.scene-details').collapse('show');
    }

    $panel.find('.content').find('.unschedule-busy-btn').on('click', unschedulBusyUserBtn);

    $panel.find('.user-item').draggable({
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

    $('.schedule-busy-type-item').each(function(){
        const $elem = $(this);
        const type = $user.data('user-type');
        if (type === 'player' && !$elem.data('available-to-player')) {
            $elem.addClass('disabled');
        } else if (type === 'staff' && !$elem.data('available-to-staff')){
            $elem.addClass('disabled');
        } else {
            $elem.droppable({
                accept: '.user-item',
                tolerance: 'pointer',
                drop: updateScheduleBusyUser,
                classes: {
                    'ui-droppable-hover': 'bg-success-subtle border-success'
                }
            });
        }
    });
}

function stopDragUser($user, data){
    $user.removeClass('disabled');
    $('.schedule-busy-type-item.ui-droppable').droppable('destroy');
    $('.schedule-busy-type-item').removeClass('disabled');
    $('.scene-item.ui-droppable').droppable('destroy');
    $('.scene-item').removeClass('disabled');
    $('.scene-display').removeClass('bg-info-subtle');
    $('.scene-display').removeClass('bg-success-subtle');f
    $('.scene-display').removeClass('bg-danger-subtle');
}

async function updateSceneUser(event, ui){
    const $scene = $(event.target);
    const $user = $(ui.draggable);
    $scene.find('.scene-details').collapse('show');

    const userId = $user.data('user-id');
    await assignUserToScene(userId, $scene, 'confirmed');
}

async function updateScheduleBusyUser(event, ui){
    const $scheduleBusyType = $(event.target);
    const $user = $(ui.draggable);
    const scheduleBusyTypeId = $scheduleBusyType.data('schedule-busy-type-id');
    const userId = $user.data('user-id');
    const timeslotId = $scheduleBusyType.data('timeslot-id');
    await assignUserToBusy(userId, scheduleBusyTypeId, timeslotId);
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
    hideError();
    const sceneId = $scene.data('scene-id');
    const eventId = $('#eventId').val();
    const data = {
        type: 'scene',
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
        await updateUsersPanel();
        await validateAllScenes();
    } else {
        showError(resultObj.error);
    }
}

async function assignUserToBusy(userId, scheduleBusyTypeId, timeslotId){
    hideError();
    const eventId = $('#eventId').val();
    const data = {
        type: 'schedule_busy',
        schedule_busy_type_id: scheduleBusyTypeId,
        timeslot_id: timeslotId
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
        await updateUsersPanel();
        await validateAllScenes();
    } else {
        showError(resultObj.error);
    }
}

async function unschedulBusyUserBtn(e){
    e.preventDefault();
    const scheduleBusyId = $(this).data('schedule-busy-id');
    const userId = $(this).data('user-id');
    $(this).one('hidden.bs.tooltip', async () =>{
        await unscheduleBusyUser(userId, scheduleBusyId);
    });
    $(this).tooltip('hide');
}

async function unscheduleBusyUser(userId, scheduleBusyId){
    hideError();
    const eventId = $('#eventId').val();
    const data = {
        type: 'unschedule_busy',
        schedule_busy_id: scheduleBusyId
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
        await updateUsersPanel();
        await validateAllScenes();
    } else {
        showError(resultObj.error);
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
            const busyUsers = record.users.filter(user => {return user.busy?user.busy.length:false;});
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
            if (busyUsers.length){
                $elem.find('.busy-users-btn .user-count').text(busyUsers.length);
            } else {
                $elem.find('.busy-users-btn .user-count').text('');
            }
        }
    } else {
        showError(data.error);
    }
}

async function closeDetailPanel(){
    new Promise((resolve, reject) => {
        if (!$('#detail-container').hasClass('show')){
            return;
        }

        $('#schedule-container')
            .removeClass('d-none')
            .addClass('d-flex')
            .animate({height:'100%'}, 200);

        $('#detail-container')
            .addClass('d-none')
            .removeClass('show')
            .css({overflow:'hidden'})
            .animate({height:'0'}, 200, ()=>{
                resolve();
            });
    });
}

async function fullDetailPanel(hideAdjust, hideClose = false){
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
            $('#detail-container').addClass('d-none');
        } else {
            $('#detail-container').removeClass('d-none');
        }

        if (hideClose){
            $('#detail-container >> .resizer-close').addClass('d-none');
        } else {
            $('#detail-container >> .resizer-close').removeClass('d-none');
        }
        $('#detail-container .resizer-expand').hide();
        $('#detail-container .resizer-restore').show();
        $('#detail-container')
            .removeClass('d-none')
            .addClass('show')
            .css({overflow:'visible'})
            .animate({height:`${100-minSize}%`}, 200, ()=>{
                resolve();
            });
    });
}

async function splitDetailPanel(hideClose = false){
    new Promise((resolve, reject) => {
        if (hideClose){
            $('#detail-container .resizer-close').addClass('d-none');
        } else {
            $('#detail-container .resizer-close').removeClass('d-none');
        }

        $('#detail-container .resizer-expand').show();
        $('#detail-container .resizer-restore').hide();
        $('#schedule-container')
            .removeClass('d-none')
            .addClass('d-flex')
            .show()
            .animate({height:'60%'}, 200);

        $('#detail-container')
            .removeClass('d-none')
            .addClass('show')
            .css({overflow:'visible'})
            .show();

        if(!$('#detail-container').hasClass('show')){
            $('#detail-container').css({height:'0%'});
        }
        $('#detail-container .resizer-expand').show();
        $('#detail-container .resizer-restore').hide();
        $('#detail-container').animate({height:'40%'}, 200, () => {
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
            closeDetailPanel();
            clearTimeslotHighlight();
        }
    };

    // Attach the handler
    resizer.addEventListener('mousedown', mouseDownHandler);

    resizer.addEventListener('dblclick', function(){
        const height = parseInt($('#schedule-container')[0].style.height);
        if ( height < (minSize+5)){
            splitDetailPanel();

        } else {
            fullDetailPanel();
        }
    });
}

function showError(message){
    $('#schedule-alert').find('.alert-text').html(message);
    $('#schedule-alert').show();
    $('#schedule-alert').addClass('show');
    const $container= $('#schedule-container');
    $container.animate({
        scrollTop:  $container.scrollTop() + ($('#schedule-alert').position().top - $container.position().top)
    }, 100);
}

function hideError(){
    $('#schedule-alert').removeClass('show');
    $('#schedule-alert').hide();
    $('#schedule-success').removeClass('show');
    $('#schedule-success').hide();
}

function showSuccess(message){
    $('#schedule-success').find('.alert-text').html(message);
    $('#schedule-success').show();
    $('#schedule-success').addClass('show');
    const $container= $('#schedule-container');
    $container.animate({
        scrollTop:  $container.scrollTop() + ($('#schedule-success').position().top - $container.position().top)
    }, 100);
}


function scrollToTimeslot(timeslotId){
    if($('#schedule-alert').hasClass('show')){
        return;
    }
    const $header = $(`.timeslot-header[data-timeslot-id=${timeslotId}]`);
    if ($($header).length){
        const $container= $('#schedule-container');
        $container.animate({
            scrollTop:  $container.scrollTop() + ($header.position().top - $container.position().top) - 50

        }, 100);
    }
}
function userPickerSelect(){
    const userId = $(this).val();
    highlightUserSchedule(userId);
}

function highlightUserScenesToggle(){
    const userId = $(this).is(':checked')?'player':null;
    highlightUserSchedule(userId);
}

async function highlightUserSchedule(userId){
    $('.scene-name').removeClass('fw-bold');
    $('.busy-item').remove();
    console.log('here')

    if (!userId){
        $('.scene-item').removeClass('disabled');
    } else {
        const eventId = $('#eventId').val();
        const url = `/event/${eventId}/user/${userId}/schedule`;
        const result = await fetch(url);
        const data = await result.json();
        $('.scene-item').addClass('disabled');

        if (data.success){
            for (const timeslot of data.schedule){

                for (const scene of timeslot.scenes){
                    $(`.scene-item[data-scene-id=${scene.id}]`).removeClass('disabled');
                    $(`.scene-item[data-scene-id=${scene.id}]`).find('.scene-name').addClass('fw-bold');
                }
                if (timeslot.schedule_busy){
                    addScheduleBusy(timeslot.schedule_busy.name, timeslot.id);
                }
            }
        } else {
            showError(data.error);
        }
    }
}

function addScheduleBusy(text, timeslotId){
    const xAxisType = $('#xAxisType').val();
    const $slot = $(`.schedule-slot[data-timeslot-id=${timeslotId}][data-location-id=busy]`);
    const gridY = $slot.data('pos-y');
    const gridX = $slot.data('pos-x');
    const rows = xAxisType==='location'?1:$('#cellsPerSlot').val();
    const cols = xAxisType==='location'?$('#cellsPerSlot').val():1;

    const $busyScene = $('#null-busy-item').clone();
    $busyScene.addClass('busy-item')
        .attr('id', `busy-timeslot-${timeslotId}`)
        .find('.title').text(text);

    $busyScene
        .css('grid-row', `${gridY} / span ${rows}`)
        .css('grid-column', `${gridX} / span ${cols}`)
        .removeClass('d-none').addClass('d-flex');

    $('#schedule-container-grid').append($busyScene);
}

async function clearUnconfirmedScenes(e){
    e.preventDefault();
    hideError();
    $(this).find('i.fa')
        .removeClass('fa-calendar-times')
        .addClass('fa-spin')
        .addClass('fa-sync');
    const url = $(this).data('url');
    const result = await fetch(url, {
        method: 'PUT',
        headers: {
            'CSRF-Token': $(this).data('csrf')
        }
    });
    const data = await result.json();
    if (data.success){
        showSuccess(`Cleared all unconfirmed Scenes.`);
        data.scenes.forEach(updateSceneLocation);
        await updateAllSlots();
        await validateAllScenes();
        $(this).find('i.fa')
            .addClass('fa-calendar-times')
            .removeClass('fa-spin')
            .removeClass('fa-sync');
    } else {
        showError(data.error);
    }
}

async function runSchedulerBtn(e){
    e.preventDefault();
    hideError();
    $(this).find('i.fa')
        .removeClass('fa-calendar')
        .addClass('fa-spin')
        .addClass('fa-sync');
    showSuccess('Running Scheduler, please wait...')
    const url = $(this).data('url');
    const result = await fetch(url, {
        method: 'PUT',
        headers: {
            'CSRF-Token': $(this).data('csrf')
        }
    });
    const data = await result.json();
    if (data.success){
        showSuccess(`Ran Scheduler ${data.attempts} time(s), resulting in ${data.unscheduled} unscheduled Scenes.`);
        data.scenes.forEach(updateSceneLocation);
        await updateAllSlots();
        await validateAllScenes();
        $(this).find('i.fa')
            .addClass('fa-calendar')
            .removeClass('fa-spin')
            .removeClass('fa-sync');
    } else {
        showError(data.error);
    }
}

function updateSceneLocation(scene){
    if (scene.status === 'scheduled' || scene.status === 'confirmed'){
        const timeslotId = scene.timeslots[0];

        for (let idx = 0; idx < scene.locations.length; idx++){
            const $scene = $(`#scene-${scene.id}-${idx}`);
            $scene.attr('cell', `cell-timeslot-${timeslotId}-location-${scene.locations[idx]}`);
            updateSceneStatus($scene, scene.status);
        }
    } else {
        $(`.scene-item[data-scene-id=${scene.id}]`).each(function(){

            $(this).attr('cell', 'unscheduled');
            updateSceneStatus($(this), scene.status);
        });
    }
}
