/* globals marked _ */
$(function(){

    $('.audit-table').each(prepAuditTable);
    $('.skill-audit-table').each(prepSkillAuditTable);

    $('a[data-bs-toggle="tab"]').on( 'shown.bs.tab', function (e) {
        $.fn.dataTable.tables( {visible: true, api: true} ).columns.adjust();
    });

    $('.audit-table  tbody').on('click', '.clickable-row', clickRow);

    $('.audit-table tbody').on('click', '.action-btn', function(e){
        e.stopPropagation();
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

function prepAuditTable(){
    const $table = $(this);
    $table.DataTable({
        paging: true,
        scrollCollapse: true,
        stateSave: true,
        deferRender: true,
        lengthMenu: [10, 20, 50, 100],
        pageLength: 20,
        responsive: false,
        searching: false,
        ordering: true,
        order: [[0, 'desc']],
        ajax: {
            url: '/audit/query',
            dataSrc: 'data'
        },
        serverSide:true,
        columns: [
            { data: 'createdFormated', },
            { data: 'user.name' },
            { data: 'action' },
            { data: 'object_type' },
            { data: 'object_id', orderable: false },
            {
                data: null,
                orderable: false,
                render: function(data, type, row, meta) {
                    if (row.object){
                        const $a = $('<a>')
                            .prop('href', `/${row.object_type}/${row.object_id}`)
                            .text(row.object.name?row.object.name:row.object.content);
                        return $a.prop('outerHTML');
                    }
                    if (row.data.old && _.has(row.data.old, 'name')){
                        return row.data.old.name;
                    }
                    else if (row.data.old && _.has(row.data.old, 'content')){
                        return row.data.old.content;
                    }

                    if (row.data.new && _.has(row.data.new, 'name')){
                        return row.data.new.name;
                    }
                    else if (row.data.new && _.has(row.data.new, 'content')){
                        return row.data.new.content;
                    }


                    return '<i>Unknown</i>';
                }
            },
            {
                data: 'diff',
                orderable: false,
                render: function(data, type, row, meta) {
                    if (!data){
                        return '';
                    }
                    if (!data.length){
                        return '<i>No Changes</i>';
                    }

                    return data.map(diffFormatter).join('<br>');
                }
            }
        ],
        drawCallback: function(){
            $table.find('tbody').show();
            $table.DataTable().columns.adjust().responsive.recalc();
            $('#tableLoading').hide();
        },
        createdRow: function(row){
            $(row).children(':nth-child(7)').addClass('text-wrap');

        }
    });
}

function prepSkillAuditTable(){
    const $table = $(this);
    $table.DataTable({
        paging: true,
        scrollCollapse: true,
        stateSave: true,
        deferRender: true,
        lengthMenu: [ [10, 20, 50, 100, -1], [10, 20, 50, 100, 'All'] ],
        pageLength: 20,
        responsive: false,
        drawCallback: function(){
            $table.find('tbody').show();
            $table.DataTable().columns.adjust().responsive.recalc();
            $('#tableLoading').hide();
        }
    });
}

function clickRow(e){
    e.preventDefault();
    if ($(e.target).hasClass('dtr-control')){
        return;
    }
    var object = $(this).attr('data-click-object');
    var id = $(this).attr('data-click-id');
    window.location.href='/'+ object + '/' + id;
}


function diffFormatter(diffRow){
    switch(diffRow.type){
        case 'status':
            return `<strong>${diffRow.field} ${diffRow.status}</strong>`;

        case 'field':
            return `<strong>${diffRow.field}</strong>: ${diffRow.old?diffRow.old:'unset'} -> ${diffRow.new?diffRow.new:'unset'}`;

        case 'text':{
            let $output = $('<span>');
            for (const part of diffRow.text){
                const $span = $('<span>')
                    .text(part.text)
                    .css('color', part.color);
                $output.append($span);
            }

            return `<strong>${diffRow.field}</strong>: ${marked.parseInline($output.prop('outerHTML'), {breaks: true})}`;
        }
        case 'longtext': {
            let $output = $('<span>');
            for (const part of diffRow.text){
                const $span = $('<span>')
                    .text(part.text)
                    .css('color', part.color);

                $output.append($span);
            }
            return `<strong>${diffRow.field}</strong>: ${marked.parse($output.prop('outerHTML'), {breaks: true})}`;

        }
        case 'tags': {
            return `<strong>${diffRow.field}</strong>: ${diffRow.tags.join(', ')}`;
        }

        default:
            return null;
    }

}
