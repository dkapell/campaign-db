/* globals showSuccess collapseScenes confirmScene updateAllSlots validateAllScenes updateSceneStatus showUsersBtn collapseAllScenes*/
/* globals _ splitDetailPanel fullDetailPanel closeDetailPanel showError hideMessages */

$(function(){
    $('[data-bs-toggle="tooltip"]').tooltip({
        delay: { 'show': 300, 'hide': 100 },
    });

    $('#schedule-snapshot-btn').confirmation({
        title:'Take Snapshot?'
    }).on('click', takeSnapshot);

    $('.schedules-table').on('click', '.schedule-action-btn', runScheduleAction);
});

async function runScheduleAction(e){
    e.preventDefault();
    e.stopPropagation();
    const $this = $(this);
    const csrfToken = $this.data('csrf');
    const url = $this.attr('url');
    const result = await fetch(url, {
        headers: {
            'CSRF-Token': csrfToken,
            'Content-Type': 'application/json'
        },
        method:'PUT',
        redirect:'manual',
    });
    location.reload();
}

async function takeSnapshot(e){
    e.preventDefault();
    e.stopPropagation();
    const $this = $(this);
    const csrfToken = $this.data('csrf');
    const url = $this.attr('url');

    const result = await fetch(url, {
        headers: {
            'CSRF-Token': csrfToken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({name:$('#schedule-snapshot-name').val()}),
        method:'POST',
        redirect:'manual',
    });
    location.reload();
}
