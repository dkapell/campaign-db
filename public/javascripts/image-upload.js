$(function(){
    $('.image-file-picker').on('change', updateImage);
    $('.clear-image-btn').on('click', clearImage);

});

async function updateImage(e){
    const file = ($(this).prop('files'))[0];
    const $container = $(this).closest('.image-field-container');
    if (file){
        if ($(this).data('immediate')){
            await uploadImage(file, $container);
        } else {
            $container.find('.upload-type').html('<strong>Type</strong>: ' + file.type);
            $container.find('.upload-size').html('<strong>Size</strong>: ' + prettyPrintSize(file.size));
            $container.find('.image-details-row').show();
        }

    } else {
        $container.find('.image-details-row').hide();
        $container.find('.upload-type').text('');
        $container.find('.upload-size').text('');
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

async function uploadImage(file, $container){
    $container.find('.new-image').hide();
    const request = await getSignedRequest(file);
    const uploaded = await uploadFile(file, request.signedRequest, $container);
    if (uploaded){
        if (request.postUpload){
            $container.find('.image-saving').show();
            const postData = await markFileUploaded(request.postUpload);
            $container.find('.image-saving').hide();
            if (postData.success){
                $container.find('.image-container').attr('src', postData.data.thumbnailUrl);
                $container.find('.existing-image').show();
            } else {
                $container.find('.new-image').show();
            }
        }

        $container.find('.image_id-field').val(request.objectId).trigger('change');
        $container.find('.image-file-picker').val(null);
        return true;
    }
    return false;
}

async function uploadFile(file, url, $container){
    const xhr = new XMLHttpRequest();
    return new Promise((resolve) => {
        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
                const percent = Math.round(event.loaded/event.total * 100);
                setProgressBar($container, percent);
            }
        });
        xhr.addEventListener('loadend', () => {
            hideProgressBar($container);
            resolve(xhr.readyState === 4 && xhr.status === 200);
        });
        xhr.open('PUT', url, true);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
    });

}

function setProgressBar($container, percent){
    $container.find('.image-upload-progress').show();
    $container.find('.progress-bar').css('width', `${percent}%`);
    $container.find('.progress-bar-label').text(`${percent}%`);
}

function hideProgressBar($container){
    $container.find('.image-upload-progress').hide();
    $container.find('.progress-bar').css('width', '0%');
    $container.find('.progress-bar-label').text('');
}

async function markFileUploaded(data){
    try {
        const request = await fetch(data.url, {
            method:'PUT',
            headers:{
                'CSRF-Token': data.csrf
            }
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
    const $container = $(this).closest('.image-field-container');
    $container.find('.existing-image').hide();
    $container.find('.new-image').show();
    $container.find('.image_id-field').val(null);
    $container.find('.image-container').attr('src', null);
}
