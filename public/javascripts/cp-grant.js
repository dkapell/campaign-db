/* globals marked */
$(function(){
    $('[data-bs-toggle="tooltip"]').tooltip();
    $('.cp-approve-btn').confirmation({ title: 'Approve this grant?'
    }).on('click', approveGrant);
    $('#unapproved-filter').on('change', toggleUnapprovedFilter);
    if (localStorage.getItem('cdb-unapproved-grant-switch') === 'true'){
        $('#unapproved-filter').prop('checked', true);
    } else {
        $('#unapproved-filter').prop('checked', false);
    }
    toggleUnapprovedRows();

});

async function approveGrant(e){
    e.preventDefault();
    e.stopPropagation();

    const $this = $(this);
    const grantId = $this.data('id');

    const csrfToken = $this.data('csrf');
    const result = await fetch(`/cp_grant/${grantId}/approve`, {
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

function toggleUnapprovedFilter(){
    if ($(this).prop('checked')){
        localStorage.setItem('cdb-unapproved-grant-switch', 'true');
    } else {
        localStorage.removeItem('cdb-unapproved-grant-switch');
    }
    toggleUnapprovedRows();
}

function toggleUnapprovedRows(){
    const $table = $('#grant-table').DataTable();
    if (localStorage.getItem('cdb-unapproved-grant-switch') === 'true'){
        $.fn.dataTable.ext.search.push(
            function(settings, data, dataIndex) {
                return $($table.row(dataIndex).node()).attr('data-approved') === 'no';
            }
        );
        $table.draw();
    } else {
        $.fn.dataTable.ext.search.pop();
        $table.draw();
    }
}
