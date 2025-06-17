$(function(){
    $('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve'
    });

    $('#font_type').on('change', updateFontFields).trigger('change');
    $('#fontForm').on('submit', submitFontForm);
    $('#fontPicker').on('change', updateFileInfo);
});

function updateFontFields(e){
    const type = $(this).val();
    if (type === 'user'){
        $('.upload-name').show();
        $('.upload-picker').show();
        $('.google-picker').hide();
        $('.user-font-options').show();
    } else {
        $('.upload-input').hide();
        $('#fontPicker').val(null);
        $('.google-picker').show();
        $('.user-font-options').hide();
    }
}

async function submitFontForm(e){
    e.preventDefault();
    const $this = $(this);
    const type = $('#font_type').val();
    const id = $('#font-id').val();
    if (type === 'google' || id){
        $this.unbind('submit').submit();
    }

    const file = ($('#fontPicker').prop('files'))[0];
    if (!file){
        return false;
    }
    const request = await getSignedRequest(file);
    $('#font-id').val(request.objectId);
    $('#fontForm').attr('action', `/admin/font/${request.objectId}`);
    $('#formMethod').val('PUT');

    const uploaded = await uploadFile(file, request.signedRequest);

    if (uploaded){
        $('#image-status').val('ready');
        if (request.postUpload){
            await markFileUploaded(request.postUpload);
        }
        $this.unbind('submit').submit();
        return true;
    } else {
        return false;
    }
}

async function getSignedRequest(file){
    try{
        const result = await fetch(`/admin/font/sign-s3?filename=${file.name}&filetype=${file.type}`, {credentials: 'include'});
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
        $('.upload-feedback').show();
        console.trace(err);
        return false;
    }
}

async function markFileUploaded(data){
    try {
        await fetch(data.url, {
            method:'PUT',
            headers:{
                'CSRF-Token': data.csrf
            }
        });
        return true;
    } catch (err){
        $('#upload-feedback').text('Error marking file uploaded');
        console.trace(err);
        return false;
    }
}

function updateFileInfo(e){
    const file = ($(this).prop('files'))[0];
    $('#upload-feedback').text('');
    if (file){
        $('#upload-type').html('<strong>Type</strong>: ' + file.type);
        $('#upload-size').html('<strong>Size</strong>: ' + prettyPrintSize(file.size));
        $('.upload-details').show();
    } else {
        $('#upload-type').text('');
        $('#upload-size').text('');
        $('.upload-details').hide();
    }
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
