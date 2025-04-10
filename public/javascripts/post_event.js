/* global uploadImage */

let dataPending = false;
let dataSaving = false;
let saveTimeoutId = null;
$(function(){
    $('.custom-event-field').each(watchField);
    $('#postEventSubmitBtn').confirmation({});
    $('#postEventHideBtn').confirmation({});
    $('[data-bs-toggle="tooltip"]').tooltip();

    $('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve'
    });
    $('#postEventSubmitBtn').on('click', submitPostEventSurvey);
    $('#postEventHideBtn').on('click', hidePostEventSurvey);
    $('#postEventUnhideBtn').on('click', unhidePostEventSurvey);
    $('#postEventSurveyForm').on('submit', submitPostEventSurveyForm);
});

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

async function submitPostEventSurveyForm(e){
    e.preventDefault();
    const $form = $(this);
    $form.find('.submit-icon-save').removeClass('fa-save').addClass('fa-sync').addClass('fa-spin');
    $form.find('.submit-icon-submit').removeClass('fa-share-square').addClass('fa-sync').addClass('fa-spin');
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
