/* global _ */
$(document).ready(function () {
    $('#imagePicker').on('change', updateImage);

    $('#new-image-form').on('submit', submitImageForm);
    $('.copy-img-btn').on('click', copyImageMarkdown);
    $('.image-filter').on('change', updateImageFilter);
    loadImageFilter();
    $('.delete-img-btn').confirmation({
        title: 'Delete this item'
    }).on('click', deleteImage);

});

async function deleteImage(e){
    e.preventDefault();
    e.stopPropagation();
    const $this = $(this);
    const url = $this.attr('url');
    const result = await fetch(url, {method:'DELETE'});
    if($this.attr('data-back')){
        location = $this.attr('data-back');
    }
}

async function copyImageMarkdown(e){
    e.preventDefault();
    const $this = $(this);
    const url = $this.data('url');
    const name = $this.data('name');
    const string = `![${name}](${url})`;
    try{
        await navigator.clipboard.writeText(string);
    } catch(err){

    }
    $this.attr('data-bs-original-title', 'Copied!');
    $this.tooltip('setContent', {title:'Copied!', trigger:'hover focus'});
    $this.blur();

    $this.one('hidden.bs.tooltip', function(e){
        setTimeout(function(e){
            $this.attr('data-bs-original-title', 'Copy Markdown to Clipboard');
        }, 500);
    });

}

function updateImage(e){
    const file = ($(this).prop('files'))[0];
    $('#upload-feedback').text('');
    if (file){
        $('#upload-type').html('<strong>Type</strong>: ' + file.type);
        $('#upload-size').html('<strong>Size</strong>: ' + prettyPrintSize(file.size));
    } else {
        $('#upload-type').text('');
        $('#upload-size').text('');
    }
}

async function submitImageForm(e){
    e.preventDefault();
    var $this = $(this);
    const file = ($('#imagePicker').prop('files'))[0];
    if (!file){
        return false;
    }
    const uploaded = await getSignedRequest(file);
    if (uploaded){
        $this.unbind('submit').submit();
        return true;
    } else {
        return false;
    }
}

async function getSignedRequest(file){
    try{
        const result = await fetch(`/image/sign-s3?filename=${file.name}&filetype=${file.type}`, {credentials: 'include'});
        const response = await result.json();
        if (!response.success){
            $('#upload-feedback').text(response.error);
            return false;
        }
        const imageId = response.data.imageId;
        $('#image-id').val(imageId);
        $('#new-image-form').attr('action', '/image/' + imageId);
        return await uploadFile(file, response.data.signedRequest, response.data.url);

    } catch (err){
        $('#upload-feedback').text('Error getting signed request');
        console.trace(err);
        return false;
    }
}

async function uploadFile(file, signedRequest, url){
    try {
        await fetch(signedRequest, {method:'PUT', body: file});
        $('#image-status').val('ready');
        return true;
    } catch (err){
        $('#upload-feedback').text('Error uploading file');
        console.trace(err);
        return false;
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

function loadImageFilter(){
    const types = JSON.parse(localStorage.getItem('cdb-image-type-filter'));
    if (types){
        for (const type in types){
            if (types[type]){
                $(`.image-type-${type}`).show();
                $(`#image-type-filter-${type}`).prop('checked', true);
            } else {
                $(`.image-type-${type}`).hide();
                $(`#image-type-filter-${type}`).prop('checked', false);
            }
        }
    }
    updateImageFilter();
}

function updateImageFilter(){
    const types = {};
    $('.image-filter').each(function(e){
        const $this = $(this);
        const val = $this.is(':checked');
        const type = $this.data('type');
        if (val){
            $(`.image-type-${type}`).show();

        } else {
            $(`.image-type-${type}`).hide();
        }
        types[type] = val;
    });
    if (_.keys(types).length){
        localStorage.setItem('cdb-image-type-filter', JSON.stringify(types));
    }
}
