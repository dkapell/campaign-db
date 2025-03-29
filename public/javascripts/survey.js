let nextSurveyFieldIndex = 0;
$(function(){
    $('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve'
    });

    prepSurveyFields();
});

function prepSurveyFields(){
    $('#survey_field-new').hide();
    $('.add-survey_field-btn').on('click', addSurveyField);

    $('.remove-survey_field-btn').confirmation({
        title: 'Delete this Field'
    }).on('click', removeSurveyField);

    $('.survey_field-row').each(function(idx){
        toggleFieldOptions($(this));
    });
    $('.survey_field-type').on('change', function(){
        toggleFieldOptions($(this).closest('.survey_field-row'));
    });

    $('#survey_fields-list').sortable({
        items: '> .survey_field-row',
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

function updateNames($list){
    $list.find('.survey_field-row').each(function (idx) {
        $(this).find('.sort-order').val(idx);
    });
}

function toggleFieldOptions($row){
    const type = $row.find('.survey_field-type').val();
    if ($row.attr('id') === 'survey_field-new'){
        return;
    }
    $row.find('.survey_field-type-options').hide()
    switch (type){
        case 'longtext':
            $row.find('.textarea-options').show();
            break;
        case 'dropdown':
            $row.find('.dropdown-options').show();
            break;
    }
    $row.find('[data-bs-toggle="tooltip"]').tooltip({delay: { 'show': 500, 'hide': 100 }});
}

function removeSurveyField(e){
    const $this = $(this);
    e.preventDefault();
    e.stopPropagation();
    $this.closest('.survey_field-row').remove();
}

function addSurveyField(e){
    const $this = $(this);
    e.preventDefault();
    const $new = $('#survey_field-new').clone();
    const id = nextSurveyFieldIndex++;
    $new.attr('id', `survey_field-new-${id}`);

    // Update all provides fields
    $new.find('.survey_field-input').each(function(e) {
        const $input = $(this);
        const fieldtype = $input.data('fieldtype');
        $input.attr('id', `survey_field-new-${id}-${fieldtype}`);
        $input.attr('name', `survey[definition][new-${id}][${fieldtype}]`);
        if ($input.data('required')){
            $input.attr('required', true);
        }
    });

    $new.find('.survey_field-label').each(function(e) {
        const $label = $(this);
        const fieldtype = $label.data('fieldtype');
        $label.attr('for', `survey_field-new-${id}-${fieldtype}`);

    });

    $new.find('.remove-survey_field-btn').confirmation({
        title: 'Delete this Field'
    }).on('click', removeSurveyField);

    $new.find('.survey_field-type').on('change', function(){
        toggleFieldOptions($(this).closest('.survey_field-row'));
    });


    toggleFieldOptions($new)
    $new.appendTo('#survey_fields-list');
    $new.show();

}
