/* globals _ editFormTemplate newFormTemplate marked*/
'use strict';

$(function(){
    prepEntryForm($('#glossaryEntryForm'));
    $('[data-bs-toggle="tooltip"]').tooltip({
        container: 'body',
        placement: 'right',
        delay: { 'show': 500, 'hide': 100 }
    });
    $('.entry-body').hover(showEntryEdit, hideEntryEdit);
    $('.nav-link').click(scrollToItem);
    $('.glossary-anchor-link').click(scrollToItem);
    $('.menu-type-header').click(scrollToItem);
    $('a.no-click').click(function(e){
        e.preventDefault();
    });


    var scroll_pos = 0;
    $(document).scroll(function() {
        scroll_pos = $(this).scrollTop();
        if(scroll_pos > 80) {
            $('#glossaryMenuLabel')
                .addClass('h3')
                .addClass('mb-1')
                .removeClass('mb-3');


        } else {
            $('#glossaryMenuLabel')
                .removeClass('h3')
                .addClass('mb-3')
                .removeClass('mb-1');

        }
    });
});

function scrollToItem(){
    const divId = $(this).attr('href');
    if ($(divId).length){
        $('html, body').animate({
            scrollTop: $(divId).offset().top - 75
        }, 100);
    }
}


function prepEntryForm($form){
    $form.find('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve'
    });

    $form.find('.tag-select2').select2({
        theme:'bootstrap-5',
        closeOnSelect: false,
        placeholder: $( this ).data( 'placeholder' ),
        width: $( this ).data( 'width' ) ? $( this ).data( 'width' ) : $( this ).hasClass( 'w-100' ) ? '100%' : 'style',
        tags: true,
        tokenSeparators: [','],
        allowClear: true
    });

    $form.find('.complex-select2').each(function(e){
        const $select = $(this);
        $select.select2({
            theme:'bootstrap-5',
            minimumResultsForSearch: 6,
            width:'resolve',
            escapeMarkup: function(markup) {
                return markup;
            },
            templateResult: function(data) {
                return $(data.element).data('html');
            },
            templateSelection: function(data) {
                return $(data.element).data('text');
            }
        });
    });
}

function showEntryEdit(e){
    $(this).addClass('border-info');
    $(this).removeClass('border-white');
    $(this).find('.entry-edit-btn').removeClass('invisible');
}
function hideEntryEdit(e){
    $(this).addClass('border-white');
    $(this).removeClass('border-info');
    $(this).find('.entry-edit-btn').addClass('invisible');
}


