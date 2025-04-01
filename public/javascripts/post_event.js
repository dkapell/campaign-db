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
    const $form = $field.closest('form');
    $field.find('input').on('change', function(){
        startSaveForm($form);
    });

    $field.find('textarea').on('input', function() {
        startSaveForm($form);
    });

    $field.find('select').on('change', function() {
        startSaveForm($form);
    });
}

function startSaveForm($form){
    if (!dataPending){
        $('#saved-indicator').hide();
        $('#saving-indicator').hide();
        $('#error-indicator').hide();
        $('#save-pending-indicator').show();
    }
    clearTimeout(saveTimeoutId);
    saveTimeoutId = setTimeout(function(){
        saveForm($form);
    }, 1000);
}

async function saveForm($form){
    dataSaving = true;
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

        $('#saved-indicator').show();
        $('#saving-indicator').hide();
    } else {
        $('#error-indicator').show();
        $('#saving-indicator').hide();
    }

    dataPending = false;
    dataSaving = false;

}
