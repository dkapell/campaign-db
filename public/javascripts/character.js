/* globals _  marked */
/* globals charactersheetTemplate charactersourcelistTemplate characterskilllistTemplate addsourceformTemplate */
/* globals addskillformTemplate editskillformTemplate charactersourceTemplate characterskillTemplate */
/* globals characterauditsTemplate prepDataTable*/

'use strict';

$(function(){
    if (localStorage.getItem('cdb-skill-show-skill-descriptions') === 'true'){
        $('#showSkillDescriptions').prop('checked', true);
    } else {
        $('#showSkillDescriptions').prop('checked', false);
    }

    $('#showSkillDescriptions').on('change', skillDescriptionsSwitch);
    toggleSkillDescriptions();

    $('.add-source-btn').on('click', addSource);
    $('.add-skill-btn').on('click', addSkill);
    $('#characterModal').find('.save-btn').on('click', submitModal);
    if ($('#character-source-table').length){
        showSourceList();
    }
    if ($('#character-skill-table').length){
        showSkillList();
    }
    if ($('#character-audits-table').length){
        showAudits($('#character-audits-table').data('characterid'));
    }

    $('[data-bs-toggle="tooltip"]').tooltip({
        delay: { 'show': 500, 'hide': 100 },
        placement:'auto'
    });
    $('.popover-hover[data-bs-toggle="popover"]').popover({
        trigger: 'hover'
    });

    $('.clone-btn')
        .confirmation({
            title: 'Duplicate this Character?'
        }).on('click', cloneCharacter);

    $('#rebuildAllBtn')
        .confirmation({
            title: 'Recalculate Build for all Characters?'
        }).on('click', recalcAll);
    $('#characterTabs a[data-bs-toggle="tab"]').on('shown.bs.tab', function (e) {
        const target = $(e.target).attr('aria-controls');
        const $table = $(`#${target}`).find('.data-table');
        $table.DataTable().columns.adjust().responsive.recalc();
    });
});

const renderer = {
    image(href, title, text){
        if (text.match(/^Aspect Tile/)){
            let out = '<img style="height: 1.2em" src="' + href + '" alt="' + text + '"';
            if (title) {
                out += ' title="' + title + '"';
            }
            out += '>';
            return out;
        }
        return marked.Renderer.prototype.image.call(this, href, title, text);
    }
};
marked.use({ renderer });

async function updateCharacterWidgets(characterId){
    showSourceList();
    showSkillList();
    showCharacterSheet(characterId);
    showCp(characterId);
    showAudits(characterId);
}

async function showCharacterSheet(characterId){
    const result = await fetch(`/character/${characterId}/data`);
    const data = await result.json();

    data.capitalize = capitalize;
    data.marked = marked;

    $('#character').html(charactersheetTemplate(data));
    if (localStorage.getItem('cdb-skill-show-skill-descriptions') === 'true'){
        $('#showSkillDescriptions').prop('checked', true);
    } else {
        $('#showSkillDescriptions').prop('checked', false);
    }
    $('#showSkillDescriptions').on('change', skillDescriptionsSwitch);
    toggleSkillDescriptions();
}

async function showAudits(characterId){
    const result = await fetch(`/character/${characterId}/audit`);
    const data = await result.json();

    data.capitalize = capitalize;
    data.marked = marked;

    $('#character-audits-table').html(characterauditsTemplate(data));
    $('#character-audits-table-loading').hide();
    $('#character-audits-table').show();
}


async function showSourceList(){
    const characterId = $('#character-source-table').data('characterid');
    const result = await fetch(`/character/${characterId}/source`);
    const data = await result.json();

    data.capitalize = capitalize;
    data.marked = marked;
    data.allowedEdit = $('#character-source-table').data('allowededit');

    $('#character-source-table').html(charactersourcelistTemplate(data));
    $('.delete-source-btn')
        .confirmation({
            title: 'Remove this Header'
        }).on('click', removeSource);

    $('#character-source-table').find('[data-bs-toggle="tooltip"]').tooltip();
    $('#character-source-table-loading').hide();
    $('#character-source-table').show();
}

async function showSkillList(){
    const characterId = $('#character-skill-table').data('characterid');
    const result = await fetch(`/character/${characterId}/skill`);
    const data = await result.json();

    data.capitalize = capitalize;
    data.marked = marked;
    data.allowedEdit = $('#character-skill-table').data('allowededit');

    $('#character-skill-table').html(characterskilllistTemplate(data));
    $('.skill-edit-btn').on('click', editSkill);
    $('.delete-skill-btn')
        .confirmation({
            title: 'Remove this Skill'
        }).on('click', removeSkill);

    $('#character-skill-table').find('[data-bs-toggle="tooltip"]').tooltip();
    $('#character-skill-table-loading').hide();
    $('#character-skill-table').show();
    $('#character-skill-table').find('table').each(prepDataTable);
}

async function showCp(characterId){
    const result = await fetch(`/character/${characterId}/cp`);
    const data = await result.json();
    $('#character-cp').text(data.cp);
}

function skillDescriptionsSwitch(e){
    if ($(this).prop('checked')){
        localStorage.setItem('cdb-skill-show-skill-descriptions', 'true');
    } else {
        localStorage.removeItem('cdb-skill-show-skill-descriptions');
    }
    toggleSkillDescriptions();
}

function toggleSkillDescriptions(){
    if (localStorage.getItem('cdb-skill-show-skill-descriptions') === 'true'){
        $('.skill-description').show();
    } else {
        $('.skill-description').hide();
    }
}

async function addSource(e){
    e.preventDefault();
    e.stopPropagation();

    const $this = $(this);
    const characterId = $this.data('characterid');

    const result = await fetch(`/character/${characterId}/source/add`);
    const data = await result.json();

    const $modal = $('#characterModal');
    data.characterId = characterId;
    data.capitalize = capitalize;
    data.marked = marked;
    data.modal = true;
    data.backto = 'modal';

    $modal.find('.modal-title').text('Add Header');
    $modal.find('.modal-body').html(addsourceformTemplate(data));
    prepCharacterSourceForm($modal.find('form'), data.character_skill_source);
    $modal.find('.save-btn').text('Add Header');
    $modal.modal('show');

    $modal.on('shown.bs.modal', function(e){
        $('#character_skill_source_source_id').select2('focus');
    });


    $modal.on('hidden.bs.modal', function(e){
        updateCharacterWidgets(characterId);
        $modal.modal('dispose');
    });
}

async function removeSource(e){
    e.preventDefault();
    e.stopPropagation();

    const $this = $(this);
    const characterId = $this.data('characterid');
    const sourceId = $this.data('sourceid');
    const csrfToken = $this.data('csrf');
    const result = await fetch(`/character/${characterId}/source/${sourceId}`, {
        method:'DELETE',
        headers: {
            'CSRF-Token': csrfToken
        }
    });
    const data = await result.json();
    updateCharacterWidgets(characterId);
}

async function addSkill(e){
    e.preventDefault();
    e.stopPropagation();

    const $this = $(this);
    const characterId = $this.data('characterid');

    const result = await fetch(`/character/${characterId}/skill/add`);
    const data = await result.json();

    const $modal = $('#characterModal');
    data.characterId = characterId;
    data.capitalize = capitalize;
    data.marked = marked;
    data.modal = true;
    data.backto = 'modal';

    $modal.find('.modal-title').text('Add Skill');
    $modal.find('.modal-body').html(addskillformTemplate(data));
    prepCharacterSkillForm($modal.find('form'), data.character_skill);
    $modal.find('.save-btn').text('Add Skill');
    $modal.modal('show');
    $modal.on('shown.bs.modal', function(e){
        $('#character_skill_skill_id').select2('focus');
    });

    $modal.on('hidden.bs.modal', function(e){
        updateCharacterWidgets(characterId);
        $modal.modal('dispose');
    });
}

async function editSkill(e){
    e.preventDefault();
    e.stopPropagation();

    const $this = $(this);
    const characterId = $this.data('characterid');
    const characterSkillId = $this.data('skillid');

    const result = await fetch(`/character/${characterId}/skill/${characterSkillId}/edit`);
    const data = await result.json();

    const $modal = $('#characterModal');
    data.characterId = characterId;
    data.capitalize = capitalize;
    data.marked = marked;
    data.modal = true;
    data.backto = 'modal';

    $modal.find('.modal-title').text(`Edit Skill: ${data.character_skill.name}`);
    $modal.find('.modal-body').html(editskillformTemplate(data));
    prepCharacterSkillForm($modal.find('form'), data.character_skill);
    $modal.find('.save-btn').text('Update Skill');
    $modal.modal('show');

    $modal.on('hidden.bs.modal', function(e){
        updateCharacterWidgets(characterId);
        $modal.modal('dispose');
    });
}

async function removeSkill(e){
    e.preventDefault();
    e.stopPropagation();

    const $this = $(this);
    const characterId = $this.data('characterid');
    const skillId = $this.data('skillid');
    const csrfToken = $this.data('csrf');
    const result = await fetch(`/character/${characterId}/skill/${skillId}`, {
        method:'DELETE',
        headers: {
            'CSRF-Token': csrfToken
        }
    });
    const data = await result.json();
    updateCharacterWidgets(characterId);
    showCp(characterId);
}

function prepCharacterSourceForm($form){
    $form.find('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve'
    });

    $form.find('.complex-select2').each(function(e){
        const $select = $(this);
        $select.select2({
            theme:'bootstrap-5',
            minimumResultsForSearch: 6,
            width:'resolve',
            dropdownParent: $form,
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

    $('#character_skill_source_source_id').on('change', function(e){
        const source = $(this).find(':selected').data('source');
        $('#source-description').html(charactersourceTemplate({source:source}));
        displayDetails(source);
    });
}

function prepCharacterSkillForm($form, character_skill){
    $form.find('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve'
    });

    $form.find('.complex-select2').each(function(e){
        const $select = $(this);
        $select.select2({
            theme:'bootstrap-5',
            minimumResultsForSearch: 6,
            width:'resolve',
            dropdownParent: $form,
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

    $('#character_skill_skill_id').on('change', function(e){
        const skill = $(this).find(':selected').data('skill');
        $('#skill-description').html(characterskillTemplate({skill:skill}));
        displayDetails(skill);
    });

    displayDetails(character_skill, character_skill);
}

function displayDetails(object, selected){
    if (_.isArray(object.provides) && object.provides.length){
        switch (object.provides[0].type){
            case 'attribute': {
                if (object.provides[0].name.match(/^\s*\[/)){
                    $('.provides-options-select').find('label').text('Attribute');
                    const options = object.provides[0].name
                        .replace(/^\s*\[/, '')
                        .replace(/\]\s*$/, '')
                        .split(/\s*,\s*/);

                    const $select = $('#provides_value_select');
                    $select.select2('destroy');
                    $select.empty();
                    $select.attr('data-placeholder', 'Select a Attribute');
                    $select.append($('<option>'));

                    const match = (selected && selected.details && selected.details.stat)?selected.details.stat:false;
                    for (const option of options){
                        $('<option>')
                            .attr('value', option)
                            .attr('selected', option === match)
                            .text(option)
                            .appendTo($select);
                    }
                    $select.attr('required', true);
                    $select.select2({
                        theme:'bootstrap-5',
                        minimumResultsForSearch: 6,
                        width:'resolve'
                    });

                    $('.provides-options-select').show();
                    $('#provides_value_text').attr('required', false);
                    $('.provides-options-text').hide();
                }
                break;
            }
            case 'trait':
                if (object.provides[0].value === 'custom'){
                    $('.provides-options-text').find('label').text('Trait');
                    if(selected){
                        $('#provides_value_text').val(selected.details.trait);
                    }
                    $('.provides-options-select').hide();
                    $('#provides_value_select').attr('required', false);
                    $('#provides_value_text').attr('required', true);
                    $('.provides-options-text').show();
                }
                break;
            case 'style': {
                if (object.provides[0].value.match(/^\s*\[/)){
                    $('.provides-options-select').find('label').text('Weapon Style');
                    const options = object.provides[0].value
                        .replace(/^\s*\[/, '')
                        .replace(/\]\s*$/, '')
                        .split(/\s*,\s*/);

                    const $select = $('#provides_value_select');
                    $select.empty();
                    $select.attr('data-placeholder', 'Select a Weapon Style');
                    $select.append($('<option>'));

                    const match = (selected && selected.details && selected.details.style)?selected.details.style:false;
                    for (const option of options){
                        $('<option>')
                            .attr('value', option)
                            .attr('selected', option === match)
                            .text(option)
                            .appendTo($select);
                    }
                    $select.attr('required', true);
                    $select.select2({
                        theme:'bootstrap-5',
                        minimumResultsForSearch: 6,
                        width:'resolve'
                    });


                    $('.provides-options-select').show();
                    $('#provides_value_text').attr('required', false);
                    $('.provides-options-text').hide();

                }
                break;
            }
            case 'language': {
                if (object.provides[0].value.match(/^\s*\[/)){
                    $('.provides-options-select').find('label').text('Language');
                    const options = object.provides[0].value
                        .replace(/^\s*\[/, '')
                        .replace(/\]\s*$/, '')
                        .split(/\s*,\s*/);

                    const $select = $('#provides_value_select');
                    $select.empty();
                    $select.attr('data-placeholder', 'Select a Language');
                    $select.append($('<option>'));

                    const match = (selected && selected.details && selected.details.language)?selected.details.language:false;
                    for (const option of options){
                        $('<option>')
                            .attr('value', option)
                            .attr('selected', option === match)
                            .text(option)
                            .appendTo($select);
                    }
                    $select.attr('required', true);
                    $select.select2({
                        theme:'bootstrap-5',
                        minimumResultsForSearch: 6,
                        width:'resolve'
                    });


                    $('.provides-options-select').show();
                    $('#provides_value_text').attr('required', false);
                    $('.provides-options-text').hide();

                }
                break;
            }
            case 'tagskill': {
                if (object.provides[0].value.match(/^\s*\[/)){
                    $('.provides-options-select').find('label').text('Info Skill');
                    const options = object.provides[0].value
                        .replace(/^\s*\[/, '')
                        .replace(/\]\s*$/, '')
                        .split(/\s*,\s*/);

                    const $select = $('#provides_value_select');
                    $select.empty();
                    $select.attr('data-placeholder', 'Select a Info Skill');
                    $select.append($('<option>'));

                    const match = (selected && selected.details && selected.details.tagskill)?selected.details.tagskill:false;
                    for (const option of options){
                        $('<option>')
                            .attr('value', option)
                            .attr('selected', option === match)
                            .text(option)
                            .appendTo($select);
                    }
                    $select.attr('required', true);
                    $select.select2({
                        theme:'bootstrap-5',
                        minimumResultsForSearch: 6,
                        width:'resolve'
                    });


                    $('.provides-options-select').show();
                    $('#provides_value_text').attr('required', false);
                    $('.provides-options-text').hide();

                }
                break;
            }
            case 'skill': {
                if (object.provides[0].value.match(/^\s*\[/)){
                    $('.provides-options-select').find('label').text('Skill');
                    const options = object.provides[0].value
                        .replace(/^\s*\[/, '')
                        .replace(/\]\s*$/, '')
                        .split(/\s*,\s*/);

                    const $select = $('#provides_value_select');
                    $select.empty();
                    $select.attr('data-placeholder', 'Select a Skill');
                    $select.append($('<option>'));

                    const match = (selected && selected.details && selected.details.skill)?selected.details.skill:false;
                    for (const option of options){
                        $('<option>')
                            .attr('value', option)
                            .attr('selected', option === match)
                            .text(option)
                            .appendTo($select);
                    }
                    $select.attr('required', true);
                    $select.select2({
                        theme:'bootstrap-5',
                        minimumResultsForSearch: 6,
                        width:'resolve'
                    });


                    $('.provides-options-select').show();
                    $('#provides_value_text').attr('required', false);
                    $('.provides-options-text').hide();

                }
                break;
            }
            default:
                $('#provides_value_select').attr('required', false);
                $('#provides_value_text').attr('required', false);
                $('.provides-options-select').hide();
                $('.provides-options-text').hide();
        }
    }

}

async function cloneCharacter(e){
    e.preventDefault();
    e.stopPropagation();

    const $this = $(this);
    const characterId = $this.data('characterid');

    const csrfToken = $this.data('csrf');
    const result = await fetch(`/character/${characterId}/clone`, {
        method:'POST',
        headers: {
            'CSRF-Token': csrfToken
        }
    });
    const data = await result.json();
    if (data.success){
        window.location.href = data.url;
    }
}

async function recalcAll(e){
    e.preventDefault();
    e.stopPropagation();

    const $this = $(this);

    const csrfToken = $this.data('csrf');
    const result = await fetch('/character/recalculate', {
        method:'PUT',
        headers: {
            'CSRF-Token': csrfToken
        }
    });
    const data = await result.json();
    if (data.success){
        location.reload();

    }
}

async function submitModal(e) {
    e.preventDefault();
    const $modal = $('#characterModal');
    const form = $modal.find('.modal-body').find('form')[0];
    const data = new URLSearchParams();
    for (const pair of new FormData(form)) {
        data.append(pair[0], pair[1]);
    }

    const request = await fetch(form.action,{method:form.method, body: data});
    const result = await request.json();

    if (!result.success){
        console.trace(result.error);
        $modal.modal('hide');
    }
    $modal.modal('hide');
}

function capitalize(string){
    return string.charAt(0).toUpperCase() + string.slice(1);
}

