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
        })
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

        })
    });

    $('.scene-user').find('.scene-status-select').on('change', updateSceneUser);
    $('.scene-source').find('.scene-status-select').on('change', updateSceneSource);

    $('#locations-button-combat').on('click', requestCombatLocations);
    $('#locations-button-non-combat').on('click', requestNonComLocations);
    $('#locations-button-clear').on('click',clearLocations);

    $('#timeslots-button-all').on('click', requestAllTimeslots);
    $('#timeslots-button-no-meals').on('click', requestNoMealTimeslots);
    $('#timeslots-button-clear').on('click', clearTimeslots);

    $('#scene-user-new').hide();
    $('#scene-source-new').hide();
    $('.add-user-btn').on('click', addSceneUser);
    $('#add-source-btn').on('click', addSceneSource);
    $('#scene_player_name').on('input', updatePlayerNameBadge).trigger('input');
    $('#scene_display_to_pc').on('change', updateDisplayToPc).trigger('change');
});

function updatePlayerNameBadge(){
    if ($(this).val() !== ''){
        $('#player-facing-name').show();
    } else {
        $('#player-facing-name').hide();
    }
}

function updateDisplayToPc(){
    if ($(this).prop('checked')){
        $('#display-to-players').show();
    } else {
        $('#display-to-players').hide();
    }

}
function requestCombatLocations(e){
    e.preventDefault();
    $(this).tooltip('hide');
    $('.location-input').each(function(elem){
        const $this = $(this);
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
    const $userPicker = $container.find('.scene-user-picker')
    const user = $userPicker.find("option:selected").data("user");
    const type = $userPicker.find("option:selected").data("type");
    if (!user) { return; }
    if ($(`#scene-user-${user.id}`).length){
        return;
    }
    const $new = $('#scene-user-new').clone();
    $new.attr('id', `scene-user-${user.id}`);
    $new.find('.user-name').text(user.name);
    $new.find('.user-type').text(type);
    if (user.type === 'player'){
        $new.find('.user-type').hide();
    } else {
        $new.find('.user-type').show();
    }
    $new.find('.form-select').each(function(e) {
        const $input = $(this);
        $input.attr('name', `scene[users][${user.id}]`);
        $input.attr('id', `scene-users-${user.type}-${user.id}`);
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
                return $select.data('placeholder');
            }
            return $(data.element).data('text');
        },
        width:'resolve',
        dropdownParent: $container.closest('form')
    });

    $new.find('.scene-status-select').on('change', updateSceneUser);
    $new.appendTo($container.find('.scene-user-list'))
    $new.show();
    $userPicker.val(null).trigger('change');
}

function updateSceneUser(){
    const $container = $(this).closest('.scene-user-picker-container')
    if ($(this).val() === 'none'){
        $(this).closest('.scene-user').remove();
    }
}

function addSceneSource(e){
    e.preventDefault();
    const $sourcePicker = $('#scene-source-picker')
    const source = $sourcePicker.find("option:selected").data("source");
    const type = $sourcePicker.find("option:selected").data("type");
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
        dropdownParent: $(this).closest('form')
    });
    $new.find('.scene-status-select').on('change', updateSceneSource);
    $new.appendTo($('#scene-source-list'))
    $new.show();
    $sourcePicker.val(null).trigger('change');
}

function updateSceneSource(e){
    if ($(this).val() === 'none'){
        $(this).closest('.scene-source').remove();
    }
}


