/* globals _  marked optionDescriptionTemplate */

'use strict';

let nextIndex = 0;
let imageList = [];
$(function(){
    prepCustomFieldForm($('#custom-skill-form'));
    $('#custom_fieldModal').find('.save-btn').on('click', submitDropdownOptionModal);

});


function prepCustomFieldForm($form){
    if (!$form) { return; }
    $form.find('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve'
    });

    $form.find('#custom_field_type').on('change', showTypeFields).trigger('change');
    $form.find('.description-edit-btn').on('click', showDropdownOptionEditModal);
    $form.find('.option-details-display').on('click', showDropdownOptionEditModal);
    $form.find('.details-toggle-btn').on('click', toggleDetails);
    $form.find('.option-description-hidden').on('click', toggleDetails);
    $form.find('#custom_field_display_to_pc').on('change', updateEditableByPc).trigger('change');

    $('#option-new').hide();
    $('.add-option-btn').on('click', addDropdownOption);
    $('.hide-details-btn').on('click', toggleAllDetails);
    $('.remove-option-btn').confirmation({
        title: 'Delete this Option'
    }).on('click', removeDropdownOption);
    $form.find('[data-bs-toggle="tooltip"]').tooltip();

    $('#custom-field-dropdown-options').sortable({
        items: '> .dropdownOption-config',
        handle: '.handle',
        helper: 'clone',
        zIndex: 9999,
        tolerance: 'pointer',
        axis: 'y',
        stop: function (event, ui) {
            updateNames($(this));
        }
    });
}

function updateEditableByPc(e){
    const $this = $(this);
    if ($this.prop('checked') ){
        $('#custom_field_editable_by_pc').attr('disabled', false);
    } else {
        $('#custom_field_editable_by_pc').prop('checked', false).attr('disabled', true);

    }
}

function updateNames($list){
    $list.find('li').each(function (idx) {
        $(this).find('.sort-order').val(idx);
    });
}

function removeDropdownOption(e){
    const $this = $(this);
    e.preventDefault();
    e.stopPropagation();
    $this.closest('.dropdownOption-config').remove();
}

function showTypeFields(e){
    const type = $(this).val();
    $('.type-options').hide();
    $(`.${type}-options`).show();
    if ($(this).val() === 'boolean'){
        $('#custom_field_required').attr('disabled', true).prop('checked', false);
    } else {
        $('#custom_field_required').attr('disabled', false);
    }
}

function toggleAllDetails(e){
    const $this = $(this);
    e.preventDefault();
    const $container = $('#custom-field-dropdown-options');
    if ($this.attr('aria-expanded') === 'true'){
        $this.attr('aria-expanded', 'false');
        $container.find('.dropdownOption-config').each( function(idx) {
            const $this = $(this);
            const $btn = $this.find('.details-toggle-btn');
            const $description = $this.find('.option-details-display');
            const $hiddenText = $this.find('.option-details-hidden');
            if ($btn.is(':visible')){
                $description.hide('fast');
                $btn.attr('aria-expanded', 'false');
                $hiddenText.show();
            }
        });
    } else {
        $this.attr('aria-expanded', 'true');
        $container.find('.dropdownOption-config').each( function(idx) {
            const $this = $(this);
            const $btn = $this.find('.details-toggle-btn');
            const $description = $this.find('.option-details-display');
            const $hiddenText = $this.find('.option-details-hidden');
            if ($btn.is(':visible')){
                $btn.attr('aria-expanded', 'true');
                $hiddenText.hide();
                $description.show('fast');
            }
        });
    }

}

function toggleDetails(e){
    const $this = $(this);
    e.preventDefault();
    const $description = $this.closest('.dropdownOption-config').find('.option-details-display');
    const $btn = $this.closest('.dropdownOption-config').find('.details-toggle-btn');
    const $hiddenText = $this.closest('.dropdownOption-config').find('.option-details-hidden');
    if ($this.attr('aria-expanded') === 'true'){
        $description.hide('fast');
        $btn.attr('aria-expanded', 'false');
        $hiddenText.show();
    } else {
        $hiddenText.hide();
        $description.show('fast');
        $btn.attr('aria-expanded', 'true');
    }
}

async function showDropdownOptionEditModal(e) {
    const $this = $(this);
    e.preventDefault();
    const $description = $this.closest('.dropdownOption-config').find('.option-description');
    const $imageId = $this.closest('.dropdownOption-config').find('.option-image');
    const $modal = $('#custom_fieldModal');
    const result = await fetch('/image/list');

    imageList = await result.json();

    const data = {
        description:$description.val(),
        targetId: $description.closest('.dropdownOption-config').attr('id'),
        images: imageList,
        imageId: Number($imageId.val())

    };
    $modal.find('.modal-title').text('Option Details');
    $modal.find('.modal-body').html(optionDescriptionTemplate(data));

    $modal.find('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve',
        dropdownParent: $modal,
    });

    $modal.modal('show');

    $modal.on('hidden.bs.modal', function(e){
        $modal.modal('dispose');
    });
}

function submitDropdownOptionModal(e){
    e.preventDefault();
    const $modal = $('#custom_fieldModal');
    const targetId = $modal.find('#target-id').val();
    const $target = $(`#${targetId}`);
    const contents =$modal.find('#options-description').val();
    const imageId = $modal.find('#options-image').val();
    if(contents && contents !== ''){
        $target.find('.option-description').val(contents);
        $target.find('.option-description-display').html(marked.parse(contents, {breaks: true}));
        $target.find('.description-btn-icon').removeClass('fa-plus').addClass('fa-edit');
        $target.find('.description-btn-text').text('Edit Details');
        $target.find('.details-toggle-btn').show();
    } else {
        $target.find('.option-description').val(null);
        $target.find('.option-description-display').html('');
        $target.find('.description-btn-icon').removeClass('fa-edit').addClass('fa-plus');
        $target.find('.description-btn-text').text('Add Details');
        $target.find('.details-toggle-btn').hide();
    }

    if (Number(imageId) !== -1){
        $target.find('.option-image').val(imageId);
        const image = _.findWhere(imageList, {id:Number(imageId)});
        $target.find('.option-image-display').html(`<strong class="me-1">Image:</strong>${image.display_name?image.display_name:image.name}`);
    } else {
        $target.find('.option-image').val(null);
        $target.find('.option-image-display').html(null);
    }

    $modal.modal('hide');
}

function addDropdownOption(e){
    const $this = $(this);
    e.preventDefault();

    const $new = $('#option-new').clone();
    const id = nextIndex++;
    $new.attr('id', `option-new-${id}`);

    $new.find('.sort-order').val(1000 + id);

    // Update all options fields
    $new.find('.option-input').each(function(e) {
        const $input = $(this);
        const fieldtype = $input.data('fieldtype');
        $input.attr('id', `custom_field-configuration-options-new-${id}-fieldtype`);
        $input.attr('name', `custom_field[configuration][options][new-${id}][${fieldtype}]`);
        if ($input.data('required')){
            $input.attr('required', true);
        }
    });

    // Update all options labels
    $new.find('.option-label').each(function(e) {
        const $label = $(this);
        const fieldtype = $label.data('fieldtype');
        $label.attr('for', `custom_field-configuration-options-new-${id}-fieldtype`);
    });

    // Update all options description rows
    $new.find('.option-description-row').each(function(e) {
        const $row = $(this);
        $row.attr('id', `custom_field-configuration-options-form-new-${id}`);
    });

    $new.find('.description-edit-btn').on('click', showDropdownOptionEditModal);
    $new.find('.option-details-display').on('click', showDropdownOptionEditModal);
    $new.find('.details-toggle-btn').on('click', toggleDetails);
    $new.find('.option-description-hidden').on('click', toggleDetails);
    $new.find('[data-bs-toggle="tooltip"]').tooltip();

    $new.find('.remove-option-btn').confirmation({
        title: 'Delete this Option'
    }).on('click', removeDropdownOption);

    $new.find('select').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve'
    });

    $new.find('.clearable-select2').select2({
        allowClear: true,
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve',
        placeholder:{id:'-1'},
        dropdownParent: $this.closest('form'),
    });


    $new.appendTo('#custom-field-dropdown-options');
    $new.show();

}
