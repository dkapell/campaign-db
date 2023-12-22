$(function(){

    $('.data-table').each(prepDataTable);

    $('a[data-bs-toggle="tab"]').on( 'shown.bs.tab', function (e) {
        $.fn.dataTable.tables( {visible: true, api: true} ).columns.adjust();
    });

    $('.data-table  tbody').on('click', '.clickable-row', clickRow);

    $('#exportCSV').click(exportCSV);

    /*$('.delete-btn').confirmation({
        title: 'Delete this item'
    }).on('click', deleteItem);
    */
    $('.data-table tbody').on('click', '.action-btn', function(e){
        e.stopPropagation();
    });
});

function prepDataTable(){
    const $table = $(this);
    const options = {
        paging: true,
        scrollCollapse: true,
        stateSave: true,
        lengthMenu: [ [10, 20, 50, 100, -1], [10, 20, 50, 100, 'All'] ],
        pageLength: 20,
        responsive: {
            details: {
                type: 'column'
            }
        },
        columnDefs: [
            {
                className: 'dtr-control',
                orderable: false,
                targets:   0
            }
        ],
        drawCallback: function(){
            $table.find('.delete-btn').confirmation({
                title: 'Delete this item'
            }).on('click', deleteItem);
        }
    };

    if ($table.hasClass('table-orderable')){
        options.stateSave = false;
        options.rowReorder= {
            selector: 'td.reorder',
            dataSrc: 2
        };


        options.columnDefs.push({
            className: 'reorder',
            //orderable: true,
            targets:   'sort-handle',
            render: () => {
                const $i = $('<i>').addClass('fa').addClass('fa-bars');
                return $i[0].outerHTML;},
        });
        options.columnDefs.push({ orderable: false, targets: '_all' });
        options.order = [[2,'asc']];
    }

    const dt = $table.DataTable(options);

    if ($table.hasClass('table-orderable')){
        dt.column(1).visible(false);
        const $orderSwitch = $('<div>')
            .addClass('form-check')
            .addClass('form-switch')
            .attr('title', 'Enable reordering of items')
            .tooltip({delay: { 'show': 300, 'hide': 100 }, trigger:'hover'})
            .on('click', function(e){ $orderSwitch.blur();});

        $orderSwitch.append($('<input>')
            .addClass('form-check-input')
            .attr('id', 'orderSwitch')
            .attr('type', 'checkbox')
        );

        $orderSwitch.append($('<label>')
            .addClass('control-label')
            .attr('for', 'orderSwitch')
            .text('Reorder')
        );

        const $orderSwitchContainer = $('<div>')
            .attr('id', 'orderSwitchContainer')
            .addClass('rounded-pill')
            .addClass('px-2')
            .addClass('pt-1')
            .addClass('float-end')
            .append($orderSwitch);

        $('.dataTables_length').append($orderSwitchContainer);

        $orderSwitch.on('change', function(e){
            if ($(this).find('input').prop('checked')){
                dt.column(1).visible(true);
                $('#orderSwitchContainer').addClass('text-bg-warning');
            } else {
                dt.column(1).visible(false);
                $('#orderSwitchContainer').removeClass('text-bg-warning').removeClass('text-white');
            }
        });


        dt.on('row-reorder', async function (e, diff, edit) {
            const updates = [];

            for (var i = 0, ien = diff.length; i < ien; i++) {
                let rowData = dt.row(diff[i].node).data();
                updates.push({
                    id: Number(rowData[1]),
                    display_order: Number(diff[i].newData)
                });
            }
            const object = $table.data('orderable-object');
            const csrfToken = $table.data('csrf');
            const url = `/${object}/order`;
            console.log(updates);
            await fetch(url, {
                method:'PUT',
                redirect:'manual',
                body:JSON.stringify(updates),
                headers: {
                    'CSRF-Token': csrfToken,
                    'Content-Type': 'application/json'
                }
            });

        });
    }


    $table.show();
    $table.DataTable().columns.adjust().responsive.recalc();
    if ($table.closest('.table-responsive').find('.table-loading').length){
        $table.closest('.table-responsive').find('.table-loading').hide();
    } else {
        $('#tableLoading').hide();
    }
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

function exportCSV(e){
    const query = { export:true };
    if ($('#exportCSV').val()){
        query.search = $('#pager-search').val();
    }
    const url = window.location.href + '?' + $.param(query);
    e.preventDefault();
    window.open(url, '_self');
    $(this).blur();
}

async function deleteItem(e){
    e.preventDefault();
    e.stopPropagation();
    const $this = $(this);
    const url = $this.attr('url');
    const result = await fetch(url, {method:'DELETE', redirect:'manual'});
    if($this.attr('data-back')){
        location = $this.attr('data-back');
    } else {
        location.reload();
    }
}
