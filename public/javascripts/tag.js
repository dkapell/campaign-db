$(function(){
   $('.tag-select2').select2({
       theme:'bootstrap-5',
       closeOnSelect: false,
       placeholder: $( this ).data( 'placeholder' ),
       width: $( this ).data( 'width' ) ? $( this ).data( 'width' ) : $( this ).hasClass( 'w-100' ) ? '100%' : 'style',
       tags: true,
       tokenSeparators: [',']
   });
});
