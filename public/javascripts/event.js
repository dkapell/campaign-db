$(function(){
     $('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve'
    });

    const elem = document.getElementById('event_dates');
    const rangepicker = new DateRangePicker(elem, {
        inputs: [document.getElementById('event_start_time'), document.getElementById('event_end_time')],
        buttonClass: 'btn',
        format: 'yyyy-mm-dd'
    });
});
