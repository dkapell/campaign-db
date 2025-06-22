/* globals validateAllScenes updateSlotScenes updateSceneStatus updateSceneDetails */
/* globals _ splitDetailPanel fullDetailPanel closeDetailPanel showError hideMessages */
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
        containment:'#top-panel-grid'

    });

    $('.schedule-slot').droppable({
        accept: '.scene-item',
        tolerance: 'pointer',
        drop: updateSceneSchedule,
        classes: {
            'ui-droppable-hover': 'border-success'
        }

    });

});

async function updateSceneSchedule(event, ui){
    const $slot = $(event.target);
    const $scene = $(ui.draggable);

    const reasons = validateMove($scene, $slot);

    if (reasons.length) {
        showError(reasons.join('<br>'));
        return;
    }
    hideMessages();

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

