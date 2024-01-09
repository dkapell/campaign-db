/* globals _ marked */
'use strict';

$(function(){
    $('.validator-select').on('change', updateValidationDisplay);
    updateValidationDisplay();
});

function updateValidationDisplay(){
    const options = {};
    $('.validator-select').each( function (e){
        const $this = $(this);
        const checked = !!$this.prop('checked');
        const type = $this.data('type');
        options[type] = checked;
    });

    $('#skill-validations').find('.list-group-item').each( function(e){
        const $this = $(this);
        let show = false;
        for (const type of $this.data('issues').split(',')){
            if (options[type]){
                console.log('showing because ' + type);
                show = true;
            }
        }
        if (show){
            $this.show();
        } else {
            $this.hide();
        }

    });
}
