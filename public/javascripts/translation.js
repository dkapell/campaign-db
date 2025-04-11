/* globals _ allText */
$(function(){
    //$('#component_type').on('change', updateComponent);
    $('.render-btn').on('click', renderDocument);
    $('#translation_preview').on('change', updatePreview);
    $('[data-toggle="tooltip"]').tooltip({
        container: 'body',
    });

    $('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve'
    });
});

async function renderDocument(e){
    e.preventDefault();
    e.stopPropagation();

    $(this).find('.action-icon')
        .removeClass('fa-check')
        .removeClass('fa-file-pdf')
        .hide();
    $(this).find('.action-spinner').show();


    const url = $(this).attr('url');
    const csrf = $(this).data('csrf');

    const result = await fetch(url, {
        method:'PUT',
        headers: {
            'csrf-token': csrf
        }
    });

    const data = await result.json();
    $(this).find('.action-spinner').hide();
    if (data.success){
        $(this).find('.action-icon')
            .addClass('fa-check')
            .show();
    } else {
        $(this).find('.action-icon')
            .addClass('fa-times')
            .show();
    }
}

function updatePreview(e){
    let idx = $(this).val();
    if (idx >= allText.length){
        idx = allText.length -1;
        $(this).val(idx);
    }
    const text = allText[idx];
    if (text === '\n'){
        $('#previewPreview').text('Blank');
        $('#previewPreview').addClass('text-muted');
    } else {
        $('#previewPreview').text(text);
        $('#previewPreview').removeClass('text-muted');
    }
}
