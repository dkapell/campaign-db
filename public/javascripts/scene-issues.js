/* globals validateScenes showError*/

$(function(){
    if (localStorage.getItem('cdb-scheduler-show-ignored-issues')){
        $('#showIgnoredIssues').prop('checked', localStorage.getItem('cdb-scheduler-show-ignored-issues')==='true');
    }
    $('#showIgnoredIssues').on('change', updateIgnoredIssueList).trigger('change');
    $('#issues-table tbody').on('click', '.issue-ignore-btn', updateIssue);
});

function updateIgnoredIssueList(e){
    const table = $('#issues-table').DataTable();
    if($(this).is(':checked')){
        $.fn.dataTable.ext.search.pop();
    } else {
        $.fn.dataTable.ext.search.push(
            function(settings, data, dataIndex) {
                return $(table.row(dataIndex).node()).attr('ignored') !== 'true';
            }
        );
    }
    localStorage.setItem('cdb-scheduler-show-ignored-issues', $(this).is(':checked'));
    table.draw();
}

async function updateIssue(e){
    e.preventDefault();
    const $row = $(this).closest('tr');
    const issueId = $(this).data('issue-id');
    const status = $(this).data('status');
    const eventId = $(this).data('event-id');
    const url = `/event/${eventId}/issue/${issueId}/${status}`;
    const result = await fetch(url, {
        method:'PUT',
        headers: {
            'CSRF-Token': $('#csrfToken').val(),
        }
    });
    const data = await result.json();
    if (data.success){
        $row.attr('ignored', data.issue.ignored?'true':'false');
        $('#showIgnoredIssues').trigger('change');
        if (typeof validateScenes === 'function'){
            validateScenes([data.issue.scene_id]);
        }
    } else if (typeof showError === 'function'){
        showError(data.message);
    } else {
        console.error(data.message);
    }
}
