/* globals Datepicker */
$(function(){
     $('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve'
    });


   const validFromDateElem = document.getElementById('documentation_valid_from_date');
   const validDateElems = document.querySelectorAll('.date-input');
   if ( typeof Datepicker !== 'undefined'){
        if (validFromDateElem){
            const datePicker = new Datepicker(validFromDateElem, {
                buttonClass: 'btn',
                format: 'yyyy-mm-dd'
            });
        }

        validDateElems.forEach(elem => {
            const datePicker = new Datepicker(elem, {
                buttonClass: 'btn',
                format: 'yyyy-mm-dd'
            });
        });
    }
});
