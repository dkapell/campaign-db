/* global _ uploadFile markFileUploaded*/

$(document).ready(function () {
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
    const result = await fetch(url, {method:'DELETE', redirect:'manual'});
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

async function submitImageForm(e){
    e.preventDefault();
    const $form = $(this);
    $form.find('.submit-icon').removeClass('fa-save').addClass('fa-sync').addClass('fa-spin');

    const $imagePicker = $form.find('#imagePicker').closest('.image-field-container').find('.image-file-picker');

    const file = ($imagePicker.prop('files'))[0];
    if (!file){
        return false;
    }
    const request = await getSignedRequest(file);
    $('#image-id').val(request.objectId);
    $('#new-image-form').attr('action', `/admin/image/${request.objectId}`);

    const $container = $imagePicker.closest('.image-field-container');
    $container.find('.new-image').hide();
    const uploaded = await uploadFile(file, request.signedRequest, $container);

    if (uploaded){
        $('#image-status').val('ready');
        if (request.postUpload){
            $container.find('.image-saving').show();
            await markFileUploaded(request.postUpload);
            $container.find('.image-saving').hide();
        }
        $form.unbind('submit').submit();
        return true;
    } else {
        return false;
    }
}

async function getSignedRequest(file){
    try{
        const result = await fetch(`/admin/image/sign-s3?filename=${file.name}&filetype=${file.type}`, {credentials: 'include'});
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
