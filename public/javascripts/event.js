/* globals DateRangePicker Datepicker */
let nextEventAddonIndex = 0;

$(function(){

    $('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve'
    });

    const event_date_elem = document.getElementById('event_dates');
    if (typeof DateRangePicker !== 'undefined'){
        const rangepicker = new DateRangePicker(event_date_elem, {
            inputs: [document.getElementById('event_start_date'), document.getElementById('event_end_date')],
            buttonClass: 'btn',
            format: 'yyyy-mm-dd',
            clearButton: true
        });
    }

    const post_event_deadline_elem = document.getElementById('event_post_event_survey_deadline_date');
    if ( typeof Datepicker !== 'undefined'){
        const datePicker = new Datepicker(post_event_deadline_elem, {
            buttonClass: 'btn',
            format: 'yyyy-mm-dd'
        });
    }

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

    $('#event-unregister-btn').confirmation({
        title: 'Unregister from this event?'
    }).on('click', deleteAttendance);
    $('#event-clear-not-attending-btn').confirmation({
        title: 'Clear your Non-Attending status for this event?'
    }).on('click', deleteAttendance);


    $('#attendee-export-btn').on('click', exportAttendeeCsv);
    $('#not-attending-btn-show').confirmation({
        title: 'Mark that you are not attending this event?'
    }).on('click', markNotAttending);
    $('#not-attending-btn-form').on('click', markNotAttending);

    prepEventAddons();

    $('.event-checkin-btn').on('click', eventCheckin);
    $('.event-uncheckin-btn').confirmation({
        title:'Uncheck in from this event?'
    }).on('click', eventCheckin);

    $('#grantEventCPBtn').on('click', assignEventCP);

    //$('.data-table tbody').on('click', '.img-display-btn', showImage);
    $('.img-display-btn').on('click', showImage);
});

function prepEventAddons(){
    $('#event_addon-new').hide();
    $('.add-event_addon-btn').on('click', addEventAddon);
    $('.remove-event_addon-btn').confirmation({
        title: 'Delete this Addon'
    }).on('click', removeEventAddon);
}

function removeEventAddon(e){
    const $this = $(this);
    e.preventDefault();
    e.stopPropagation();
    $this.closest('.event_addon-row').remove();
}

function addEventAddon(e){
    const $this = $(this);
    e.preventDefault();

    const $new = $('#event_addon-new').clone();
    const id = nextEventAddonIndex++;
    $new.attr('id', `event_addon-new-${id}`);

    // Update all provides fields
    $new.find('.event_addon-input').each(function(e) {
        const $input = $(this);
        const fieldtype = $input.data('fieldtype');
        $input.attr('id', `event_addon-new-${id}-${fieldtype}`);
        $input.attr('name', `event[addons][new-${id}][${fieldtype}]`);
        if ($input.data('required')){
            $input.attr('required', true);
        }
    });

    $new.find('.event_addon-label').each(function(e) {
        const $label = $(this);
        const fieldtype = $label.data('fieldtype');
        $label.attr('for', `event_addon-new-${id}-${fieldtype}`);

    });

    $new.find('.remove-event_addon-btn').confirmation({
        title: 'Delete this Addon'
    }).on('click', removeEventAddon);

    $new.appendTo('#event_addons-list');
    $new.show();

}

function exportAttendeeCsv(e){
    e.preventDefault();
    const url = $(this).data('export');
    window.open(url, '_self');
    $(this).blur();
}

async function deleteAttendance(e){
    e.preventDefault();
    e.stopPropagation();

    const $this = $(this);
    $this.tooltip('hide');
    const url = $this.attr('url');

    const csrfToken = $this.data('csrf');
    const result = await fetch(url, {
        method:'DELETE',
        headers: {
            'CSRF-Token': csrfToken
        },
        redirect:'manual'
    });

    if($this.attr('data-back')){
        location = $this.attr('data-back');
    } else {
        location.reload();
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

async function eventCheckin(e){
    e.preventDefault();
    e.stopPropagation();
    const $this = $(this);
    const csrfToken = $this.data('csrf');
    const url = $this.data('url');
    const result = await fetch(url, {
        headers: {
            'CSRF-Token': csrfToken,
            'Content-Type': 'application/json'
        },
        method:'POST',
        redirect:'manual',
    });
    const data = await result.json();
    if (data.checked_in){
        $this.hide();
        $this.closest('td').find('.event-uncheckin-btn').show();

    } else {
        $this.hide();
        $this.closest('td').find('.event-checkin-btn').show();

    }
}

async function assignEventCP(e){
    e.preventDefault();
    e.stopPropagation();

    const $this = $(this);
    $this.find('.recalc-icon').removeClass('fa-wizard-hat').addClass('fa-sync').addClass('fa-spin');

    const csrfToken = $this.data('csrf');
    const url = $this.data('url');
    const result = await fetch(url, {
        method:'PUT',
        headers: {
            'CSRF-Token': csrfToken
        }
    });
    const data = await result.json();
    if (data.success){
        location.reload();
    } else {
        $this.find('.recalc-icon').removeClass('fa-spin').removeClass('fa-sync').addClass('fa-exclamation-triangle');
    }
}

function showImage(e){
    e.preventDefault();
    e.stopPropagation();
    const $this = $(this);
    const imageUrl = $this.data('imageurl');
    const imageName = $this.data('imagename');

    const $modal = $('#surveyImageModal');

    $modal.find('.modal-title').text(imageName);
    $modal.find('.modal-body').find('.image-container').attr('src', imageUrl);
    $modal.modal('show');

    $modal.on('hidden.bs.modal', function(e){
        $modal.modal('dispose');
    });
}
