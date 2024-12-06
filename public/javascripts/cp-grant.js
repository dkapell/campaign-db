/* globals marked */
$(function(){
    $('[data-bs-toggle="tooltip"]').tooltip();
    $('.cp-approve-btn').confirmation({ title: 'Approve this grant?'
    }).on('click', approveGrant);
    $('.cp-deny-btn').confirmation({ title: 'Deny this grant?'
    }).on('click', denyGrant);
    $('#pending-filter').on('change', togglePendingFilter);
    if (localStorage.getItem('cdb-pending-grant-switch') === 'true'){
        $('#pending-filter').prop('checked', true);
    } else {
        $('#pending-filter').prop('checked', false);
    }
    togglePendingRows();

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

async function denyGrant(e){
    e.preventDefault();
    e.stopPropagation();

    const $this = $(this);
    const grantId = $this.data('id');

    const csrfToken = $this.data('csrf');
    const result = await fetch(`/cp_grant/${grantId}/deny`, {
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

function togglePendingFilter(){
    if ($(this).prop('checked')){
        localStorage.setItem('cdb-pending-grant-switch', 'true');
    } else {
        localStorage.removeItem('cdb-pending-grant-switch');
    }
    togglePendingRows();
}

function togglePendingRows(){
    const $table = $('#grant-table').DataTable();
    if (localStorage.getItem('cdb-pending-grant-switch') === 'true'){
        $.fn.dataTable.ext.search.push(
            function(settings, data, dataIndex) {
                return $($table.row(dataIndex).node()).attr('data-status') === 'pending';
            }
        );
        $table.draw();
    } else {
        $.fn.dataTable.ext.search.pop();
        $table.draw();
    }
}
