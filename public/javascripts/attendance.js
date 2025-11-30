/* global uploadImage eventpriceTemplate*/
$(function(){

    $('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve'
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

    $('[data-bs-toggle="popover"]').popover({
        trigger: 'hover'
    });
    $('[data-bs-toggle="tooltip"]').tooltip();

    $('#attendance_user_id').on('change', updateSelectedAttendee).trigger('change');

    $('#not-attending-btn-form').on('click', markNotAttending);

    $('#attendanceForm').on('submit', submitAttendanceForm);
    $('.survey-dropdown-clear-btn').on('click', clearSurveyDropdown);
    updateCustomFieldVisibility();
    $('#pricing-select').on('change', updateEventPriceDisplay).trigger('change');
});

function updateEventPriceDisplay(e){

    const data = {
        costName: $(this).val(),
        eventCost: $(this).find(':selected').data('cost'),
        attendance: $('#eventPrice').data('attendance'),
    };
    $('#eventPrice').html(eventpriceTemplate(data));
}

async function clearSurveyDropdown(e){
    e.preventDefault();
    $(this).closest('.input-group').find('select').val(null).trigger('change');
}

function updateSelectedAttendee(e){
    const $this = $(this);
    const userId = $this.val();
    updateCharacterPicker(userId);
    if ($(this).find(':selected').data('type') === 'player'){
        $('#eventCost').show();
    } else {
        $('#eventCost').hide();
    }
}

async function updateCharacterPicker(userId){
    const result = await fetch(`/user/${userId}/characters`);
    const data = await result.json();

    const characters = data.characters.map( character => {

        return {
            id: character.id,
            text: character.active?`${character.name} <span class="badge text-bg-success ms-1">Active</badge>`:character.name,
            selected: character.active,
            html: character.active?`${character.name} <span class="badge text-bg-success ms-1">Active</badge>`:character.name
        };
    });

    $('#attendance_character_id').empty().select2({
        data: characters,
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve',
        templateResult: function(data) {
            return data.html;
        },
        templateSelection: function(data) {
            return data.text;
        },
        escapeMarkup: function(markup) {
            return markup;
        },

    }).trigger('change');

    if (data.user.type === 'player'){
        $('#characterPicker').show();
    } else {
        $('#characterPicker').hide();
    }
    updateCustomFieldVisibility();
}

function updateCustomFieldVisibility(){
    if (! $('#attendance_user_id').length ){
        return;
    }
    let userType = $('#attendance_user_id option:selected').data('type');
    if (!userType){
        userType = $('#attendance_user_id').val();
    }
    $('.custom-event-field').each( function(){
        const $this = $(this);
        const visibleTo = $this.data('visible_to');
        switch (visibleTo){
            case 'all':
                $this.show();
                setRequired($this, true);

                break;
            case 'player':
                if (userType === 'player'){
                    $this.show();
                    setRequired($this, true);
                } else {
                    $this.hide();
                    setRequired($this, false);
                }
                break;
            case 'staff':
                if (userType === 'player'){
                    $this.hide();
                    setRequired($this, false);

                } else {
                    $this.show();
                    setRequired($this, true);
                }
                break;
        }
    });
    $('.addon-row').each( function(){
        const $this = $(this);
        if (userType === 'player'){
            if ($this.data('available_to_player')){
                $this.show();
                if ($this.data('charge_player')){
                    $this.find('.paid-cost').show();
                    $this.find('.paid-badge').show();
                } else {
                    $this.find('.paid-cost').hide();
                    $this.find('.paid-badge').hide();
                }
            } else {
                $this.hide();
            }
        } else {
            if ($this.data('available_to_staff')){
                $this.show();
                if ($this.data('charge_staff')){
                    $this.find('.paid-cost').show();
                    $this.find('.paid-badge').show();
                } else {
                    $this.find('.paid-cost').hide();
                    $this.find('.paid-badge').hide();
                }
            } else {
                $this.hide();
            }
        }

    });

    $('.addon-row:visible').each(function(index) {
        if(index == 0){
            $(this).css('border-top-left-radius', 'inherit');
            $(this).css('border-top-right-radius', 'inherit');
            $(this).css('border-top-width', '1px');
        }
        if(index == $('.addon-row:visible').length - 1){
            $(this).css('border-bottom-left-radius', 'inherit');
            $(this).css('border-bottom-right-radius', 'inherit');
            $(this).css('border-bottom-width', '1px');
        }
    });
}

function setRequired($div, required){
    if (!required){
        for (const type of ['input', 'textarea', 'select']){
            const $input = $div.find(type);
            if ($input && $input.attr('required')){
                $input.attr('required', false);
            }
        }
    } else {
        for (const type of ['input', 'textarea', 'select']){
            const $input = $div.find(type);
            if ($input && $input.data('isrequired')){
                $input.attr('required', true);
            }
        }
    }

}

async function markNotAttending(e){
    e.preventDefault();
    e.stopPropagation();
    const $this = $(this);
    $this.tooltip('hide');
    const url = $this.attr('url');
    const csrfToken = $this.data('csrf');

    const data = {
        attendance:{}
    };

    if ($('#attendance_user_id').length){
        data.attendance.user_id = Number($('#attendance_user_id').val());
    }

    const result = await fetch(url, {
        method:'POST',
        headers: {
            'CSRF-Token': csrfToken,
            'Content-Type': 'application/json'
        },
        redirect:'manual',
        body: JSON.stringify(data)
    });

    if($this.attr('data-back')){
        location = $this.attr('data-back');
    } else {
        location.reload();
    }
}

async function submitAttendanceForm(e){
    e.preventDefault();
    const $form = $(this);

    $form.find('.submit-icon').removeClass('fa-save').addClass('fa-sync').addClass('fa-spin');
    let images = 0;
    const rows = document.querySelectorAll('.custom-event-field');
    for (const row of rows){
        const imageFilePicker = row.querySelector('.image-file-picker');
        if (!imageFilePicker) { continue; }

        const file = imageFilePicker.files[0];
        if (!file){
            continue;
        }
        images++;
        const uploaded = await uploadImage(file, $(row.querySelector('.image-field-container')));
        if (uploaded) {
            images--;
        }
    }
    if (!images){
        $form.unbind('submit').submit();
        return true;
    }
    return false;
}

