/* globals showSuccess collapseScenes collapseAllScenes, confirmScene updateAllSlots validateAllScenes updateSceneStatus showUsersBtn collapseAllScenes*/
/* globals _ splitDetailPanel fullDetailPanel closeDetailPanel showError hideMessages */
$(function(){
    $('[data-bs-toggle="tooltip"]').tooltip({
        delay: { 'show': 300, 'hide': 100 },
    });

    $('#confirm-schedule-btn').confirmation({
        title:'Confirm all scheduled scenes?'
    }).on('click', confirmAllScenes);

    $('#clear-schedule-btn').confirmation({
        title:'Clear all non-confirmed scenes?'
    }).on('click', clearUnconfirmedScenes);

    $('.run-scheduler-btn').confirmation({}).on('click', runSchedulerBtn);

    $('#detail-container').on('closed', function(e){
        clearTimeslotHighlight();
    });

    $('#collapse-all-scenes-btn').on('click', function(e){
        $(this).tooltip('hide');
        collapseAllScenes();
    });
});

function clearTimeslotHighlight(){
    $('.timeslot-header').removeClass('text-bg-info');
    $('.schedule-cell').removeClass('text-bg-info');
    $('.users-btn').removeClass('active');
    $('.scene-item').removeClass('scene-item-droppable');
    collapseScenes(JSON.parse($('#bottom-panel').attr('scenes')));
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

async function clearUnconfirmedScenes(e){
    e.preventDefault();
    hideMessages();
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
        showSuccess('Cleared all unconfirmed Scenes.');
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
    hideMessages();
    $(this).find('i.fa')
        .removeClass('fa-calendar')
        .addClass('fa-spin')
        .addClass('fa-sync');
    showSuccess('Running Scheduler, please wait...');
    $('#schedulerProgress').attr('aria-valuenow', '0');
    $('#schedulerProgressBar').width('0%').text('0%');
    $('#schedulerProgress').removeClass('d-none');

    const url = $(this).data('url');
    const phase = $(this).data('phase');
    const result = await fetch(url, {
        method: 'PUT',
        headers: {
            'CSRF-Token': $(this).data('csrf'),
            'Content-Type': 'application/json'
        },
        body:JSON.stringify({phase:phase})
    });

    const reader = result.body.getReader();
    let data = null;

    for(;;){
        const { done, value } = await reader.read();
        if (done) break;
        var text = new TextDecoder('utf-8').decode(value);
        const lines = text.split('\n');
        let runningText = '';
        for (const line of lines) {
            try {
                runningText += line;
                let obj = JSON.parse(runningText);
                if (obj.type === 'summary'){
                    data = obj;
                }
                if (obj.type === 'scene status'){
                    const total = obj.scenes * obj.runs;
                    let current = 0;
                    for (const runIdx in obj.status){
                        if (obj.status[runIdx].scheduler === 'done'){
                            current += obj.scenes;
                        } else {
                            for (const status in obj.status[runIdx].scenes){
                                if (status === 'done'){
                                    current += obj.status[runIdx].scenes[status];
                                } else if (status !== 'new'){
                                    current += (obj.status[runIdx].scenes[status] * 0.5);
                                }
                            }
                        }
                    }
                    const percent = Math.round((current/total) * 100);
                    $('#schedulerProgress').attr('aria-valuenow', ''+percent);
                    $('#schedulerProgressBar').width(`${percent}%`).text(`${percent}%`);
                }
                runningText = '';
            } catch (e) {
                // Not a valid JSON object
            }
        }

    }

    if (data.success){
        showSuccess(`Ran Scheduler ${data.attempts} time(s) in ${Math.round(data.processTime/100)/10} seconds, resulting in ${data.unscheduled} unscheduled Scenes.`);
        $('#schedulerProgress').addClass('d-none');
        if (data.issues.length){
            showError(data.issues.join('<br>'));
        }
        data.scenes.forEach(updateSceneLocation);
        collapseAllScenes();
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
