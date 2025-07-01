/* globals userslistTemplate busyuserslistTemplate async updateSceneStatus updateSceneDetails*/
/* globals updateSlotScenes validateScenes clearTimeslotHighlight scrollToTimeslot assignUserToScene validateAllScenes */
/* globals _ splitDetailPanel fullDetailPanel closeDetailPanel showError hideMessages */
$(function(){
    $('.users-btn').on('click', showUsersBtn);
});

async function unconfirmAllSceneUsersBtn(e){
    e.preventDefault();
    const $scene = $(this).closest('.scene-item');
    const type = $(this).data('type');
    $(this).one('hidden.bs.tooltip', async () =>{
        unconfirmAllSceneUsers($scene, type);
    });
    $(this).tooltip('hide');
}

async function unconfirmAllSceneUsers($scene, type){
    const sceneId = $scene.data('scene-id');
    const eventId = $('#eventId').val();
    const url = `/event/${eventId}/scene/${sceneId}/users/unconfirm/${type}`;

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
        await updateSlotScenes($slot);
        validateScenes([sceneId]);
    } else {
        showError(resultObj.error);
    }
}

async function showUsersBtn(e){
    e.preventDefault();
    const $btn = $(this);
    const timeslotId = $btn.data('timeslot-id');
    const type = $btn.data('type');
    $('.users-btn').removeClass('active');
    $('#show-issues-btn').removeClass('active');
    if (Number($('#bottom-panel').attr('timeslot-id')) !== timeslotId){
        clearTimeslotHighlight();
    }

    if (Number($('#bottom-panel').attr('timeslot-id')) === timeslotId &&
        $('#bottom-panel').attr('type') === type &&
        $('#detail-container').hasClass('show')){
        closeDetailPanel();
        return;
    }
    $btn.addClass('active');
    $btn.find('i.fas')
        .removeClass('fa-user')
        .removeClass('fa-users')
        .removeClass('fa-user-check')
        .addClass('fa-spin')
        .addClass('fa-sync');
    $btn.tooltip('hide');

    await updateUsersPanel(timeslotId, type);

    if (!$('#detail-container').hasClass('show')){
        await splitDetailPanel();
    }
    hideMessages();
    scrollToTimeslot(timeslotId);

    $(`.timeslot-header[data-timeslot-id=${timeslotId}]`).addClass('text-bg-info');
    $(`.schedule-cell[data-timeslot-id=${timeslotId}]`).addClass('text-bg-info');

    let icon = 'fa-users';
    if (type === 'player'){icon = 'fa-user'; }
    if (type === 'all'){icon = 'fa-globe'; }
    if (type === 'busy'){icon = 'fa-user-check'; }

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
        timeslotId = $('#bottom-panel').attr('timeslot-id');
    }
    if (!type){
        type = $('#bottom-panel').attr('type');
    }
    if (type === 'init' || type === 'issues'){
        return;
    }

    $('#bottom-panel').attr('type', type);
    $('#bottom-panel').attr('timeslot-id', timeslotId);

    $('#bottom-panel').find('.content').hide();
    $('#bottom-panel').find('.panel-loading').show();
    $('#bottom-panel').find('.title').text('Loading');
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
        $('#bottom-panel').find('.panel-loading').hide();
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
    const $panel = $('#bottom-panel');
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
        $(`.scene-item[data-scene-id=${scene.id}]`).each(function(){
            const $scene = $(this);
            if ($scene.find('.scene-details').hasClass('show')){
                updateSceneDetails($scene);
            } else {
                $scene.find('.scene-details').collapse('show');
            }
        });
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

async function updateScheduleBusyUser(event, ui){
    const $scheduleBusyType = $(event.target);
    const $user = $(ui.draggable);
    const scheduleBusyTypeId = $scheduleBusyType.data('schedule-busy-type-id');
    const userId = $user.data('user-id');
    const timeslotId = $scheduleBusyType.data('timeslot-id');
    await assignUserToBusy(userId, scheduleBusyTypeId, timeslotId);
}

async function assignUserToBusy(userId, scheduleBusyTypeId, timeslotId){
    hideMessages();
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
    hideMessages();
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


