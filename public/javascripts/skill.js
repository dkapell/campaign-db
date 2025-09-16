/* globals _ editFormTemplate newFormTemplate marked isGM*/
'use strict';

let nextIndex = 0;

$(function(){
    prepSourceForm($('#sourceForm'));
    prepSkillForm($('#skillForm'));

    $('.skill-table').each(prepSkillTable);

    $('.skill-table tbody').on('click', '.clickable-row', clickRow);

    $('.skill-table tbody').on('click', '.action-btn', function(e){
        e.stopPropagation();
    });

    $('.skill-new-btn').on('click', newSkill);

    $('#skillModal').find('.save-btn').on('click', submitModal);

    makeColumnsResponsive();
    $( window ).resize(function() {
        makeColumnsResponsive();
    });

    if (localStorage.getItem('cdb-skill-delete-switch') === 'true'){
        $('#skillDeleteSwitch').prop('checked', true);
    } else {
        $('#skillDeleteSwitch').prop('checked', false);
    }

    $('#skillDeleteSwitch').on('change', skillDeleteSwitch);
    $('.progress-bar[data-bs-toggle="tooltip"]').tooltip({delay: { 'show': 200, 'hide': 100 }});

    toggleDeleteButtons();
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

function clickRow(e){
    e.preventDefault();
    if ($(e.target).hasClass('source-column')){
        return;
    }
    const id = $(this).attr('data-click-id');
    if ($('#skillEditSwitch').prop('checked')){
        editSkill(id);
    } else {
        const object = $(this).attr('data-click-object');
        window.location.href='/'+ object + '/' + id;
    }
}

function skillDeleteSwitch(e){
    if ($(this).prop('checked')){
        localStorage.setItem('cdb-skill-delete-switch', 'true');
    } else {
        localStorage.removeItem('cdb-skill-delete-switch');
    }
    toggleDeleteButtons();
    $('.skill-table').DataTable().columns.adjust().responsive.recalc();
}

function toggleDeleteButtons(){
    if (localStorage.getItem('cdb-skill-delete-switch') === 'true'){
        $('.delete-btn').show();
        $('.advance-btn').show();
    } else {
        $('.delete-btn').hide();
        $('.advance-btn').hide();
    }
}

function makeColumnsResponsive() {
    const visibleColumnCount = $('.skill-table tbody tr:first-child td:visible').length;
    for (let i = 0; i <= $('.skill-table thead tr:eq(1) th').length; i++) {
        const visibile = $(`.skill-table thead tr:eq(0) th:eq(${i})`).is(':visible');
        if (visibile){
            $(`.skill-table thead tr:eq(1) th:eq(${i})`).show();
        } else {
            $(`.skill-table thead tr:eq(1) th:eq(${i})`).hide();
        }
    }
}

function prepSkillTable(){
    const $table = $(this);
    $table.find('thead tr').clone(true).appendTo( $table.find('thead'));

    const options = {
        paging: true,
        scrollCollapse: true,
        stateSave: true,
        stateLoaded: function(){
            const columns = [];
            const api = this.api();
            api.columns().every( function () {
                columns.push(this.visible());
            });
            api.columns().visible(true);
            setTimeout( () =>{
                api.columns().every( function (idx) {
                    this.visible(columns[idx]);
                });
                api.columns.adjust().responsive.recalc();
                $('button.toggle-vis').each( function(){
                    var column = api.column( $(this).attr('data-column') );
                    showHideColumnButton($(this), column.visible());
                });
            }, 1);
        },
        orderCellsTop: true,
        fixedHeader: true,
        lengthMenu: [ [10, 20, 50, 100, -1], [10, 20, 50, 100, 'All'] ],
        pageLength: 20,
        initComplete: function(){
            this.api().columns().every( function () {
                const column = this;
                const title = $(column.header()).text();
                if (!title) { return; }

                const inputGroup = $('<div>')
                    .addClass('input-group')
                    .appendTo($('.skill-table thead tr:eq(1) th').eq(column.index()).empty() );

                const select = $('<select>')
                    .addClass('form-select')
                    .addClass('form-select-sm')
                    .attr('data-placeholder', title)
                    .data('partialmatch', $(column.header()).data('partialmatch'))
                    .append($('<option>'))
                    .appendTo(inputGroup)
                    .on( 'change', function () {
                        let val = $.fn.dataTable.util.escapeRegex(
                            $(this).val()
                        );
                        if (!$(this).data('partialmatch') && val){
                            val = `^${val}$`;
                        }
                        column
                            .search( val ? val : '', true, false )
                            .draw();
                        if ($(this).val()){
                            clearBtn.show();
                        } else {
                            clearBtn.hide();
                        }
                        setTimeout(()=>{
                            $('.skill-table').DataTable().columns.adjust().responsive.recalc();
                        }, 10);

                    })
                    .select2({
                        theme:'bootstrap-5',
                        minimumResultsForSearch: 6,
                        width:'resolve',
                        dropdownCssClass: 'skillDropdown'
                    });
                addFilterOptions($table, column);

                const clearBtn = $('<button>')
                    .addClass('btn')
                    .addClass('btn-sm')
                    .addClass('btn-outline-secondary')
                    .append($('<i>').addClass('fa').addClass('fa-times-circle'))
                    .appendTo(inputGroup)
                    .on('click', function(){
                        select.val(null).trigger('change');

                    });
                if (select.val()){
                    clearBtn.show();
                } else {
                    clearBtn.hide();
                }
            });
        },
        drawCallback: function(){
            $table.find('.delete-btn').confirmation({
                title: 'Delete this item'
            }).on('click', deleteItem);
            $table.find('.advance-btn').on('click', advanceItem);
            $table.find('.skill-edit-btn').on('click', function(e){
                e.preventDefault();
                e.stopPropagation();
                editSkill($(this).data('click-id'));
            });
            $table.find('[data-bs-toggle="popover"]').popover({
                trigger: 'hover'
            });
            $table.find('[data-bs-toggle="tooltip"]').tooltip({delay: { 'show': 500, 'hide': 100 }});
            this.api().columns().every( function () {
                addFilterOptions($table, this);
            });

            toggleDeleteButtons();
        }

    };

    if ($table.data('showedittoggle')){

        const $editSwitch = $('<div>')
            .addClass('form-check')
            .addClass('form-switch')
            .attr('title', 'Edit instead of view skills by clicking them')
            .tooltip({delay: { 'show': 500, 'hide': 100 }})
            .on('click', function(e){ $(this).blur();});


        $editSwitch.append($('<input>')
            .addClass('form-check-input')
            .attr('id', 'skillEditSwitch')
            .attr('type', 'checkbox')
            .prop('checked', localStorage.getItem('cdb-skill-edit-switch'))
        );
        $editSwitch.append($('<label>')
            .addClass('control-label')
            .attr('for', 'skillEditSwitch')
            .text('Edit Mode')
        );

        const $editSwitchContainer = $('<div>')
            .attr('id', 'editSwitchContainer')
            .addClass('rounded-pill')
            .addClass('px-2')
            .addClass('pt-1')
            .addClass('float-end')
            .append($editSwitch);

        if (localStorage.getItem('cdb-skill-edit-switch') === 'true'){
            $('#editSwitchContainer').addClass('bg-warning').addClass('text-white');
        }

        $editSwitch.on('change', function(e){
            if ($(this).find('input').prop('checked')){
                localStorage.setItem('cdb-skill-edit-switch', 'true');
                $('#editSwitchContainer').addClass('text-bg-warning');
            } else {
                localStorage.removeItem('cdb-skill-edit-switch');
                $('#editSwitchContainer').removeClass('text-bg-warning');
            }
        });

        options.layout = {
            topEnd:null,
            topStart:null,
            top1:[
                'pageLength',
                $editSwitchContainer,
                'search'
            ]
        };
    }

    const table = $table.DataTable(options);

    $('.dataTables_filter').find('label').append($('<button>')
        .append($('<i>').addClass('fa').addClass('fa-times-circle').addClass('pe-2'))
        .append('Clear Filters')
        .addClass('float-end')
        .addClass('btn')
        .addClass('btn-sm')
        .addClass('ml-2')
        .addClass('btn-outline-secondary')
        .on('click', function(e){
            e.preventDefault();
            $('.skill-table thead th select').each(function() {
                $(this).val(null).trigger('change');
            });
        })
    );



    $('button.toggle-vis').on( 'click', function (e) {
        e.preventDefault();

        // Get the column API object
        var column = table.column( $(this).attr('data-column') );

        // Toggle the visibility
        column.visible( ! column.visible() );
        table.columns.adjust().responsive.recalc();
        showHideColumnButton($(this), column.visible());
    });

    $table.show();
    $('#tableLoading').hide();
}
function addFilterOptions($table, column){
    const partialmatch = $(column.header()).data('partialmatch');
    const $header = $table.find('thead tr:eq(1) th').eq(column.index());
    const select = $header.find('select');
    select
        .empty()
        .append($('<option>'));
    const values = [];
    column.nodes().each( function ( d, j ) {
        const data = $(d);
        const val = data.attr('data-search')?data.attr('data-search'):data.text();
        for (const str of val.split(/\s*,\s*/)){
            values.push(str);
        }
    });
    for (const val of _.uniq(values).sort()){
        if (partialmatch && column.search() ===  val ) {
            select.append($('<option>')
                .attr('value', val)
                .attr('selected', 'selected')
                .text(val.length>33?val.substr(0,30)+'...':val)
            );
        } else if (column.search() ===   `^${val}$`) {
            select.append($('<option>')
                .attr('value', val)
                .attr('selected', 'selected')
                .text(val.length>33?val.substr(0,30)+'...':val)
            );
        } else {
            select.append($('<option>')
                .attr('value', val)
                .text(val.length>33?val.substr(0,30)+'...':val)
            );
        }
    }

}


function showHideColumnButton($btn, show){
    if (show){
        $btn.removeClass('btn-danger')
            .addClass('btn-outline-info')
            .find('.col-indicator')
            .removeClass('fa-eye-slash')
            .addClass('fa-eye');
    } else {
        $btn.addClass('btn-danger')
            .removeClass('btn-outline-info')
            .find('.col-indicator')
            .addClass('fa-eye-slash')
            .removeClass('fa-eye');
    }
}

async function deleteItem(e){
    e.preventDefault();
    e.stopPropagation();
    const $this = $(this);
    const url = $this.attr('url');
    const headers = {};
    if ($this.data('csrf')){
        headers['CSRF-Token'] = $this.data('csrf');
    }
    const result = await fetch(url, {method:'DELETE', redirect:'manual', headers:headers});
    if($this.attr('data-back')){
        location = $this.attr('data-back');
    } else {
        location.reload();
    }

}

async function advanceItem(e){
    e.preventDefault();
    e.stopPropagation();
    const $this = $(this);
    const url = $this.attr('url');
    const request = await fetch(url, {method:'PUT', redirect:'manual'});
    const result = await request.json();
    if (!result.success){
        console.log(result.error);
    }

    updateTable(result);
}

function capitalize(string){
    return string.charAt(0).toUpperCase() + string.slice(1);
}

async function editSkill(id){
    const result = await fetch(`/skill/${id}/edit/api`);
    const data = await result.json();

    const $modal = $('#skillModal');
    data.capitalize = capitalize;
    data.modal = true;
    data.backto = 'modal';
    data.checkPermission = function(type) {
        if (type === 'gm') { return isGM; }
        return false;
    };
    data.csrfToken = $('#csrfToken').val();

    $modal.find('.modal-title').text(`Edit Skill: ${data.skill.name}`);
    $modal.find('.modal-body').html(editFormTemplate(data));
    const $cloneBtn = $('<button>')
        .addClass('btn')
        .addClass('btn-success')
        .addClass('skill-clone-btn')
        .attr('type', 'button')
        .html('<i class="fas fa-copy"></i> Clone Skill')
        .attr('href', '/skill/new?clone=' + id)
        .attr('data-click-id', id);

    $modal.find('.extra-buttons').prepend($cloneBtn);
    prepSkillForm($modal.find('form'));
    $modal.modal('show');


    $modal.on('hidden.bs.modal', function(e){
        $modal.modal('dispose');
        $modal.find('.extra-buttons').find('.skill-clone-btn').remove();
    });
}

async function newSkill(e){
    e.preventDefault();
    e.stopPropagation();

    const $this = $(this);

    const params = {};
    if ($this.data('source')){
        params.skill_source = $this.data('source');
    }

    const result = await fetch('/skill/new/api?' + new URLSearchParams(params));
    const data = await result.json();

    const $modal = $('#skillModal');
    data.capitalize = capitalize;
    data.modal = true;
    data.backto = 'modal';
    data.checkPermission = function(type) {
        if (type === 'gm') { return isGM; }
        return false;
    };
    data.csrfToken = $('#csrfToken').val();

    $modal.find('.modal-title').text('New Skill');
    $modal.find('.modal-body').html(newFormTemplate(data));
    prepSkillForm($modal.find('form'));
    $modal.modal('show');

    $modal.on('hidden.bs.modal', function(e){
        $modal.modal('dispose');
    });

}

async function cloneSkill(id){

    const result = await fetch(`/skill/new/api?clone=${id}`);
    const data = await result.json();

    const $modal = $('#skillModal');
    data.capitalize = capitalize;
    data.modal = true;
    data.backto = 'modal';
    data.checkPermission = function(type) {
        if (type === 'gm') { return isGM; }
        return false;
    };
    $modal.modal('hide');
    $modal.one('hidden.bs.modal', function (e){
        $modal.find('.modal-title').text(`Clone Skill: ${data.skill.name}`);
        $modal.find('.modal-body').html(newFormTemplate(data));
        prepSkillForm($modal.find('form'));
        $modal.modal('show');

        $modal.on('hidden.bs.modal', function(e){
            $modal.modal('dispose');
        });
    });

}

async function submitModal(e) {
    e.preventDefault();
    const $modal = $('#skillModal');
    const form = $modal.find('.modal-body').find('form')[0];
    if (form.checkValidity() === false) {
        form.classList.add('was-validated');
        return;
    }
    form.classList.add('was-validated');
    const data = new URLSearchParams();
    for (const pair of new FormData(form)) {
        data.append(pair[0], pair[1]);
    }
    const request = await fetch(form.action, {method: form.method, body: data });
    const result = await request.json();

    if (!result.success){
        console.log(result.error);
        $modal.modal('hide');

    }
    updateTable(result);

    $modal.modal('hide');
}

function updateTable(data){
    const skill = data.skill;
    if (!skill) { return; }
    const rowData = [];
    let column = 0;
    if ($('.skill-table').data('showsource')){
        if (!skill.source){
            rowData[column++] = {display: '<i>Not Set</i>', '@data-sort': 0};
        } else {
            rowData[column++] = {
                display: `<a class="action-btn" href="/skill_source/${skill.source.id}"><strong>${capitalize(skill.source.name)}</strong></a>`,
                '@data-sort': `${skill.source.type.display_order}-${skill.source.name}`,
                '@data-search': skill.source.name
            };
        }
    }
    rowData[column++] = skill.name;
    rowData[column++] = skill.usage?capitalize(skill.usage.name):'<i>Not Set</i>';


    const tagDisplay = [];
    const tags = [];
    if (skill.required){
        tagDisplay.push('<span class=\'badge me-2 text-bg-danger\'>required</span>');
        tags.push('required');
    }

    for (const tag of skill.tags.slice(0, -1)){
        tags.push(tag.name);
        tagDisplay.push(`<span class='me-1 text-${tag.color?tag.color:'info'}'>${tag.name},</span>`);
    }
    const tag = skill.tags.slice(-1)[0];
    if (tag) {
        tags.push(tag.name);
        tagDisplay.push(`<span class='me-1 text-${tag.color?tag.color:'info'}'>${tag.name}</span>`);
    }
    rowData[column++] = {
        display: tagDisplay.join(''),
        '@data-search': tags.join(', ')
    };

    rowData[column++] = skill.summary.length>83?marked.parseInline(skill.summary.substr(0, 80)+'...'):marked.parseInline(skill.summary);
    rowData[column++] = skill.cost;
    rowData[column++] = getRequires(skill, data.skills);
    rowData[column++] = getConflicts(skill, data.skills);
    rowData[column++] = getStatus(skill);
    rowData[column++] = getButtons(skill);

    let tableRow = null;
    if (data.update){
        tableRow = $('.skill-table').find(`tr[data-click-id="${skill.id}"]`);
        const current = $('.skill-table').DataTable().row( tableRow ).data();
        $('.skill-table')
            .DataTable()
            .row( tableRow )
            .data(rowData)
            .draw();
    } else {
        tableRow = $(
            $('.skill-table')
                .DataTable()
                .row.add(rowData)
                .draw()
                .node()
        );

        tableRow.addClass('clickable-row');
        tableRow.attr('data-click-object', 'skill');
        tableRow.attr('data-click-id', skill.id);

        tableRow.find('td:last-child').addClass('text-end');

        if ($('.skill-table').data('showsource')) {
            tableRow.find('td:nth-child(2)').addClass('fst-italic');
        } else {
            tableRow.find('td:nth-child(1)').addClass('fst-italic');
        }

        //tableRow.on('click', '.clickable-row', clickRow);

    }
    tableRow.find('.action-btn').on('click', function(e){
        e.stopPropagation();
    });

    $('.skill-edit-btn').on('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        editSkill($(this).data('click-id'));

    });

    tableRow.find('[data-bs-toggle="popover"]').popover({
        trigger: 'focus'
    });
}

function getButtons(skill){
    let output = '';
    if (skill.description){
        const $descriptionBtn = $('<a>')
            .addClass('btn')
            .addClass('btn-outline-info')
            .addClass('btn-xs')
            .addClass('me-1')
            .addClass('action-btn')
            .attr('data-bs-toggle', 'popover')
            .attr('data-bs-content', marked.parse(skill.description, {breaks: true}))
            .attr('data-bs-html', 'true')
            .attr('title', 'Description')
            .attr('role', 'button')
            .attr('tabindex', '0')
            .append($('<i>').addClass('fas').addClass('fa-eye').addClass('fa-fw'));
        output = $descriptionBtn[0].outerHTML;

    }
    if(skill.notes){
        const $notesBtn = $('<a>')
            .addClass('btn')
            .addClass('btn-outline-info')
            .addClass('btn-xs')
            .addClass('ml-1')
            .addClass('action-btn')
            .attr('data-bs-toggle', 'popover')
            .attr('data-bs-content', marked.parse(skill.notes, {breaks: true}))
            .attr('data-bs-html', 'true')
            .attr('title', 'Notes')
            .attr('role', 'button')
            .attr('tabindex', '0')
            .append($('<i>').addClass('fas').addClass('fa-sticky-note').addClass('fa-fw'));
        output += $notesBtn[0].outerHTML;
    }
    const $editBtn = $('<a>')
        .addClass('btn')
        .addClass('btn-outline-primary')
        .addClass('btn-xs')
        .addClass('ml-1')
        .addClass('skill-edit-btn')
        .attr('data-bs-toggle', 'tooltip')
        .attr('title', 'Edit')
        .attr('data-click-id', skill.id)
        .attr('href', `/skill/${skill.id}/edit?backto='list'`)
        .append($('<i>').addClass('fas').addClass('fa-edit').addClass('fa-fw'));
    output += $editBtn[0].outerHTML;

    return output;
}

function getStatus(skill){
    if (!skill.status) { return ''; }

    const $badge = $('<div>')
        .addClass('badge')
        .addClass('badge-pill')
        .addClass('skill-status')
        .addClass(`text-bg-${skill.status.class}`)
        .text(capitalize(skill.status.name));

    if (skill.users.length && (!skill.status.display_to_pc || !skill.status.purchasable) && skill.status.complete){
        $badge.text(`${capitalize(skill.status.name)} (+${skill.users.length})`);
    }
    return  {
        display: $badge[0].outerHTML,
        '@data-search': skill.status.name
    };
}

function getRequires(skill, skills){
    let search = '';
    const $span = $('<span>');
    if (skill.requires && _.isArray(skill.requires) && skill.requires.length){
        search = skill.requires.map(source => {return (_.findWhere(skills, {id: source})).name;}).join(',');
        $span.text(`${skill.require_num} of ${skill.requires.length}`);
        const content = skill.requires.map(source => {
            const required = _.findWhere(skills, {id: source});
            return `<strong>${required.source?required.source.name:'unknown'}:</strong> <i>${required.name?required.name:'TBD'}</i>`;
        }).join('<br> ');
        const $icon = $('<i>')
            .addClass('far')
            .addClass('fa-question-circle')
            .addClass('mx-1')
            .addClass('popover-hover')
            .attr('data-bs-toggle', 'popover')
            .attr('data-bs-html', 'true')
            .attr('data-bs-custom-class', 'custom-requires-popover')
            .attr('data-bs-title', `Required: ${skill.require_num}`)
            .attr('data-bs-content', content)
            .appendTo($span);
    }

    return ({
        display: $span[0].outerHTML,
        '@data-search': search
    });
}

function getConflicts(skill, skills){
    let search = '';
    const $span = $('<span>');
    if (skill.conflicts && _.isArray(skill.conflicts) && skill.conflicts.length){
        search = skill.conflicts.map(source => {return (_.findWhere(skills, {id: source})).name;}).join(',');
        $span.text(skill.conflicts.length);
        const content = skill.conflicts.map(source => {
            const conflict = _.findWhere(skills, {id: source});
            return `<strong>${conflict.source?conflict.source.name:'unknown'}:</strong> <i>${conflict.name?conflict.name:'TBD'}</i>`;
        }).join('<br> ');
        const $icon = $('<i>')
            .addClass('far')
            .addClass('fa-question-circle')
            .addClass('mx-1')
            .addClass('popover-hover')
            .attr('data-bs-toggle', 'popover')
            .attr('data-bs-html', 'true')
            .attr('data-bs-custom-class', 'custom-requires-popover')
            .attr('data-bs-title', 'Conflicts')
            .attr('data-bs-content', content)
            .appendTo($span);
    }

    return ({
        display: $span[0].outerHTML,
        '@data-search': search
    });
}

function prepSkillForm($form){
    if (!$form.length) {
        return;
    }

    $form.find('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve',
        dropdownParent: $form,
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
                return $(data.element).data('text');
            }
        });
    });

    $form.find('.clearable-select2').select2({
        allowClear: true,
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve',
        placeholder:{id:'-1'},
        dropdownParent: $form,
    });

    $('#skill_name').on('focus', function(){
        if ($(this).val() === 'TBD'){
            $(this).select();
        }
    });

    $('.provides-row').each(function(idx){
        toggleProvidesFields($(this));
    });

    $('.skill-provides-type').on('change', function(){
        toggleProvidesFields($(this).closest('.provides-row'));
    });
    $('.skill-clone-btn').on('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        cloneSkill($(this).data('click-id'));

    });

    $('#skill_usage_id').on('change', updateSkillUsage).trigger('change');
    $('#skill_status_id').on('change', updateSkillStatus).trigger('change');
    prepProvides();

    $('#skill_requires').on('change', function(e){
        const val = $(this).val();
        if (val.length){
            if (Number($('#skill_require_num').val()) === 0){
                $('#skill_require_num').val(1).trigger('change');
            }
        } else {
            $('#skill_require_num').val(0).trigger('change');
        }
    });
}

function prepSourceForm($form){
    if (!$form.length) {
        return;
    }
    $form.find('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve',
        dropdownParent: $form,
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
                return $(data.element).data('text');
            }
        });
    });

    $form.find('.clearable-select2').select2({
        allowClear: true,
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve',
        placeholder:{id:'-1'},
        dropdownParent: $form,
    });

    $('.provides-row').each(function(idx){
        toggleProvidesFields($(this));
    });

    $('.skill-provides-type').on('change', function(){
        toggleProvidesFields($(this).closest('.provides-row'));
    });
    prepProvides();
}

function updateSkillUsage(e){
    const usage = $('#skill_usage_id').find(':selected').data('usage');
    if (usage && usage.display_uses){
        $('#uses-append').text(usage.usage_format);
        $('#skill-uses-container').show();

    } else {
        $('#skill-uses-container').hide();
    }
}

function updateSkillStatus(e){
    const status = $('#skill_status_id').find(':selected').data('status');
    if (status.display_to_pc && status.purchasable || !status.complete){
        $('#skill-available').hide();

    } else {
        $('#skill-available').show();
    }
}


function toggleProvidesFields($row){
    const type = $row.find('.skill-provides-type').val();
    switch (type){
        case 'attribute':
            $row.find('.skill-provides-name').attr('disabled', false).attr('placeholder', 'Attribute Name or [List, Of, Options]');
            $row.find('.skill-provides-value').attr('disabled', false).attr('placeholder', 'Attribute Value');
            break;
        case 'style':
        case 'language':
        case 'tagskill':
            $row.find('.skill-provides-name').attr('disabled', true).val('').attr('placeholder', '');
            $row.find('.skill-provides-value').attr('disabled', false).attr('placeholder', 'Name or [List, Of, Options]');
            break;
        case 'trait':
            $row.find('.skill-provides-name').attr('disabled', false).attr('placeholder', 'Trait Category');
            $row.find('.skill-provides-value').attr('disabled', false).attr('placeholder', 'Trait, "Custom", or [List, Of, Traits]');
            break;
        case 'diagnose':
            $row.find('.skill-provides-name').attr('disabled', true).val('').attr('placeholder', '');
            $row.find('.skill-provides-value').attr('disabled', false).attr('placeholder', 'List, Of, Traits');
            break;
        case 'skill':
            $row.find('.skill-provides-name').attr('disabled', true).val('').attr('placeholder', '');
            $row.find('.skill-provides-value').attr('disabled', false).attr('placeholder', 'Only for providing a [List, Of, Options]');
            break;
        case 'crafting':
            $row.find('.skill-provides-name').attr('disabled', false).attr('placeholder', 'Crafting Type');
            $row.find('.skill-provides-value').attr('disabled', false).val('1').attr('placeholder', 'Tiers (probably 1)');
            break;
        case 'rule':
            $row.find('.skill-provides-name').attr('disabled', true).val('').attr('placeholder', '');
            $row.find('.skill-provides-value').attr('disabled', true).val('').attr('placeholder', '');
            break;
        default:
            $row.find('.skill-provides-name').attr('disabled', true).val('').attr('placeholder', '');
            $row.find('.skill-provides-value').attr('disabled', true).val('').attr('placeholder', '');

            break;
    }
}

function prepProvides(){
    $('#provides-new').hide();
    $('.add-provides-btn').on('click', addProvides);
    $('.remove-provides-btn').confirmation({
        title: 'Delete this Provides'
    }).on('click', removeProvides);
}

function removeProvides(e){
    const $this = $(this);
    e.preventDefault();
    e.stopPropagation();
    $this.closest('.provides-row').remove();
}

function addProvides(e){
    const $this = $(this);
    e.preventDefault();

    const $new = $('#provides-new').clone();
    const id = nextIndex++;
    $new.attr('id', `provides-new-${id}`);

    // Update all provides fields
    $new.find('.provides-input').each(function(e) {
        const $input = $(this);
        const fieldtype = $input.data('fieldtype');
        const objtype = $input.data('objtype');
        $input.attr('id', `${objtype}_provides-new-${id}-${fieldtype}`);
        $input.attr('name', `${objtype}[provides][new-${id}][${fieldtype}]`);
        if ($input.data('required')){
            $input.attr('required', true);
        }
    });

    // Update all provides labels
    $new.find('.provides-label').each(function(e) {
        const $label = $(this);
        const fieldtype = $label.data('fieldtype');
        const objtype = $label.data('objtype');
        $label.attr('for', `${objtype}_provides-new-${id}-${fieldtype}`);
    });

    $new.find('.remove-provides-btn').confirmation({
        title: 'Delete this Provides'
    }).on('click', removeProvides);

    $new.find('select').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve',
        dropdownParent: $this.closest('form')
    });

    $new.find('.clearable-select2').select2({
        allowClear: true,
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve',
        placeholder:{id:'-1'},
        dropdownParent: $this.closest('form'),
    });

    $new.find('.skill-provides-type').on('change', function(){
        toggleProvidesFields($(this).closest('.provides-row'));
    });

    $new.appendTo('#provides-list');
    $new.show();

}
