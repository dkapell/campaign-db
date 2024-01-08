/* globals _ marked */
/* globals attributesTemplate diagnoseTemplate stylesTemplate languagesTemplate traitsTemplate skillsTemplate */
/* globals skillTemplate characterTemplate */

'use strict';

$(function(){
    prepReportSelects();
    $('#report_group_character_picker').on('change', updateGroupReport);
    $('#report_group_character_picker').trigger('change');

    prepSkillReportForm();
    $('#report_skill_skill').on('change', updateSkillReport);
    $('#report_skill_skill').trigger('change');
    $('#report_skill_show_inactive').on('change', function(){ $('#report_skill_skill').trigger('change'); });
    $('#report_skill_show_staff').on('change', function(){ $('#report_skill_skill').trigger('change'); });
    $('#report_skill_group_by_name').on('change', function(){
        $('#report_skill_skill').val(null).trigger('change')
    });
});


function prepReportSelects(){
    $('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve'
    });

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

function prepSkillReportForm(){
    $('#report_skill_skill').select2({
        theme: 'bootstrap-5',
        width: 'resolve',
        ajax: {
            url: '/report/skill/skills',
            data: function (params) {
                return {
                    search: params.term,
                    usage_id: $('#report_skill_skill_usage').val(),
                    source_id: $('#report_skill_skill_source').val(),
                    tag_id: $('#report_skill_skill_tag').val(),
                    type_id: $('#report_skill_skill_type').val(),
                    groupByName: $('#report_skill_group_by_name').prop('checked')
                };
            }
        },
        templateResult: formatReportSkill,
        templateSelection: formatReportSkillSelection
    });
}


function formatReportSkill(skill){
    if (skill.loading){
        return skill.text;
    }
    const $container = $(`
        <div class="row">
            <div class="col-md">
                <strong>${skill.source}</strong>:
                <i>${skill.name}</i>
                <span class='mx-2 skill-tags'></span>
            </div>
            <div class="col-md-2">
                ${skill.type}
            </div>
            <div class="col-md-2 text-end">
                ${skill.usage}
            </div>

        </div>
        <div class="row">
            <div class="col">
                <div class="ms-2">${marked.parseInline(skill.summary)}</div>
            </div>
        </div>

    `);
    for (const tag of skill.tags){
        const $tag = $(`<span class='badge text-bg-${tag.color?tag.color:'info'} me-1'>${tag.name}</span>`);
        $container.find('.skill-tags').append($tag);
    }
    return $container;
}

function formatReportSkillSelection(skill){
    if (!skill.id){
        return skill.text;
    }
    return $(`<div><strong>${skill.source}:</strong> <i>${skill.name}</i></div>`);
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

async function updateSkillReport(){
    const $this = $(this);
    let url = '/report/skill/data?';
    url += new URLSearchParams({
        skill_id: $this.val(),
        showInactive: $('#report_skill_show_inactive').prop('checked'),
        showStaff: $('#report_skill_show_staff').prop('checked'),
        groupByName: $('#report_skill_group_by_name').prop('checked')
    });
    const result = await fetch(url);
    const data = await result.json();
    $('#report-skill').html(skillTemplate(data));
    $('#report-characters').html(characterTemplate(data));
    $('#report-inactive-count').text(data.counts.inactive);
    $('#report-staff-count').text(data.counts.staff);
    $('#report-total-count').text(data.counts.total);
    $('#report-showing-count').text(data.characters.length);
}
