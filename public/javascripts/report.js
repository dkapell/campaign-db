/* globals _ attributesTemplate diagnoseTemplate stylesTemplate languagesTemplate traitsTemplate skillsTemplate */
'use strict';

$(function(){
    prepReportSelects();
    $('#report_group_character_picker').on('change', updateGroupReport);
    $('#report_group_character_picker').trigger('change');
});


function prepReportSelects(){
    $('.complex-select2').each(function(e){
        const $select = $(this);
        $select.select2({
            theme:'bootstrap-5',
            minimumResultsForSearch: 6,
            width:'resolve',
            escapeMarkup: function(markup) {
                return markup;
            },
            templateResult: function(data) {
                return $(data.element).data('html');
            },
            templateSelection: function(data) {
                if (data.id === '') {
                    return $select.data('placeholder');
                }
                return $(data.element).data('text');
            }
        });
    });
}

async function updateGroupReport(){
    const $this = $(this);
    let url = '/report/group/data?';
    url += new URLSearchParams({
        characters: $this.val()
    });
    const result = await fetch(url);
    const data = await result.json();
    $('#report-attributes').html(attributesTemplate(data));
    $('#report-diagnose').html(diagnoseTemplate(data));
    $('#report-styles').html(stylesTemplate(data));
    $('#report-languages').html(languagesTemplate(data));
    $('#report-traits').html(traitsTemplate(data));
    $('#report-skills').html(skillsTemplate(data));
    $('#report-skills-tab').find('.nav-link').first().addClass('active');
    $('#report-skills-tabContent').find('.tab-pane').first().addClass('active').addClass('show');
}
