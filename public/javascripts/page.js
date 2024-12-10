$(function(){
    prepPageForm($('#pageForm'));
});

function prepPageForm($form){
    $form.find('.tag-select2').select2({
        theme:'bootstrap-5',
        closeOnSelect: false,
        placeholder: $( this ).data( 'placeholder' ),
        width: $( this ).data( 'width' ) ? $( this ).data( 'width' ) : $( this ).hasClass( 'w-100' ) ? '100%' : 'style',
        tags: true,
        tokenSeparators: [','],
        allowClear: true
    });
    $form.find('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve'
    });

}
