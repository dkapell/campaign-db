/* globals _ marked */
$(function(){
    $('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 7,
        width:'resolve'
    });
    $('[data-bs-toggle="tooltip"]').tooltip();
    $('.complex-select2').each(function(e){
        const $select = $(this);
        $select.select2({
            theme:'bootstrap-5',
            minimumResultsForSearch: 7,
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

    $('.complex-search-select2').each(function(e){
        const $select = $(this);
        $select.select2({
            theme:'bootstrap-5',
            minimumResultsForSearch: 1,
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
            },
            matcher: function(params, data){
                if ($.trim(params.term) === '') {
                    return data;
                }

                if (typeof data.text === 'undefined') {
                    return null;
                }

                if (_.has(data.element.attributes, 'data-search')){
                    const search = data.element.attributes.getNamedItem('data-search').value;
                    if (search.toUpperCase().indexOf(params.term.toUpperCase()) > -1) {
                        return data;
                    }
                }

                return null;
            }

        });
    });

    $('.scene-user').find('.scene-status-select').on('change', updateSceneUser).trigger('change');
    $('.scene-source').find('.scene-status-select').on('change', updateSceneSource).trigger('change');

    $('.location-select-btn').on('click', requestLocations);
    $('#locations-button-combat').on('click', requestCombatLocations);
    $('#locations-button-non-combat').on('click', requestNonComLocations);
    $('#locations-button-clear').on('click',clearLocations);

    $('#timeslots-button-all').on('click', requestAllTimeslots);
    $('#timeslots-button-no-meals').on('click', requestNoMealTimeslots);
    $('#timeslots-button-daytime').on('click', requestDaytimeTimeslots);
    $('#timeslots-button-nighttime').on('click', requestNighttimeTimeslots);

    $('#timeslots-button-clear').on('click', clearTimeslots);

    $('#staff-require-runner-btn').on('click', addSceneRunnerUser);
    $('#scene-user-new').hide();
    $('#scene-source-new').hide();
    $('#scene-skill-new').hide();
    $('.add-user-btn').on('click', addSceneUser);
    $('#add-source-btn').on('click', addSceneSource);
    $('#add-skill-btn').on('click', addSceneSkill);

    $('#scene_player_name').on('input', updateBadges);
    $('#scene_description').on('input', updateBadges);
    $('#scene_display_to_pc').on('change', updateBadges);
    updateBadges();

    $('.location-info[data-bs-toggle="popover"]').popover({
        trigger: 'hover',
        delay: { 'show': 300, 'hide': 100 },
        content: function(elem){
            return marked.parseInline(elem.getAttribute('content'), {breaks:true});
        },
        html:true,
        customClass:'scene-info-popover'
    });

});

function updateBadges(){
    if ($('#scene_player_name').val() !== ''){
        $('#has-player-facing-name').show();
    } else {
        $('#has-player-facing-name').hide();
    }

    if ($('#scene_description').val() !== ''){
        $('#has-description-badge').show();
    } else {
        $('#has-description-badge').hide();
    }

    if ($('#scene_display_to_pc').prop('checked')){
        $('#display-to-players').show();
    } else {
        $('#display-to-players').hide();
    }
}

function requestLocations(e){
    e.preventDefault();
    const combat = $(this).data('combat');
    const outdoors = $(this).data('outdoors');
    $(this).tooltip('hide');
    $('.location-input').each(function(elem){
        const $location = $(this);
        if ($(this).data('special')){ return; }
        if (!combat && $location.data('combat')){
            return;
        }
        if (combat && combat !== 'any' && !$location.data('combat')){
            return;
        }

        if (!outdoors && $location.data('outdoors')){
            return;
        }
        if (outdoors && outdoors !== 'any' && !$location.data('outdoors')){
            return;
        }


        const $select = $location.find('select');
        if ($select.val() === 'none'){
            $select.val('requested').trigger('change');
        }
    });

}
function requestCombatLocations(e){
    e.preventDefault();
    $(this).tooltip('hide');
    $('.location-input').each(function(elem){
        const $this = $(this);
        if ($this.data('special')){ return; }
        if (!$this.data('combat')){
            return;
        }

        const $select = $this.find('select');
        if ($select.val() === 'none'){
            $select.val('requested').trigger('change');
        }
    });
}

function requestNonComLocations(e){
    e.preventDefault();
    $(this).tooltip('hide');
    $('.location-input').each(function(elem){
        const $this = $(this);
        if ($this.data('special')){ return; }
        if ($this.data('combat')){
            return;
        }

        const $select = $this.find('select');
        if ($select.val() === 'none'){
            $select.val('requested').trigger('change');
        }
    });
}

function clearLocations(e){
    e.preventDefault();
    $(this).tooltip('hide');
    $('.location-input').each(function(elem){
        const $this = $(this);

        const $select = $this.find('select');
        if ($select.val() === 'requested'){
            $select.val('none').trigger('change');
        }
    });
}


function requestAllTimeslots(e){
    e.preventDefault();
    $(this).tooltip('hide');

    $('.timeslot-input').each(function(elem){
        const $this = $(this);
        if ($this.data('type')=== 'special'){
            return;
        }

        const $select = $this.find('select');
        if ($select.val() === 'none'){
            $select.val('requested').trigger('change');
        }
    });
}

function requestNoMealTimeslots(e){
    e.preventDefault();
    $(this).tooltip('hide');

    $('.timeslot-input').each(function(elem){
        const $this = $(this);
        if ($this.data('type')!== 'regular'){
            return;
        }

        const $select = $this.find('select');
        if ($select.val() === 'none'){
            $select.val('requested').trigger('change');
        }
    });
}

function requestDaytimeTimeslots(e){
    e.preventDefault();
    $(this).tooltip('hide');

    $('.timeslot-input').each(function(elem){
        const $this = $(this);
        if ($this.data('type')!== 'regular'){
            return;
        }
        if ($this.data('nighttime')){
            return;
        }

        const $select = $this.find('select');
        if ($select.val() === 'none'){
            $select.val('requested').trigger('change');
        }
    });
}

function requestNighttimeTimeslots(e){
    e.preventDefault();
    $(this).tooltip('hide');

    $('.timeslot-input').each(function(elem){
        const $this = $(this);
        if ($this.data('type')!== 'regular'){
            return;
        }
        if (!$this.data('nighttime')){
            return;
        }

        const $select = $this.find('select');
        if ($select.val() === 'none'){
            $select.val('requested').trigger('change');
        }
    });
}

function clearTimeslots(e){
    e.preventDefault();
    $(this).tooltip('hide');

    $('.timeslot-input').each(function(elem){
        const $this = $(this);

        const $select = $this.find('select');
        if ($select.val() === 'requested'){
            $select.val('none').trigger('change');
        }
    });
}

function addSceneUser(e){
    e.preventDefault();
    const $container = $(this).closest('.scene-user-picker-container');
    const $userPicker = $container.find('.scene-user-picker');
    const user = $userPicker.find('option:selected').data('user');
    const type = $userPicker.find('option:selected').data('type');
    if (!user) { return; }
    if ($(`#scene-user-${user.id}`).length){
        return;
    }
    addSceneUserRow($container, user, type);
    $userPicker.val(null).trigger('change');
}

function addSceneRunnerUser(e){
    e.preventDefault();
    const $container = $(this).closest('.scene-user-picker-container');
    const $userPicker = $container.find('.scene-user-picker');
    const userId = $('#scene-scene_runner_id').val();

    const user = $userPicker.find(`option[value="${userId}"]`).data('user');
    const type = $userPicker.find(`option[value="${userId}"]`).data('type');
    if (!user) { return; }
    if ($(`#scene-user-${user.id}`).length){
        return;
    }
    addSceneUserRow($container, user, type, 'required');
}

function addSceneUserRow($container, user, type, value){
    const $new = $('#scene-user-new').clone();
    $new.attr('id', `scene-user-${user.id}`);
    $new.find('.user-name').text(user.name);
    $new.find('.user-type').text(type);
    if (user.type === 'player'){
        $new.find('.user-type').hide();
    } else {
        $new.find('.user-type').show();
    }
    $new.find('.scene-status-select').each(function(e) {
        const $input = $(this);
        $input.attr('name', `scene[users][${user.id}][request_status]`);
        $input.attr('id', `scene-users-${user.type}-${user.id}-request-status`);
        if (value){
            $input.val(value);
        }
    });

    $new.find('.scene-details-input').each(function(e) {
        const $input = $(this);
        $input.attr('name', `scene[users][${user.id}][scene_details][npc]`);
        $input.attr('id', `scene-users-${user.type}-${user.id}-details-npc`);
    });

    $new.find('.scene-status-select').select2({
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
                return $(data.element).data('placeholder');
            }
            return $(data.element).data('text');
        },
        dropdownParent: $container.closest('form')
    });

    $new.appendTo($container.find('.scene-user-list'));
    $new.find('.scene-status-select').on('change', updateSceneUser).trigger('change');
    $new.show();
}


function updateSceneUser(){
    const $container = $(this).closest('.scene-user-picker-container');
    if ($(this).val() === 'none'){
        $(this).closest('.scene-user').remove();
    } else if ($(this).val() === 'rejected'){
        $(this).closest('.scene-user').find('.details-row').hide();
    } else if ( $(this).closest('ul').attr('id') === 'scene-player-list'){
        $(this).closest('.scene-user').find('.details-row').hide();
    } else {
        $(this).closest('.scene-user').find('.details-row').show();
    }

}

function addSceneSource(e){
    e.preventDefault();
    const $sourcePicker = $('#scene-source-picker');
    const source = $sourcePicker.find('option:selected').data('source');
    const type = $sourcePicker.find('option:selected').data('type');
    if (!source) { return; }
    if ($(`#scene-source-${source.id}`).length){
        return;
    }
    const $new = $('#scene-source-new').clone();
    $new.attr('id', `scene-source-${source.id}`);
    $new.find('.source-name').text(source.name);
    $new.find('.source-type').text(type);

    $new.find('.form-select').each(function(e) {
        const $input = $(this);
        $input.attr('name', `scene[sources][${source.id}]`);
        $input.attr('id', `scene-sources-${source.id}`);
    });
    $new.find('.scene-status-select').select2({
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
                return $(data.element).data('placeholder');
            }
            return $(data.element).data('text');
        },
        dropdownParent: $('#scene-source-list').closest('form')
    });
    $new.find('.scene-status-select').on('change', updateSceneSource);
    $new.appendTo($('#scene-source-list'));
    $new.show();
    $sourcePicker.val(null).trigger('change');
}

function updateSceneSource(e){
    if ($(this).val() === 'none'){
        $(this).closest('.scene-source').remove();
    }
}

function addSceneSkill(e){
    e.preventDefault();
    const $skillPicker = $('#scene-skill-picker');
    const skill = $skillPicker.find('option:selected').data('skill');
    const source = $skillPicker.find('option:selected').data('source');
    if (!skill) { return; }
    if ($(`#scene-skill-${skill.id}`).length){
        return;
    }
    const $new = $('#scene-skill-new').clone();
    $new.attr('id', `scene-skill-${skill.id}`);
    $new.find('.skill-name').text(skill.name);
    $new.find('.skill-source').text(source);

    $new.find('.form-select').each(function(e) {
        const $input = $(this);
        $input.attr('name', `scene[skills][${skill.id}]`);
        $input.attr('id', `scene-skills-${skill.id}`);
    });
    $new.find('.scene-status-select').select2({
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
                return $(data.element).data('placeholder');
            }
            return $(data.element).data('text');
        },
        dropdownParent: $('#scene-source-list').closest('form')
    });
    $new.find('.scene-status-select').on('change', updateSceneSkill);
    $new.appendTo($('#scene-source-list'));
    $new.show();
    $skillPicker.val(null).trigger('change');
}

function updateSceneSkill(e){
    if ($(this).val() === 'none'){
        $(this).closest('.scene-skill').remove();
    }
}



