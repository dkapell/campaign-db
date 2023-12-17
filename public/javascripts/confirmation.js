'use strict';
(function ( $ ) {
    $.fn.confirmation = function confirmation(options){
        this.on('click', function(e){
            if(confirm(options.title)){
                return;
            } else {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
        });
        return this;
    };
}( jQuery ));
