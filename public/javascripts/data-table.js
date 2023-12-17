$(function(){

    $('.table-sorted').each(prepSortedTable);
    $('.data-table').each(prepDataTable);

    $('a[data-bs-toggle="tab"]').on( 'shown.bs.tab', function (e) {
        $.fn.dataTable.tables( {visible: true, api: true} ).columns.adjust();
    });

    $('.table-sorted  tbody').on('click', '.clickable-row', clickRow);
    $('.data-table  tbody').on('click', '.clickable-row', clickRow);

    $('.table-sorted').show();
    $('.table-sorted-loading').hide();

    $('#exportCSV').click(exportCSV);

    /*$('.delete-btn').confirmation({
        title: 'Delete this item'
    }).on('click', deleteItem);
    */
    $('.data-table tbody').on('click', '.action-btn', function(e){
        e.stopPropagation();
    });
    $('.table-sorted tbody').on('click', '.action-btn', function(e){
        e.stopPropagation();
    });
});

function prepSortedTable(){
    const $table = $(this);
    $table.DataTable({
        paging: true,
        scrollY:        500,
        scrollCollapse: true,
        stateSave: true,
        responsive: {
            details: {
                type: 'column'
            }
        },
        columnDefs: [ {
            className: 'dtr-control',
            orderable: false,
            targets:   0
        } ],
        drawCallback: function(){
            $table.find('.delete-btn').confirmation({
                title: 'Delete this item'
            }).on('click', deleteItem);
        }
    });
    $table.show();

    $table.DataTable().columns.adjust().responsive.recalc();

    $('#tableLoading').hide();
}

function prepDataTable(){
    const $table = $(this);
    $table.DataTable({
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
        columnDefs: [ {
            className: 'dtr-control',
            orderable: false,
            targets:   0
        } ],
        drawCallback: function(){
            $table.find('.delete-btn').confirmation({
                title: 'Delete this item'
            }).on('click', deleteItem);
        }
    });


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
