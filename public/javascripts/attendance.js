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

    $('#attendance_user_id').on('change', updateCharacterPicker);

    $('#not-attending-btn-form').on('click', markNotAttending);

    $('#attendanceForm').on('submit', submitAttendanceForm);

    $('.clear-image-btn').on('click', clearImage);

    $('.image-file-picker').on('change', updateImage);

    updateCustomFieldVisibility();
});

function updateImage(e){
    const file = ($(this).prop('files'))[0];
    const $row = $(this).closest('.custom-event-field');
    if (file){
        $row.find('.upload-type').html('<strong>Type</strong>: ' + file.type);
        $row.find('.upload-size').html('<strong>Size</strong>: ' + prettyPrintSize(file.size));
        $row.find('.image-details-row').show();

    } else {
        $row.find('.image-details-row').hide();
        $row.find('.upload-type').text('');
        $row.find('.upload-size').text('');
    }
}


async function updateCharacterPicker(e){
    const $this = $(this);
    const userId = $this.val();

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
        const request = await getSignedRequest(file);
        const uploaded = await uploadFile(file, request.signedRequest);
        if (uploaded){
            $(row.querySelector('.image-file-picker')).hide();
            row.querySelector('.image_id-field').value = request.objectId;
            row.querySelector('.image-file-picker').value = null;

            $(row.querySelector('.image-file-name')).text(file.name);
            $(row.querySelector('.image-file-name')).show();
            if (request.postUpload){
                await markFileUploaded(request.postUpload);
            }
            images--;
        }
    }
    if (!images){
        $form.unbind('submit').submit();
        return true;
    }
    return false;
}

async function getSignedRequest(file){
    try{
        const result = await fetch(`/upload/sign-image?filename=${file.name}&filetype=${file.type}`, {credentials: 'include'});
        const response = await result.json();
        if (!response.success){
            $('#upload-feedback').text(response.error);
            return false;
        }
        return response.data;

    } catch (err){
        $('#upload-feedback').text('Error getting signed request');
        console.trace(err);
        return false;
    }
}

async function uploadFile(file, signedRequest){
    try {
        await fetch(signedRequest, {method:'PUT', body: file});
        return true;
    } catch (err){
        $('#upload-feedback').text('Error uploading file');
        console.trace(err);
        return false;
    }
}

async function markFileUploaded(url){
    try {
        await fetch(url, {
            method:'PUT'
        });
        return true;
    } catch (err){
        $('#upload-feedback').text('Error marking file uploaded');
        console.trace(err);
        return false;
    }
}

function clearImage(e){
    e.preventDefault();
    const $row = $(this).closest('.custom-event-field');
    $row.find('.existing-image').hide();
    $row.find('.new-image').show();
    $row.find('.image_id-field').val(null);
}

function prettyPrintSize(value, type) {
    if (!value) {
        return '0';
    }
    if (!type){
        type = 'B';
    }
    var prefixes = [ '', 'K', 'M', 'G', 'T', 'P', 'E' ];
    var index;
    for (index = 0; value >= 1024 && index < prefixes.length - 1; index++)
        value /= 1024;

    if (value > 1024 || Math.round(value) === value)
        value = Math.round(value).toString();
    else if (value < 10)
        value = value.toFixed(2);
    else
        value = value.toPrecision(4);

    value += ' ' + prefixes[index];

    if (index !== 0)
        value += type;

    return value;
}
