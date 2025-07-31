/* globals async scenedetailsTemplate confirmSceneBtn unconfirmSceneBtn unconfirmAllSceneUsersBtn updateUsersPanel */
/* globals updateTimeslotUsersCount
/* globals _ splitDetailPanel fullDetailPanel closeDetailPanel marked */
let isValidatingScenes = 0;
$(function(){
    $('#schedule-alert .btn-close').on('click', ()=>{
        hideMessages();
    });

    $('.issue-icon[data-bs-toggle="popover"]').popover({
        trigger: 'hover',
        delay: { 'show': 300, 'hide': 100 },
        content: function(elem){
            return elem.getAttribute('content');
        },
        customClass:'scene-info-popover'
    });

    $('.location-info[data-bs-toggle="popover"]').popover({
        trigger: 'hover',
        delay: { 'show': 300, 'hide': 100 },
        content: function(elem){
            return marked.parseInline(elem.getAttribute('content'), {breaks:true});
        },
        html:true,
        customClass:'scene-info-popover'
    });


    $('body').on('show.bs.collapse', '.scene-details', function(e){
        const $scene = $(e.target).closest('.scene-item');
        updateSceneDetails($scene);
    });

    $('body').on('hide.bs.collapse', '.scene-details', function(e){
        const $scene = $(e.target).closest('.scene-item');
        $scene.attr('expanded-staff', false);
        $scene.attr('expanded-players', false);
    });

    $('body').on('show.bs.collapse', '.scene-user-list', function(e){
        e.stopPropagation();
        const $scene = $(e.target).closest('.scene-item');
        $scene.attr(`expanded-${$(this).data('list-type')}`, true);
    });
    $('body').on('hide.bs.collapse', '.scene-user-list', function(e){
        e.stopPropagation();
        const $scene = $(e.target).closest('.scene-item');
        $scene.attr(`expanded-${$(this).data('list-type')}`, false);
    });

    $('[data-bs-toggle="tooltip"]').tooltip({
        delay: { 'show': 300, 'hide': 100 },
    });
    validateAllScenes();
    updateAllSlots();

    $('#schedule-user-picker').on('change', userPickerSelect);
    $('#highlight-user-scenes').on('change', highlightUserScenesToggle);

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

    $('#schedule-tag-picker').on('change', updateTagFilter);
});

function updateAllSlots(){
    $('.schedule-slot').each(function(){
        updateSlotScenes($(this));
    });
}

function highlightScene(sceneId){
    $('.timeslot-header').removeClass('text-bg-info');
    $('.schedule-cell').removeClass('text-bg-info');

    $(`.scene-item[data-scene-id=${sceneId}]`).each( function(){
        const cell = $(this).attr('cell');
        $(this).find('.scene-details').collapse('show');
        $(`#${cell}`).addClass('text-bg-info');

    });
    const firstCell = $(`#scene-${sceneId}-0`).attr('cell');
    const $slot = $(`#${firstCell}`);
    const timeslotId = $slot.data('timeslot-id');
    const locationId = $slot.data('location-id');

    if ($('#xAxisType').val() === 'location'){
        scrollToTimeslot(timeslotId);
    } else {
        scrollToSlot(timeslotId, locationId);
    }
}

function updateTagFilter(e){
    const tag = $(this).val();
    if (!tag){ return; }
    $('.scene-item').removeClass('tag-disabled');
    if (tag === '-1'){
        $(this).val(null).trigger('change');
        return;
    }
    $('.scene-item').each(function(){
        const $scene = $(this);
        if (_.indexOf($scene.data('tags'), tag) === -1){
            $scene.addClass('tag-disabled');
        }
    });
}

function collapseAllScenes(){
    $('.scene-item').find('.scene-details').collapse('hide');
}

function collapseScenes(scenes){
    for (const sceneId of scenes){
        $(`.scene-item[data-scene-id=${sceneId}]`).find('.scene-details').collapse('hide');
    }
}

async function confirmAllSceneUsersBtn(e){
    e.preventDefault();
    const $scene = $(this).closest('.scene-item');
    const type = $(this).data('type');
    $(this).one('hidden.bs.tooltip', async () =>{
        confirmAllSceneUsers($scene, type);
    });
    $(this).tooltip('hide');
}

async function confirmAllSceneUsers($scene, type){
    const sceneId = $scene.data('scene-id');
    const eventId = $('#eventId').val();
    const url = `/event/${eventId}/scene/${sceneId}/users/confirm/${type}`;

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


function updateSlotScenes($slot){

    const $children = $(`.scene-item[cell=${$slot.attr('id')}`);
    const xAxisType = $('#xAxisType').val();

    let gridY = $slot.data('pos-y');
    let gridX = $slot.data('pos-x');
    let maxRows = 1;
    let xCounter = 0;

    $children.sort((a, b) => {
        return $(a).data('scene-name').localeCompare($(b).data('scene-name'));
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
                    gridX = $slot.data('pos-x');
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

async function updateSceneDetails($scene){
    const sceneId = $scene.data('scene-id');
    const result = await fetch(`/scene/${sceneId}?api=true`);
    const data = await result.json();
    data.scheduleType = $('#scheduleType').val();
    data.userType = $('#userType').val();
    data.marked = marked;
    data.capitalize = function capitalize(string){
        return string.charAt(0).toUpperCase() + string.slice(1);
    };
    $(`.scene-item[data-scene-id=${sceneId}]`).each(function(){
        const $scene = $(this);
        data.locationIdx = $scene.data('location-idx');
        $scene.find('.scene-details').html(scenedetailsTemplate(data));
        $scene.find('.scene-details').find('[data-bs-toggle="tooltip"]').tooltip({
            delay: { 'show': 300, 'hide': 100 },
        });
        if (typeof confirmSceneBtn !== 'undefined'){
            $scene.find('.confirm-scene-btn').on('click', confirmSceneBtn);
            $scene.find('.unconfirm-scene-btn').on('click', unconfirmSceneBtn);
            $scene.find('.unconfirm-all-scene-users-btn').on('click', unconfirmAllSceneUsersBtn);
        }
        $scene.find('.unschedule-user-btn').on('click', unscheduleSceneUserBtn);
        $scene.find('.schedule-user-btn').on('click', scheduleSceneUserBtn);
        $scene.find('.confirm-all-scene-users-btn').on('click', confirmAllSceneUsersBtn);

        if ($('#detail-container').hasClass('show') && $('#bottom-panel').attr('type')){
            if ($('#bottom-panel').attr('type') === 'all'){
                $scene.find('.scene-user-list').collapse('show');
            } else {
                $scene.find(`.scene-${$('#bottom-panel').attr('type')}-list`).collapse('show');
            }
        }
        if ($scene.attr('expanded-staff') === 'true'){
            $scene.find('.scene-staff-list').collapse('show');
        }
        if ($scene.attr('expanded-players') === 'true'){
            $scene.find('.scene-player-list').collapse('show');
        }
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
    async.parallel([
        async ()=>{
            const sceneIds = [];
            $('.scene-item').each(function(){
                if (!$(this).data('busy')){
                    sceneIds.push($(this).data('scene-id'));
                }
            });
            return validateScenes(sceneIds);
        },
        async()=>{
            if (typeof updateTimeslotUsersCount !== 'undefined'){
                return updateTimeslotUsersCount();
            }
            return;
        }

    ]);
}

async function validateScenes(sceneIds){
    isValidatingScenes++;
    if (isValidatingScenes > 1) { return; }
    $('#validatingIndicator').show();
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
                const warningIssues = scene.issues.filter(issue => { return issue.level === 'warning' && !issue.ignored;});
                if (warningIssues.length){
                    $scene.addClass('validation-warning');
                    $scene.find('.scene-warning').attr('content', makeValidationHtml(warningIssues)[0].innerHTML);
                } else {
                    $scene.removeClass('validation-warning');
                }
                const infoIssues = scene.issues.filter(issue => { return issue.level === 'info' && !issue.ignored;});
                if (infoIssues.length){
                    $scene.addClass('validation-info');
                    $scene.find('.scene-info').attr('content', makeValidationHtml(infoIssues)[0].innerHTML);
                } else {
                    $scene.removeClass('validation-info');
                }
            });
        }
    } else {
        showError('Scene Validation Failed');
    }
    $('#validatingIndicator').hide();
    isValidatingScenes--;
    if (isValidatingScenes > 0){
        isValidatingScenes = 0;
        validateScenes(sceneIds);
    }
    return;
}

function makeValidationHtml(issues){
    const $ul = $('<ul>');
    for (const issue of issues){
        const $li = $('<li>');
        $li.text(issue.text);
        $ul.append($li);
    }
    return $ul;
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
    hideMessages();
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
        if (typeof updateUsersPanel !== 'undefined'){
            await updateUsersPanel();
        }
        await validateAllScenes();
    } else {
        showError(resultObj.error);
    }
}

function showError(message){
    $('#schedule-alert').find('.alert-text').html(message);
    $('#schedule-alert').show();
    $('#schedule-alert').addClass('show');
    const $container= $('#top-panel');
    $container.animate({
        scrollTop:  $container.scrollTop() + ($('#schedule-alert').position().top - $container.position().top)
    }, 100);
}

function hideMessages(){
    $('#schedule-alert').removeClass('show');
    $('#schedule-alert').hide();
    $('#schedule-success').removeClass('show');
    $('#schedule-success').hide();
}

function showSuccess(message){
    $('#schedule-success').find('.alert-text').html(message);
    $('#schedule-success').show();
    $('#schedule-success').addClass('show');
    const $container= $('#top-panel');
    $container.animate({
        scrollTop:  $container.scrollTop() + ($('#schedule-success').position().top - $container.position().top)
    }, 100);
}

function scrollToSlot(timeslotId, locationId){
    if($('#schedule-alert').hasClass('show')){
        return;
    }
    const $cell = $(`#cell-timeslot-${timeslotId}-location-${locationId}`);
    if ($($cell).length){
        const $container = $('#top-panel');
        $container.animate({
            scrollTop:  $container.scrollTop() + ($cell.position().top - $container.position().top) - 0,
            scrollLeft:  $container.scrollLeft() + ($cell.position().left - $container.position().left) - 240
        }, 100);
    }
}

function scrollToTimeslot(timeslotId){
    if($('#schedule-alert').hasClass('show')){
        return;
    }
    const $header = $(`.timeslot-header[data-timeslot-id=${timeslotId}]`);
    if ($($header).length){
        const $container= $('#top-panel');
        if ($('xAxisType' === 'location')){
            $container.animate({
                scrollTop:  $container.scrollTop() + ($header.position().top - $container.position().top) - 50

            }, 100);
        } else {
            $container.animate({
                scrollLeft:  $container.scrollLeft() + ($header.position().left - $container.position().left) - 240

            }, 100);
        }
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

    if (!userId){
        $('.scene-item').removeClass('disabled');
    } else {
        const eventId = $('#eventId').val();

        let url = `/event/${eventId}/user/${userId}/schedule`;
        if ($('#scheduleType').val()==='edit'){
            url += '?unconfirmed=true';
        }
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

    $busyScene.find('.title').text(text);

    $busyScene
        .addClass('busy-item')
        .attr('id', `busy-timeslot-${timeslotId}`)
        .css('grid-row', `${gridY} / span ${rows}`)
        .css('grid-column', `${gridX} / span ${cols}`)
        .removeClass('d-none')
        .addClass('d-flex');

    $('#schedule-container-grid').append($busyScene);
}
