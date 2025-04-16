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
    const types = (localStorage.getItem('cdb-user-type-filter')).split(',');
    $.fn.dataTable.ext.search.pop();
    $.fn.dataTable.ext.search.push(
        function(settings, data, dataIndex) {
            return types.indexOf($(table.row(dataIndex).node()).attr('data-type')) !== -1;
        }
    );
    table.draw();
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
    const columns = table.columns('.documentation-column');
    if (localStorage.getItem('cdb-user-documentation-filter') === 'true'){
        columns.visible(true);
    } else {
        columns.visible(false);
    }
    table.columns.adjust().responsive.recalc();
}
