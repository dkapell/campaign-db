/* global uploadImage sceneListTemplate editFeedbackTemplate newFeedbackTemplate*/

let dataPending = false;
let dataSaving = false;
let saveTimeoutId = null;

let eventList = [];
$(function(){
    $('.custom-event-field').each(watchField);
    $('#postEventSubmitBtn').confirmation({});
    $('#postEventAddendumSubmitBtn').confirmation({});
    $('#postEventHideBtn').confirmation({});
    $('[data-bs-toggle="tooltip"]').tooltip({delay: { 'show': 500, 'hide': 100 }});

    $('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve'
    });
    $('#postEventSubmitBtn').on('click', submitPostEventSurvey);
    $('#postEventAddendumSubmitBtn').on('click', submitPostEventAddendum);
    $('#postEventHideBtn').on('click', hidePostEventSurvey);
    $('#postEventUnhideBtn').on('click', unhidePostEventSurvey);
    $('#postEventSurveyForm').on('submit', submitPostEventSurveyForm);
    $('#postEventAddendumForm').on('submit', submitPostEventSurveyForm);

    $('.survey-dropdown-clear-btn').on('click', clearSurveyDropdown);
    if ($('.sceneList').length){ loadSchedule();}
    $('#surveyModal').find('.save-btn').on('click', submitFeedbackModal);
});

async function clearSurveyDropdown(e){
    e.preventDefault();
    $(this).closest('.input-group').find('select').val(null).trigger('change');
}

function watchField(){
    const $field = $(this);
    const $form = $field.closest('form');
    $field.find('input').on('change', function(){
        startSaveForm($form);
    });

    $field.find('textarea').on('input', function() {
        startSaveForm($form, $field);
    });

    $field.find('select').on('change', function() {
        startSaveForm($form);
    });
}

function startSaveForm($form, $element){
    if (!dataPending){
        if ($element){
            $element.find('.saved-indicator').hide();
            $element.find('.saving-indicator').hide();
            $element.find('.error-indicator').hide();
            $element.find('.save-pending-indicator').show();
        }

        $('#saved-indicator').hide();
        $('#saving-indicator').hide();
        $('#error-indicator').hide();
        $('#save-pending-indicator').show();
    }
    clearTimeout(saveTimeoutId);
    saveTimeoutId = setTimeout(function(){
        saveForm($form, $element);
    }, 1000);
}


async function saveForm($form, $element){
    dataSaving = true;
    if ($element){
        $element.find('.saved-indicator').hide();
        $element.find('.saving-indicator').show();
        $element.find('.save-pending-indicator').hide();
    }
    $('#saving-indicator').show();
    $('#saved-indicator').hide();
    $('#save-pending-indicator').hide();
    dataPending = false;

    const data = new URLSearchParams();
    for (const pair of new FormData($form[0])) {
        data.append(pair[0], pair[1]);
    }
    const url = $form.data('apiurl');

    const request = await fetch(url,{method:$form[0].method, body: data});
    const result = await request.json();
    if (result.success){
        if ($element){
            $element.find('.saved-indicator').show();
            $element.find('.saving-indicator').hide();
        }

        $('#saved-indicator').show();
        $('#saving-indicator').hide();
    } else {
        if ($element){
            $element.find('.error-indicator').hide();
            $element.find('.saving-indicator').hide();
        }

        $('#error-indicator').show();
        $('#saving-indicator').hide();
    }

    dataPending = false;
    dataSaving = false;
}

function hidePostEventSurvey(e){
    e.preventDefault();
    const $form = $('#postEventSurveyForm');
    $form.find('#submit-action').val('hide');
    $form.submit();
}

function unhidePostEventSurvey(e){
    e.preventDefault();
    const $form = $('#postEventSurveyForm');
    $form.find('#submit-action').val('unhide');
    $form.submit();
}

function submitPostEventSurvey(e){
    e.preventDefault();
    const $form = $('#postEventSurveyForm');
    $form.find('#submit-action').val('submit');
    $form.submit();
}

function submitPostEventAddendum(e){
    e.preventDefault();
    const $form = $('#postEventAddendumForm');
    $form.find('#submit-action').val('submit');
    $form.submit();
}


async function submitPostEventSurveyForm(e){
    e.preventDefault();
    const $form = $(this);
    const submitAction = $form.find('#submit-action').val();
    if (submitAction === 'submit'){
        $form.find('.submit-icon-submit').removeClass('fa-share-square').addClass('fa-sync').addClass('fa-spin');
    } else if (submitAction === 'hide'){
        $form.find('.submit-icon-hide').removeClass('fa-eye').addClass('fa-sync').addClass('fa-spin');
    } else if (submitAction === 'unhide'){
        $form.find('.submit-icon-unhide').removeClass('fa-eye-slash').addClass('fa-sync').addClass('fa-spin');
    } else {
        $form.find('.submit-icon-save').removeClass('fa-save').addClass('fa-sync').addClass('fa-spin');
    }
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
        const uploaded = await uploadImage(file, $(row));
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

async function loadSchedule(){
    const eventId = $('#eventId').val();
    const attendanceId = $('#attendanceId').val();

    const scheduleResult = await fetch(`/event/${eventId}/post_event/${attendanceId}/schedule`);
    const data = await scheduleResult.json();
    data.disabled = $('.sceneList').attr('disabled');

    $('.sceneList').html(sceneListTemplate(data));
    $('.sceneListLoading').hide();
    $('.sceneList').show();
    $('.feedback-edit').on('click', showSceneFeedback);
    $('.feedback-remove').confirmation({title: 'Remove from List?'}).on('click', removeSceneFeedback);
    $('.feedback-add').on('click', addSceneFeedback);
    $('.sceneList').find('[data-bs-toggle="tooltip"]').tooltip({delay: { 'show': 500, 'hide': 100 }});
    $('.sceneList').find('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width: $( this ).data( 'width' ) ? $( this ).data( 'width' ) : $( this ).hasClass( 'w-100' ) ? '100%' : 'style'
    });
}

async function removeSceneFeedback(e){
    e.preventDefault();
    e.stopPropagation();

    const eventId = $('#eventId').val();
    const attendanceId = $('#attendanceId').val();
    const sceneId = $(this).data('scene-id');

    const url = `/event/${eventId}/post_event/${attendanceId}/${sceneId}`;

    const data = JSON.stringify({
        _method: 'DELETE',
        _csrf: $('#csrfToken').val(),
    });
    const request = await fetch(url,{
        headers: {
            'Content-Type': 'application/json',
        },
        method:'DELETE',
        body: data
    });
    const result = await request.json();

    if (!result.success){
        console.log(result.error);
    }
    loadSchedule();
}
async function addSceneFeedback(e){
    e.preventDefault();
    e.stopPropagation();

    const eventId = $('#eventId').val();
    const attendanceId = $('#attendanceId').val();
    const sceneId = $(this).closest('.scenePicker').find('.scene-select').val();

    const url = `/event/${eventId}/post_event/${attendanceId}/${sceneId}`;

    const data = JSON.stringify({
        _method: 'POST',
        _csrf: $('#csrfToken').val(),
    });
    const request = await fetch(url,{
        headers: {
            'Content-Type': 'application/json',
        },
        method:'POST',
        body: data
    });
    const result = await request.json();

    if (!result.success){
        console.log(result.error);
    }
    loadSchedule();
}

async function showSceneFeedback(e){
    e.preventDefault();
    e.stopPropagation();
    const $this = $(this);

    const eventId = $('#eventId').val();
    const attendanceId = $('#attendanceId').val();
    const sceneId = $this.data('scene-id');

    const disabled = $(this).data('disabled');
    $this.find('.feedback-icon').removeClass('fa-edit').addClass('fa-sync').addClass('fa-spin');

    const result = await fetch(`/event/${eventId}/post_event/${attendanceId}/${sceneId}`);
    const data = await result.json();

    data.modal = true;
    data.backto = 'modal';
    data.disabled = disabled;
    data.csrfToken = $('#csrfToken').val();
    data.user_type_map =  $this.closest('.sceneList').data('user-type-map');
    data.capitalize = function(string){
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    const $modal = $('#surveyModal');

    if (data.scene.feedback_id){
        $modal.find('.modal-title').text(`Edit Feedback for ${$this.data('scene-name')}`);
        $modal.find('.modal-body').html(editFeedbackTemplate(data));
    } else {
        $modal.find('.modal-title').text(`Provide Feedback for ${$this.data('scene-name')}`);
        $modal.find('.modal-body').html(newFeedbackTemplate(data));
    }

    $modal.find('.custom-event-field').each(watchField);

    $modal.find('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve',
        dropdownParent: $modal.find('form'),
    });

    if (data.disabled){
        $modal.find('.save-btn').hide();
    } else {
        $modal.find('.close-btn').hide();
    }
    $modal.modal('show');

    $modal.on('hidden.bs.modal', function(e){
        $modal.modal('dispose');
        $this.find('.feedback-icon').removeClass('fa-sync').addClass('fa-edit').removeClass('fa-spin');
        $modal.find('.save-btn').show();
    });
}


async function submitFeedbackModal(e) {
    e.preventDefault();
    const $modal = $('#surveyModal');
    const form = $modal.find('.modal-body').find('form')[0];
    const data = new URLSearchParams();
    for (const pair of new FormData(form)) {
        data.append(pair[0], pair[1]);
    }

    const request = await fetch(form.action,{method:form.method, body: data});
    const result = await request.json();

    if (!result.success){
        console.log(result.error);
        $modal.modal('hide');
    }

    loadSchedule();
    $modal.modal('hide');
}

