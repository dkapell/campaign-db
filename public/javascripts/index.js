$(function(){
    $('[data-bs-toggle="tooltip"]').tooltip({
        delay: { 'show': 100, 'hide': 100 },
        placement:'auto'
    });
    $('#release-schedule-lock-btn').confirmation({}).on('click', releaseSchedulerLockBtn);
});

async function releaseSchedulerLockBtn(e){
    e.preventDefault();
    const url = '/admin/campaign/schedule/release';
    const result = await fetch(url, {
        method: 'PUT',
        headers: {
            'CSRF-Token': $(this).data('csrf'),
            'Content-Type': 'application/json'
        },
    });
    const data = await result.json();
    if (data.success){
        location.reload();
    }
}
