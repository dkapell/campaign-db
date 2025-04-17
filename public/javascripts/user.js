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
