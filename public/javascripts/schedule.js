$(function(){
    $('.scene-item-draggable').draggable({
        snap:'.schedule-slot',
        handle: '.handle',
        zIndex: 9999,
        tolerance: 'pointer',
        snapMode:'inner',
        revert: true,
        revertDuration: 0,
        start: function(event, ui){
            startDragScene($(this));
        },
        stop: function (event, ui) {
            stopDragScene($(this));
        }
    }); 

    $('.schedule-slot').droppable({
        accept: '.scene-item',
        tolerance: "pointer",
        drop: updateSceneSchedule

    });

    $('.schedule-slot').each(function(){
        updateScenes($(this));
    });

    $('#schedule-alert .btn-close').on('click', ()=>{
        $('#schedule-alert').hide();
    })

    $('[data-bs-toggle="popover"]').popover({
        trigger: 'hover',
        delay: { 'show': 300, 'hide': 100 },
        content: function(elem){
            return elem.getAttribute('content');
        }
    });
    $('[data-bs-toggle="tooltip"]').tooltip({
        delay: { 'show': 300, 'hide': 100 },
    });

    validateAllScenes();

});

async function updateSceneSchedule(event, ui){
    const $slot = $(event.target);
    const $scene = $(ui.draggable);

    const reasons = validateMove($scene, $slot);

    if (reasons.length) {
        $('#schedule-alert').find('.alert-text').html(reasons.join('<br>'))
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

    await updateScenes($slot);
    await updateScenes($old);

    await recordScheduleUpdate($scene, $slot);

    await validateAllScenes();
}

function validateMove($scene, $slot){
    const reasons = [];
    $(`.scene-item[cell=${$slot.attr('id')}`).each(function (){
        if ($(this).data('scene-id') === $scene.data('scene-id') &&
            $slot.attr('id') !== 'unscheduled' &&
            $(this).attr('id') !== $scene.attr('id')){
            reasons.push('Can not schedule two of the same scene in the same location/timeslot.')
        }
    });
    if ($slot.attr('id') !== 'unscheduled'){
        const $scenes = $(`.scene-item[data-scene-id=${$scene.data('scene-id')}]`)
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

                    reasons.push('Can not schedule two locations of the same scene in different timeslots.')
                }
            });
        }
    }
    return reasons;
}

async function recordScheduleUpdate($scene){
    const sceneId = $scene.data('scene-id');
    const eventId = $('#eventId').val();
    const $scenes = $(`.scene-item[data-scene-id=${sceneId}]`)

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
    })
    const csrf = $('#csrfToken').val();
    const url = `/event/${eventId}/schedule/${sceneId}`;
    const result = await fetch(url, {
        method:'PUT',
        headers: {
            'CSRF-Token': csrf,
            'Content-Type': 'application/json'
        },
        body:JSON.stringify({scene:data})

    });

    const resultObj = await result.json();
    if (resultObj.success){
        $scene.attr('timeslots', JSON.stringify(resultObj.scene.timeslots));
        $scene.attr('locations', JSON.stringify(resultObj.scene.locations));
    } else {
        $('#schedule-alert').find('.alert-text').html(resultObj.error)
        $('#schedule-alert').show();
    }


}

async function updateScenes($slot){

    const $children = $(`.scene-item[cell=${$slot.attr('id')}`);

    let gridY = $slot.data('pos-y');
    let gridX = $slot.data('pos-x')
    let maxRows = 1;

    $children.each(async function(idx){
        const $scene = $(this);
        const rows = $scene.data('timeslot-count');
        let cols = $('#cellsPerSlot').val()

        if ($slot.attr('id') === 'unscheduled'){
            const columnCount = $('#locationColumns').val();
            $scene.appendTo($slot);
            const maxCells = Math.floor(columnCount / cols);

            gridX = $slot.data('pos-x') + idx%maxCells * cols

            $scene.find('.scene-display').addClass('m-1');

            if ((idx+1) * cols > columnCount){
                gridY += maxRows;
                maxRows = 1;
            }

            if (rows > maxRows){
                maxRows = rows;
            }
            $scene.removeClass('border-success');
            $scene.removeClass('border-warning');

        } else {
            $scene.appendTo($slot.parent());
            if ($scene.attr('data-status') === 'confirmed'){
                $scene.addClass('border-success');
            } else {
                $scene.addClass('border-warning');
            }
            if ($children.length > $slot.data('children-count')){

                $scene.find('.scene-display').removeClass('m-1');
                const width = $slot.width();
                const left = 5 + idx* width / ($children.length * 1.5)
                const top = 0.25 + idx*0.25
                const right = ($children.length - idx) * 0.25

                $scene.css('margin', `${top}rem ${right}rem 0.25rem ${ left}px`);
                gridX =  $slot.data('pos-x')
            } else {
                cols = Math.floor(cols / $children.length);
                $scene.find('.scene-display').addClass('m-1');
                $scene.css('margin', 0);
                gridX = $slot.data('pos-x') + idx*cols;
            }
        }
        $scene
            .css('grid-row', `${gridY} / span ${rows}`)
            .css('grid-column', `${gridX} / span ${cols}`)
            .removeClass('d-none').addClass('d-flex');
    });
}

async function validateAllScenes(){
    const sceneIds = [];
    $('.scene-item').each(function(){
        sceneIds.push($(this).data('scene-id'));
    })
    const url = `/event/${$('#eventId').val()}/schedule/validate?`

    const result = await fetch(url + new URLSearchParams({
        scenes: _.uniq(sceneIds)
    }).toString());

    const data = await result.json();
    if (data.success){
        for (scene of data.scenes){
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
}

function makeValidationHtml(issues){
    const $ul = $('<ul>')
    for (const issue of issues){
        const $li = $('<li>');
        $li.text(issue);
        $ul.append($li);
    }
    return $ul;
}

function startDragScene($elem){
    const timeslots = JSON.parse($elem.attr('timeslots'));
    const locations = JSON.parse($elem.attr('locations'));
    $elem.attr('data-status', 'suggested');

    for (const timeslot of timeslots){
        const $header = $(`#timeslot-${timeslot.id}-header`);
        switch (timeslot.scene_request_status){
            case 'requested': $header.addClass(`bg-warning-subtle`); break;
            case 'required': $header.addClass(`bg-info-subtle`); break;
            case 'rejected': $header.addClass(`bg-danger-subtle`); break;
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
            case 'requested': $header.addClass(`bg-warning-subtle`); break;
            case 'required': $header.addClass(`bg-info-subtle`); break;
            case 'rejected': $header.addClass(`bg-danger-subtle`); break;
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
                    cellClass = 'danger'
                    break
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
