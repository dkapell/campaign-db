/* globals marked */
$(function(){
    $('[data-bs-toggle="tooltip"]').tooltip({
        delay: { 'show': 500, 'hide': 100 },
        placement:'auto'
    });

    prepUserFilter();
    toggleUserRows();

    prepDocumentationFilter();
    toggleDocumentationColumns();
    $('#userForm').on('submit', submitUserForm);

});

function prepUserFilter(){
    $('.user-type-filter').on('change', toggleUserFilter);

    if (localStorage.getItem('cdb-user-type-filter')){
        const types = (localStorage.getItem('cdb-user-type-filter')).split(',');
        $('.user-type-filter').each(function(idx){
            if (types.indexOf($(this).val()) !== -1){
                $(this).prop('checked', true);
            } else {
                $(this).prop('checked', false);
            }
        });
    }
}

function toggleUserFilter(){
    const types = [];
    $('.user-type-filter').each(function(idx){
        if ($(this).prop('checked')){
            types.push($(this).val());
        }
    });
    localStorage.setItem('cdb-user-type-filter', types.join(','));
    toggleUserRows();
}

function toggleUserRows(){
    const table = $('#user-table').DataTable();
    const typeList = localStorage.getItem('cdb-user-type-filter');
    if (typeList){
        const types = typeList.split(',');
        $.fn.dataTable.ext.search.pop();
        $.fn.dataTable.ext.search.push(
            function(settings, data, dataIndex) {
                return types.indexOf($(table.row(dataIndex).node()).attr('data-type')) !== -1;
            }
        );
        table.draw();
    }
}


function prepDocumentationFilter(){
    $('#documentation-filter').on('change', toggleDocumentationFilter);

    if (localStorage.getItem('cdb-user-documentation-filter') === 'true'){
        $('#documentation-filter').prop('checked', true);
    } else {
        $('#documentation-filter').prop('checked', false);
    }
}


function toggleDocumentationFilter(e){
    if ($(this).prop('checked')){
        localStorage.setItem('cdb-user-documentation-filter', 'true');
    } else {
        localStorage.removeItem('cdb-user-documentation-filter');
    }
    toggleDocumentationColumns();
    $('#user-table').DataTable().columns.adjust().responsive.recalc();
}

function toggleDocumentationColumns(){
    const table = $('#user-table').DataTable();
    const docColumns = table.columns('.documentation-column');
    const nonDocColumns = table.columns('.non-documentation-column');
    if (localStorage.getItem('cdb-user-documentation-filter') === 'true'){
        docColumns.visible(true);
        nonDocColumns.visible(false);
    } else {
        docColumns.visible(false);
        nonDocColumns.visible(true);
    }
    table.columns.adjust().responsive.recalc();
}

async function submitUserForm(e){
    e.preventDefault();
    const $form = $(this);
    $form.find('.submit-icon').removeClass('fa-save').addClass('fa-sync').addClass('fa-spin');

    $user_image_picker = $form.find('#user_image_id').closest('.image-field-container').find('.image-file-picker');
    if (!$user_image_picker.length){
        $form.unbind('submit').submit();
        return true;
    }

    const file = ($user_image_picker.prop('files'))[0];
    if (!file){
        $form.unbind('submit').submit();
        return true;
    }

    const request = await getSignedUserImageRequest(file);
    $('#user_image_id').val(request.objectId);

    const $container = $user_image_picker.closest('.image-field-container');
    const uploaded = await uploadFile(file, request.signedRequest, $container);

    if (uploaded){
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

async function getSignedUserImageRequest(file){
    try{
        const result = await fetch(`/user/sign-s3?filename=${file.name}&filetype=${file.type}`, {credentials: 'include'});
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
