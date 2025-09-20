/* globals async scenedetailsTemplate confirmSceneBtn unconfirmSceneBtn unconfirmAllSceneUsersBtn updateUsersPanel */
/* globals updateTimeslotUsersCount unscheduleSceneBtn */
/* globals _ splitDetailPanel fullDetailPanel closeDetailPanel marked */
let isValidatingScenes = 0;
$(function(){
    $('#schedule-alert .btn-close').on('click', ()=>{
        hideAlertMessage();
    });

    $('#schedule-success .btn-close').on('click', ()=>{
        hideSuccessMessage();
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
        expandScene($scene);
        updateSceneDetails($scene);
    });

    $('body').on('hide.bs.collapse', '.scene-details', function(e){
        const $scene = $(e.target).closest('.scene-item');
        restoreScene($scene);
        $scene.attr('expanded-staff', false);
        $scene.attr('expanded-player', false);
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
    $('#highlight-open-scenes').on('change', highlightOpenScenesToggle);


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

        $(`.scene-placeholder[parent-id="${$scene.attr('id')}"]`).remove();

        if ($slot.attr('id') === 'unscheduled'){
            $scene.find('.scene-display').addClass('m-1');

            const columnCount = Number($('#unscheduledCols').val());
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
                if ((gridX + timeslotCount) > columnCount+1){
                    gridX = $slot.data('pos-x');
                    xCounter = 0;
                    gridY+=Number($('#cellsPerSlot').val());
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
                if ($scene.data('setup')){
                    let setup_size = Number($scene.data('setup'));
                    if (gridY - setup_size < 2) {
                        setup_size = gridY - 2;
                    }

                    const placeholderRow = gridY - setup_size;
                    const placeholderCol = gridX;
                    for (let i = 0; i < setup_size; i++){
                        const title = `Setup for ${$scene.data('scene-name')}`;
                        updatePlaceholder($scene, $slot, placeholderRow+i, placeholderCol, title, i);
                    }
                }

                if ($scene.data('cleanup')){
                    let cleanup_size = Number($scene.data('cleanup'));
                    const maxRows = $('#locationRows').val();
                    if (gridY + cleanup_size > maxRows){
                        cleanup_size = maxRows - gridY +1;
                    }
                    const placeholderRow = gridY + $scene.data('timeslot-count');
                    const placeholderCol = gridX;

                    for (let i = 0; i < cleanup_size; i++){
                        const title = `Cleanup for ${$scene.data('scene-name')}`;
                        updatePlaceholder($scene, $slot, placeholderRow+i, placeholderCol, title, i);
                    }
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

                if ($scene.data('setup')){
                    let setup_size = Number($scene.data('setup'));
                    if (gridX - setup_size < 2) {
                        setup_size = gridX - 2;
                    }
                    const placeholderRow = gridY;
                    const placeholderCol = gridX - setup_size;
                    for (let i = 0; i < setup_size; i++){
                        const title = `Setup for ${$scene.data('scene-name')}`;
                        updatePlaceholder($scene, $slot, placeholderRow, placeholderCol+i, title, i);
                    }
                }

                if ($scene.data('cleanup')){
                    let cleanup_size = Number($scene.data('cleanup'));
                    const maxRows = $('#locationColumns').val();
                    if (gridX + cleanup_size > maxRows){
                        cleanup_size = maxRows - gridX +1;
                    }

                    const placeholderRow = gridY;
                    const placeholderCol = gridX + $scene.data('timeslot-count');

                    for (let i = 0; i < cleanup_size; i++){
                        const title = `Cleanup for ${$scene.data('scene-name')}`;
                        updatePlaceholder($scene, $slot, placeholderRow, placeholderCol+i, title, i);
                    }
                }

            }
        }
        $scene
            .css('grid-row', `${gridY} / span ${rows}`)
            .css('grid-column', `${gridX} / span ${cols}`)
            .removeClass('d-none').addClass('d-flex');

        updateSceneStatus($scene);
    });
    $(`.schedule-slot[data-location-id=${$slot.data('location-id')}]`).each(function() {
        updateSlotPlaceholders($(this));
    });
}

function updatePlaceholder($scene, $slot, row, col, title, idx){
    const xAxisType = $('#xAxisType').val();
    const rows = xAxisType==='location'?1:$('#cellsPerSlot').val();
    const cols = xAxisType==='location'?$('#cellsPerSlot').val():1;
    const $placeholderSlot =  $(`.schedule-slot[data-pos-y="${row}"][data-pos-x="${col}"]`);
    let $placeholder = $(`.scene-placeholder[cell=${$placeholderSlot.attr('id')}`);
    if ($placeholder.length){
        let messages = JSON.parse($placeholder.attr('messages'));
        messages = messages.filter(message => {
            return message.sceneId !== $scene.attr('id');
        });
        messages.push({
            sceneId: $scene.attr('id'),
            slotId: $slot.attr('id'),
            text: title,
            idx: idx
        });
        $placeholder.attr('messages', JSON.stringify(messages));
        $placeholder.find('.placeholder-title').html(_.pluck(messages, 'text').join('<br>'));

    } else {
        $placeholder = makePlaceholder($scene, $slot, row, col, title, idx);
        $placeholder.appendTo($slot.parent());

        if (xAxisType === 'location'){
            $placeholder
                .css('grid-row', `${row} / span 1`)
                .css('grid-column', `${col} / span ${cols}`);
        } else {
            $placeholder
                .css('grid-row', `${row} / span ${rows}`)
                .css('grid-column', `${col} / span 1`);
        }
    }
}

function updateSlotPlaceholders($slot){
    const slotId = $slot.attr('id');
    $('.scene-placeholder').each(function(){
        const $placeholder = $(this);
        let messages = JSON.parse($placeholder.attr('messages'));
        if (!_.findWhere(messages, {slotId:$slot.attr('id')})){
            return;
        }
        messages = messages.filter(message => {
            if (message.slotId !== slotId) { return true; }
            const $scene = $(`#${message.sceneId}`);
            const sceneSlotId = $scene.attr('cell');
            return sceneSlotId === slotId;
        });
        if (messages.length){
            $placeholder.attr('messages', JSON.stringify(messages));
            $placeholder.find('.placeholder-title').html(_.pluck(messages, 'text').join('<br>'));
            const size = findPlaceholderBlock($placeholder);
            if (!size){
                $placeholder
                    .removeClass('d-flex')
                    .addClass('d-none');

            } else {
                $placeholder
                    .removeClass('d-none')
                    .addClass('d-flex');

            }
            const xAxisType = $('#xAxisType').val();
            if ($('#xAxisType').val() === 'location'){
                $placeholder.css('grid-row-end', Number($placeholder.css('grid-row-start')) + size);
            } else {
                $placeholder.css('grid-column-end', Number($placeholder.css('grid-column-start')) + size);
            }

        } else {
            $placeholder.remove();
        }
    });
}

function makePlaceholder($parent, $slot, row, col, title, idx){
    const messages = [];
    messages.push({
        sceneId: $parent.attr('id'),
        slotId: $slot.attr('id'),
        text: title,
        idx:idx
    });

    const $placeholderSlot = $(`.schedule-slot[data-pos-y="${row}"][data-pos-x="${col}"]`);

    const $placeholder = $('<div>')
        .attr('cell', $placeholderSlot.attr('id'))
        .addClass('scene-placeholder')
        .addClass('d-flex')
        .attr('messages', JSON.stringify(messages));

    const $inner = $('<div>')
        .addClass('m-1')
        .addClass('p-1')
        .addClass('bg-body')
        .addClass('border')
        .addClass('d-flex')
        .addClass('flex-grow-1')
        .addClass('align-items-center')
        .addClass('justify-content-center');
    const $title = $('<div>').addClass('placeholder-title').addClass('d-flex').text(title).appendTo($inner);
    $inner.appendTo($placeholder);
    return $placeholder;
}

function findPlaceholderBlock($placeholder){
    const messages = JSON.parse($placeholder.attr('messages'));
    const xAxisType = $('#xAxisType').val();
    let min;
    if (xAxisType === 'location'){
        min = Number($placeholder.css('grid-row-start'));
    } else {
        min = Number($placeholder.css('grid-column-start'));
    }
    let size = 1;

    $('.scene-placeholder').each(function(){
        if ($(this).attr('cell') === $placeholder.attr('cell')){ return; }

        const checkMessages = JSON.parse($(this).attr('messages'));
        if (messages.length !== checkMessages.length){
            return;
        }
        for (const message of messages){
            if (!_.findWhere(checkMessages, {sceneId:message.sceneId, slotId: message.slotId, text:message.text})){
                return;
            }
        }
        let checkSlotLoc;
        if (xAxisType === 'location'){
            checkSlotLoc = Number($(this).css('grid-row-start'));
        } else {
            checkSlotLoc = Number($(this).css('grid-column-start'));
        }
        if (checkSlotLoc < min){
            min = checkSlotLoc;
        }
        size++;
    });

    if (xAxisType === 'location' && min !== Number($placeholder.css('grid-row-start'))){
        return 0;
    } else if (xAxisType !== 'location' && min !== Number($placeholder.css('grid-column-start'))){
        return 0;
    }
    return size;
}

function expandScene($scene){
    const cellId = $scene.attr('cell');
    const $cell = $(`#${cellId}`);
    const $siblings = $(`.scene-item[cell="${cellId}"]`);
    const xAxisType = $('#xAxisType').val();

    if ($scene.attr('expanded') === 'true'){
        return;
    }
    if ($scene.attr('cell') === 'unscheduled'){
        return;
    }
    if ($siblings.length > 1){
        $(`.scene-item[cell="${cellId}"]`).each(function(){
            if ($(this).attr('id') !== $scene.attr('id')){
                $(this).find('.scene-details').collapse('hide');
            }
        });

        $scene.attr('oldx-start', $scene.css('grid-column-start'));
        $scene.attr('oldy-start', $scene.css('grid-row-start'));
        $scene.attr('oldx-end', $scene.css('grid-column-end'));
        $scene.attr('oldy-end', $scene.css('grid-row-end'));
        $scene.attr('oldmargin', $scene.css('margin'));
        if ($scene.find('.scene-display').hasClass('m-1')){
            $scene.attr('old-inner-margin', 'true');
        } else {
            $scene.find('.scene-display').addClass('m-1');
            $scene.attr('old-inner-margin', 'false');
        }


        $scene.attr('oldz', $scene.css('z-index'));
        let rows = xAxisType==='location'?1:$('#cellsPerSlot').val();
        let cols = xAxisType==='location'?$('#cellsPerSlot').val():1;
        $scene
            .attr('expanded', 'true')
            .css('grid-row-start', $cell.css('grid-row-start'))
            .css('grid-column-start', $cell.css('grid-column-start'))
            .css('z-index', Number($scene.css('z-index')) + 1)
            .css('margin', 0)
            .addClass('p-1');
        if (xAxisType ==='location'){
            $scene.css('grid-column-end', $cell.css('grid-column-end'));

        } else {
            $scene.css('grid-row-end', $cell.css('grid-row-end'));

        }
    }
}

function restoreScene($scene){
    const cellId = $scene.attr('cell');
    const $siblings = $(`.scene-item[cell="${cellId}"]`);
    if ($scene.attr('expanded') !== 'true'){
        return;
    }
    if ($siblings.length > 1){
        $scene
            .attr('expanded', 'false')
            .css('grid-row-start', $scene.attr('oldy-start'))
            .css('grid-column-start',  $scene.attr('oldx-start'))
            .css('grid-row-end', $scene.attr('oldy-end'))
            .css('grid-column-end',  $scene.attr('oldx-end'))
            .css('z-index',  $scene.attr('oldz'))
            .css('margin',  $scene.attr('oldmargin'))

            .removeClass('p-1');
        if ($scene.attr('old-inner-margin') === 'false'){
            $scene.find('.scene-display').removeClass('m-1');
        }
    }
}

async function updateSceneDetails($scene){
    const sceneId = $scene.data('scene-id');
    const result = await fetch(`/scene/${sceneId}?api=true`);
    const data = await result.json();
    data.scheduleType = $('#scheduleType').val();
    data.userType = $('#userType').val();
    data.allowedEdit = $('#allowedEdit').val() === 'true';
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
            $scene.find('.unschedule-scene-btn').confirmation().on('click', unscheduleSceneBtn);
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
        if ($scene.attr('expanded-player') === 'true'){
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
        scrollTop:  $container.scrollTop() + ($('#schedule-alert').position().top - $container.position().top) - 72
    }, 100);
}

function hideMessages(){
    hideAlertMessage();
    hideSuccessMessage();
}
function hideAlertMessage(){
    $('#schedule-alert').removeClass('show');
    $('#schedule-alert').hide();
}
function hideSuccessMessage(){
    $('#schedule-success').removeClass('show');
    $('#schedule-success').hide();
}

function showSuccess(message){
    $('#schedule-success').find('.alert-text').html(message);
    $('#schedule-success').show();
    $('#schedule-success').addClass('show');
    const $container= $('#top-panel');
    $container.animate({
        scrollTop:  $container.scrollTop() + ($('#schedule-success').position().top - $container.position().top - 72)
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
            scrollTop:  $container.scrollTop() + ($cell.position().top - $container.position().top) - 72,
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
                scrollTop:  $container.scrollTop() + ($header.position().top - $container.position().top) - (50+72)

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

function highlightOpenScenesToggle(){
    highlightOpenScenes($(this).is(':checked'));
}

async function highlightUserSchedule(userId){
    $('.busy-item').remove();

    if (!userId){
        $('.scene-item').removeClass('disabled-user');
        $('.scene-item').removeClass('highlighed-user');
        $('.scene-placeholder').removeClass('disabled-user');
    } else {
        const eventId = $('#eventId').val();

        let url = `/event/${eventId}/user/${userId}/schedule`;
        if ($('#scheduleType').val()==='edit'){
            url += '?unconfirmed=true';
        }
        const result = await fetch(url);
        const data = await result.json();
        $('.scene-item').addClass('disabled-user');
        $('.scene-item').removeClass('highlighed-user');
        $('.scene-placeholder').addClass('disabled');
        $('.scene-placeholder').addClass('disabled-user');

        if (data.success){
            for (const timeslot of data.schedule){

                for (const scene of timeslot.scenes){
                    $(`.scene-item[data-scene-id=${scene.id}]`).addClass('highlighed-user');
                    $(`.scene-item[data-scene-id=${scene.id}]`).removeClass('disabled-user');
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
    updateHighlights();
}

function highlightOpenScenes(show){

    if (!show){
        $('.scene-item').removeClass('disabled-open');
        $('.scene-item').removeClass('highlighed-open');
        $('.scene-placeholder').removeClass('disabled-open');
        $('.busy-item').removeClass('disabled');
    } else {
        $('.scene-item').addClass('disabled-open');
        $('.scene-item').removeClass('highlighed-open');
        $('.scene-placeholder').addClass('disabled');
        $('.busy-item').addClass('disabled');
        $('.scene-placeholder').addClass('disabled-open');
        $('.busy-item').addClass('disabled-open');
        $('.scene-item[data-open="true"]').each(function(){
            $(this).removeClass('disabled-open');
            $(this).addClass('highlighed-open');
            $(this).find('.scene-name').addClass('fw-bold');
        });
    }
    updateHighlights();
}

function updateHighlights(){

    $('.scene-item').each(function(){
        if ($(this).hasClass('highlighed-open') && !$(this).hasClass('disabled-user') ||
            $(this).hasClass('highlighed-user') && !$(this).hasClass('disabled-open')){
            $(this).removeClass('disabled');
            $(this).find('.scene-name').addClass('fw-bold');

        } else if ($(this).hasClass('disabled-open') || $(this).hasClass('disabled-user')){
            $(this).addClass('disabled');
            $(this).find('.scene-name').removeClass('fw-bold');
        } else {
            $(this).removeClass('disabled');
            $(this).find('.scene-name').removeClass('fw-bold');
        }
    });
    $('.scene-placeholder').each(function(){
        if ($(this).hasClass('disabled-open') || $(this).hasClass('disabled-user')){
            return;
        }
        $(this).removeClass('disabled');
    });
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
