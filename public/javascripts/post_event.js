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
});

function watchField(){
    $field = $(this);

    $field.find('input').on('change', function(){
        startSaveForm();
    });

    $field.find('textarea').on('input', function() {
        startSaveForm();
    });

    $field.find('select').on('change', function() {
        startSaveForm();
    });
}


function startSaveForm(){
    if (!dataPending){
        $('#saved-indicator').hide();
        $('#saving-indicator').hide();
        $('#error-indicator').hide();
        $('#save-pending-indicator').show();
    }
    clearTimeout(saveTimeoutId);
    saveTimeoutId = setTimeout(saveForm, 1000);
}

async function saveForm(){
    dataSaving = true;
    $('#saving-indicator').show();
    $('#saved-indicator').hide();
    $('#save-pending-indicator').hide();
    dataPending = false;
    const $form = $('#postEventSurveyForm');
    const data = new URLSearchParams();
    for (const pair of new FormData($form[0])) {
        data.append(pair[0], pair[1]);
    }
    const url = $form.data('apiurl');

    const request = await fetch(url,{method:$form[0].method, body: data});
    const result = await request.json();
    if (result.success){

        $('#saved-indicator').show();
        $('#saving-indicator').hide();
    } else {
        $('#error-indicator').show();
        $('#saving-indicator').hide();
    }

    dataPending = false;
    dataSaving = false;

}
