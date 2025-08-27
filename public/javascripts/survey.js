/* globals sceneListTemplate */
let nextSurveyFieldIndex = 0;
$(function(){
    $('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve'
    });

    prepSurveyFields();

    $('#survey-preview-as').on('change', updateSurveyFieldVisibility);
    updateSurveyFieldVisibility();
    if ($('.sceneList').length){ loadFakeSchedule();}
});

function prepSurveyFields(){
    if (!$('#survey_fields-list').length){
        return;
    }
    $('#survey_field-new').hide();
    $('.add-survey_field-btn').on('click', addSurveyField);

    $('.remove-survey_field-btn').confirmation({
        title: 'Delete this Field'
    }).on('click', removeSurveyField);

    $('.survey_field-row').each(function(idx){
        toggleFieldOptions($(this));
    });
    $('.survey_field-type').on('change', function(){
        toggleFieldOptions($(this).closest('.survey_field-row'));
    });

    $('#survey_fields-list').sortable({
        items: '> .survey_field-row',
        handle: '.handle',
        helper: 'clone',
        zIndex: 9999,
        tolerance: 'pointer',
        axis: 'y',
        stop: function (event, ui) {
            updateNames($(this));
        }
    });

    $('#survey_type').on('change', function(){
        $('.survey_field-row').each(function(idx){
            toggleFieldOptions($(this));
        });
    });

    $('.survey_field-row').on('mouseenter', function(e){
        $(this).addClass('bg-light');
    });
    $('.survey_field-row').on('mouseleave', function(e){
        $(this).removeClass('bg-light');
    });

}

function updateNames($list){
    $list.find('.survey_field-row').each(function (idx) {
        $(this).find('.sort-order').val(idx);
    });
}

function toggleFieldOptions($row){
    const type = $row.find('.survey_field-type').val();
    if ($row.attr('id') === 'survey_field-new'){
        return;
    }
    $row.find('.survey_field-type-options').hide();
    $row.find('.survey_field-required').attr('disabled', false);
    $row.find('.survey_field-on_checkin').attr('disabled', false);
    $row.find('.survey_field-editable_by').attr('disabled', false);
    $row.find('.survey_field-on_checkin').attr('disabled', false);
    $row.find('.add-description-btn').show();
    switch (type){
        case 'longtext':
            $row.find('.textarea-options').show();
            break;
        case 'dropdown':
            $row.find('.dropdown-options').show();
            break;
        case 'text content':
            $row.find('.markdown-options').show();
            $row.find('.survey_field-required').attr('disabled', true);
            $row.find('.survey_field-on_checkin').attr('disabled', true);
            $row.find('.survey_field-editable_by').attr('disabled', true);
            $row.find('.add-description-btn').hide();
            $row.find('.field-description').hide();
            break;
        case 'boolean':
            $row.find('.survey_field-required').attr('disabled', true);
            break;
        case 'scene':
            $row.find('.textarea-options').show();
            break;
    }

    if ($('#survey_type').val() !== 'registration'){
        $row.find('.survey_field-on_checkin').attr('disabled', true);
    }

    const $survey_field_description = $row.find('.field-description').find('textarea');

    if ($survey_field_description.val()){
        $row.find('.field-description').show();
        $row.find('.add-description-btn').hide();
    } else {
        $row.find('.field-description').hide();
    }
    $row.find('.add-description-btn').on('click', function(e){
        e.preventDefault();
        $row.find('.field-description').show();
        $(this).hide();
    });

    $row.find('[data-bs-toggle="tooltip"]').tooltip({delay: { 'show': 200, 'hide': 100 }});
}

function removeSurveyField(e){
    const $this = $(this);
    e.preventDefault();
    e.stopPropagation();
    $this.closest('.survey_field-row').remove();
}

function addSurveyField(e){
    const $this = $(this);
    e.preventDefault();
    const $new = $('#survey_field-new').clone();
    const id = nextSurveyFieldIndex++;
    $new.attr('id', `survey_field-new-${id}`);

    // Update all provides fields
    $new.find('.survey_field-input').each(function(e) {
        const $input = $(this);
        const fieldtype = $input.data('fieldtype');
        $input.attr('id', `survey_field-new-${id}-${fieldtype}`);
        $input.attr('name', `survey[definition][new-${id}][${fieldtype}]`);
        if ($input.data('required')){
            $input.attr('required', true);
        }
    });

    $new.find('.survey_field-label').each(function(e) {
        const $label = $(this);
        const fieldtype = $label.data('fieldtype');
        $label.attr('for', `survey_field-new-${id}-${fieldtype}`);

    });

    $new.find('.remove-survey_field-btn').confirmation({
        title: 'Delete this Field'
    }).on('click', removeSurveyField);

    $new.find('.survey_field-type').on('change', function(){
        toggleFieldOptions($(this).closest('.survey_field-row'));
    });


    toggleFieldOptions($new);
    $new.appendTo('#survey_fields-list');
    $new.show();
    $('#survey_field-footer-row').show();

}

function updateSurveyFieldVisibility(e){
    const type = $('#survey-preview-as').val();
    if (!type) { return; }
    $('.custom-event-field').each(function(){
        const $field = $(this);
        const visible_to = $field.data('visible_to');
        const editable_by = $field.data('editable_by');
        switch (type){
            case 'Player':
                if (visible_to === 'staff'){
                    $field.hide();
                } else {
                    $field.show();
                }
                if (editable_by === 'gm'){
                    $field.find('input').attr('disabled', true);
                    $field.find('select').attr('disabled', true);

                    $field.find('textarea').attr('disabled', true);
                } else {
                    $field.find('input').attr('disabled', false);
                    $field.find('textarea').attr('disabled', false);
                    $field.find('select').attr('disabled', false);
                }
                break;
            case 'Staff':
                if (visible_to === 'player'){
                    $field.hide();
                } else {
                    $field.show();
                }
                if (editable_by === 'gm'){
                    $field.find('input').attr('disabled', true);
                    $field.find('select').attr('disabled', true);
                    $field.find('textarea').attr('disabled', true);
                } else {
                    $field.find('input').attr('disabled', false);
                    $field.find('textarea').attr('disabled', false);
                    $field.find('select').attr('disabled', false);
                }
                break;
            case 'Player (GM View)':
                if (visible_to === 'staff'){
                    $field.hide();
                } else {
                    $field.show();
                }
                $field.find('input').attr('disabled', false);
                $field.find('textarea').attr('disabled', false);
                $field.find('select').attr('disabled', false);
                break;
            case 'Staff (GM View)':
                if (visible_to === 'player'){
                    $field.hide();
                } else {
                    $field.show();
                }
                $field.find('input').attr('disabled', false);
                $field.find('textarea').attr('disabled', false);
                $field.find('select').attr('disabled', false);
                break;
        }
    });
}

async function loadFakeSchedule(){
    const eventId = $('#eventId').val();
    const attendanceId = $('#attendanceId').val();

    const scheduleResult = await fetch(`/event/${eventId}/post_event/${attendanceId}/schedule`);
    const data = {
        scenes: [
            {
                id: 1,
                name: 'Preview Scene One',
                timeslots: [ {name: 'Sat 12pm', display_name: 'Noon'}]
            },
            {
                id: 2,
                name: 'Preview Scene Two',
                timeslots: [ {name: 'Sat 1pm'}]
            }
        ],
        userScenes: [
            {
                id: 3,
                name: 'Preview Scene Three',
                timeslots: [ {name: 'Sat 1pm'}]
            }
        ],
        isPlayer: $('#survey-preview-as').val(),
        preview: true
    };

    $('.sceneList').html(sceneListTemplate(data));
    $('.sceneListLoading').hide();
    $('.sceneList').show();
    $('.feedback-edit').on('click', showSceneFeedback);
    $('.sceneList').find('[data-bs-toggle="tooltip"]').tooltip({delay: { 'show': 500, 'hide': 100 }});
    $('.sceneList').find('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width: $( this ).data( 'width' ) ? $( this ).data( 'width' ) : $( this ).hasClass( 'w-100' ) ? '100%' : 'style'
    });

async function showSceneFeedback(e){
    e.preventDefault();
    e.stopPropagation();
    const $this = $(this);

    const eventId = $('#eventId').val();
    const attendanceId = $('#attendanceId').val();
    const sceneId = $this.data('scene-id');

    const disabled = $(this).data('disabled');
    $this.find('.feedback-icon').removeClass('fa-edit').addClass('fa-sync').addClass('fa-spin');
    const data = {
        attendance: {id:1},
        scene: {
            id: 1,
            gm_feedback: 'Testing',
            npc_feedback: 'Test',
            name: 'Preview Scene Three',
            timeslots: [ {name: 'Sat 1pm'}],
            staff: [ 'Staffer One (NPC One)', 'Staffer Two (NPC Two)', 'Staffer Three (NPC Three)' ],
            writer: 'Staffer One'
        },
        field: $this.closest('.sceneList').data('field')

    }

    data.modal = true;
    data.backto = 'modal';
    data.disabled = disabled;
    data.csrfToken = $('#csrfToken').val();
    const $modal = $('#surveyModal');

    $modal.find('.modal-title').text(`Edit Feedback for ${$this.data('scene-name')}`);
    $modal.find('.modal-body').html(newFeedbackTemplate(data));

    $modal.find('.save-btn').hide();

    $modal.modal('show');

    $modal.on('hidden.bs.modal', function(e){
        $modal.modal('dispose');
        $this.find('.feedback-icon').removeClass('fa-sync').addClass('fa-edit').removeClass('fa-spin');
        $modal.find('.save-btn').show();
    });
}
}
