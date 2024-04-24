/* globals _ editFormTemplate newFormTemplate marked*/
'use strict';

$(function(){
    $('.skill-link').click(scrollToItem);
});

function scrollToItem(){
    const divId = $(this).attr('href');
    if ($(divId).length){
        $('html, body').animate({
            scrollTop: $(divId).offset().top - 75
        }, 100);
    }
}
