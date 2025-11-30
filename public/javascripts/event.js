/* globals DateRangePicker Datepicker */
let nextEventAddonIndex = 0;
let nextEventCostIndex = 0;

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

    $('body').popover({
        trigger: 'hover',
        selector: '[data-bs-toggle="popover"]'
    });


    $('[data-bs-toggle="tooltip"]').tooltip();

    $('#event-unregister-btn').confirmation({
        title: 'Unregister from this event?'
    }).on('click', deleteAttendance);
    $('#event-clear-not-attending-btn').confirmation({
        title: 'Clear your Non-Attending status for this event?'
    }).on('click', deleteAttendance);


    $('.event-export-btn').on('click', exportCsvBtn);
    $('#not-attending-btn-show').confirmation({
        title: 'Mark that you are not attending this event?'
    }).on('click', markNotAttending);
    $('#not-attending-btn-form').on('click', markNotAttending);

    prepEventAddons();
    prepEventCosts();
    $('.checkin-table').on('click', '.event-checkin-btn', eventCheckin);
    $('.checkin-table').on('click', '.event-uncheckin-btn', eventCheckin);
    $('#grantEventCPBtn').on('click', assignEventCP);

    $('.pay-what-you-want-input').on('change', togglePayWhatYouWantFields).trigger('change');
    $('.event-cost-default').on('change', updateEventCostDefault);
    $('#price-options').on('click', showCostOptions);

});


function togglePayWhatYouWantFields(e){
    if ($(this).is(':checked')){
        $(this).closest('.expansion-row').find('.pay-what-you-want-field').show();
        $(this).closest('.expansion-row').find('.pay-what-you-want-minimum').attr('required', true);
    } else {
        $(this).closest('.expansion-row').find('.pay-what-you-want-field').hide();
        $(this).closest('.expansion-row').find('.pay-what-you-want-minimum').attr('required', false);
    }
}

function showCostOptions(e){
    e.preventDefault();
    $(this).tooltip('hide');
    const cost = $('#event_cost').val();
    console.log(cost);
    $('#event_costs_0-cost').val(cost);
    $('#event_costs-0-default').prop('checked', true);
    $('#event_costs-single').remove();

    $('#event_costs-list').removeClass('d-none');
}

function prepEventCosts(){
    $('#event_cost-new').hide();
    $('.add-event_cost-btn').on('click', addEventCost);
    $('.remove-event_cost-btn').confirmation({
        title: 'Delete this Price'
    }).on('click', removeEventCost);
}

function removeEventCost(e){
    const $this = $(this);
    e.preventDefault();
    e.stopPropagation();
    $this.closest('.event_cost-row').remove();
}

function updateEventCostDefault(e){
    const $this = $(this);
    $('.event-cost-default').each(function() {
        if ($(this).attr('id') !== $this.attr('id')){
            $(this).prop('checked', false);
        }
    });
}

function addEventCost(e){
    const $this = $(this);
    e.preventDefault();

    const $new = $('#event_cost-new').clone();
    const id = nextEventCostIndex++;
    $new.attr('id', `event_costs-new-${id}`);

    // Update all provides fields
    $new.find('.event_cost-input').each(function(e) {
        const $input = $(this);
        const fieldtype = $input.data('fieldtype');
        $input.attr('id', `event_costs-new-${id}-${fieldtype}`);
        $input.attr('name', `event[costs][new-${id}][${fieldtype}]`);
        if ($input.data('required')){
            $input.attr('required', true);
        }
    });

    $new.find('.event_cost-label').each(function(e) {
        const $label = $(this);
        const fieldtype = $label.data('fieldtype');
        $label.attr('for', `event_addon-new-${id}-${fieldtype}`);

    });

    $new.find('.remove-event_cost-btn').confirmation({
        title: 'Delete this Addon'
    }).on('click', removeEventCost);

    $new.find('.pay-what-you-want-input').on('change', togglePayWhatYouWantFields).trigger('change');
    $new.find('.event-cost-default').on('change', updateEventCostDefault);
    $new.appendTo('#event_costs-list');
    $new.show();

}

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

    $new.find('.pay-what-you-want-input').on('change', togglePayWhatYouWantFields).trigger('change');

    $new.appendTo('#event_addons-list');
    $new.show();

}

function exportCsvBtn(e){
    e.preventDefault();
    const $this = $(this);
    const url = $this.data('export');
    window.open(url, '_self');
    $this.blur();

    $this.closest('.dropdown').find('.indicator-icon').removeClass('fa-download').addClass('fa-check');
    $this.find('.indicator-icon').removeClass('fa-download').addClass('fa-check');
    setTimeout( () => {
        $this.closest('.dropdown').find('.indicator-icon').removeClass('fa-check').addClass('fa-download');
        $this.find('.indicator-icon').removeClass('fa-check').addClass('fa-download');
    }, 2000);
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
