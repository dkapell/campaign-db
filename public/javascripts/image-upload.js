$(function(){
    $('.image-file-picker').on('change', updateImage);
    $('.clear-image-btn').on('click', clearImage);

});

async function updateImage(e){
    const file = ($(this).prop('files'))[0];
    const $row = $(this).closest('.row');
    if (file){
        if ($(this).data('immediate')){
            await uploadImage(file, $row);
        } else {
            $row.find('.upload-type').html('<strong>Type</strong>: ' + file.type);
            $row.find('.upload-size').html('<strong>Size</strong>: ' + prettyPrintSize(file.size));
            $row.find('.image-details-row').show();
        }

    } else {
        $row.find('.image-details-row').hide();
        $row.find('.upload-type').text('');
        $row.find('.upload-size').text('');
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


async function getSignedRequest(file){
    try{
        const result = await fetch(`/admin/upload/sign-image?filename=${file.name}&filetype=${file.type}`, {credentials: 'include'});
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

async function uploadImage(file, $row){
    $row.find('.new-image').hide();
    const request = await getSignedRequest(file);
    const uploaded = await uploadFile(file, request.signedRequest, $row);
    if (uploaded){
        if (request.postUpload){
            $row.find('.image-saving').show();
            const postData = await markFileUploaded(request.postUpload);
            $row.find('.image-saving').hide();
            if (postData.success){
                $row.find('.image-container').attr('src', postData.data.thumbnailUrl);
                $row.find('.existing-image').show();
            } else {
                $row.find('.new-image').show();
            }
        }

        $row.find('.image_id-field').val(request.objectId).trigger('change');
        $row.find('.image-file-picker').val(null);
        return true;
    }
    return false;
}

async function uploadFile(file, url, $row){
    const xhr = new XMLHttpRequest();
    return new Promise((resolve) => {
        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
                const percent = Math.round(event.loaded/event.total * 100);
                setProgressBar($row, percent);
            }
        });
        xhr.addEventListener('loadend', () => {
            hideProgressBar($row);
            resolve(xhr.readyState === 4 && xhr.status === 200);
        });
        xhr.open('PUT', url, true);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.send(file);
    });

}

function setProgressBar($row, percent){
    $row.find('.image-upload-progress').show();
    $row.find('.progress-bar').css('width', `${percent}%`);
    $row.find('.progress-bar-label').text(`${percent}%`);
}

function hideProgressBar($row){
    $row.find('.image-upload-progress').hide();
    $row.find('.progress-bar').css('width', '0%');
    $row.find('.progress-bar-label').text('');
}

async function markFileUploaded(url){
    try {
        const request = await fetch(url, {
            method:'PUT'
        });
        return request.json();
    } catch (err){
        $('#upload-feedback').text('Error marking file uploaded');
        console.trace(err);
        return {sucess:false};
    }
}

function clearImage(e){
    e.preventDefault();
    const $row = $(this).closest('.row');
    $row.find('.existing-image').hide();
    $row.find('.new-image').show();
    $row.find('.image_id-field').val(null);
}
