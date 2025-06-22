/* globals prepDataTable issueslistTemplate validateScenes */
/* globals _ splitDetailPanel fullDetailPanel closeDetailPanel highlightScene showError hideMessages */
$(function(){
    $('#show-issues-btn').on('click', showIssuesBtn);
});

async function showIssuesBtn(e){
    e.preventDefault();
    $(this).tooltip('hide');
    $('.users-btn').removeClass('active');
    $(this).addClass('active');
    if ($('#bottom-panel').attr('type') === 'issues' &&
        $('#detail-container').hasClass('show')){
        closeDetailPanel();
        return;
    }

    $('#bottom-panel').find('.content').hide();
    $('#bottom-panel').find('.panel-loading').show();
    $(this).find('i.fas')
        .removeClass('fa-tasks')
        .addClass('fa-spin')
        .addClass('fa-sync');

    const sceneIds = [];
    $('.scene-item').each(function(){
        if (!$(this).data('busy')){
            sceneIds.push($(this).data('scene-id'));
        }
    });
    const url = `/event/${$('#eventId').val()}/scene/validate?`;
    const result = await fetch(url + new URLSearchParams({
        scenes: _.uniq(sceneIds)
    }).toString());

    const data = await result.json();

    if (data.success){

        const $panel = $('#bottom-panel');
        $panel.attr('timeslot-id', null);
        $panel.attr('type', 'issues');
        $panel.attr('scenes', JSON.stringify([]));
        $panel.find('.title').text('Issue List');
        $panel.find('.content').html(issueslistTemplate(data)).show();
        $panel.find('.content').find('[data-bs-toggle="tooltip"]').tooltip({
            delay: { 'show': 300, 'hide': 100 },
        });

        $panel.find('.data-table').each(prepDataTable);
        if (localStorage.getItem('cdb-scheduler-show-ignored-issues')){
            $panel.find('#showIgnoredIssues').prop('checked', true);
        }
        $panel.find('#showIgnoredIssues').on('change', updateIgnoredIssueList).trigger('change');
        $panel.find('#issues-table tbody').on('click', '.issue-ignore-btn', updateIssue);
        $panel.find('#issues-table tbody').on('click', 'a.scene-link', function(e){
            e.preventDefault();
            const sceneId = $(this).data('scene-id');
            highlightScene(sceneId);

        });

        $panel.find('.panel-loading').hide();

        $(this).find('i.fas')
            .addClass('fa-tasks')
            .removeClass('fa-spin')
            .removeClass('fa-sync');

        if (!$('#detail-container').hasClass('show')){
            await splitDetailPanel(50);
            $panel.find('.data-table').DataTable().columns.adjust().responsive.recalc();
        }

    } else {
        showError(data.message);
    }
}

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
    const eventId = $('#eventId').val();
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
        validateScenes([data.issue.scene_id]);
    } else {
        showError(data.message);
    }
}

