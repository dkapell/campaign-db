$(function(){
     $('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve'
    });

    $('.complex-select2').each(function(e){
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
                if (data.id === '') {
                    return $select.data('placeholder');
                }
                return $(data.element).data('text');
            },
            matcher: function(params, data){
                if ($.trim(params.term) === '') {
                    return data;
                }

                if (typeof data.text === 'undefined') {
                  return null;
                }

                if (_.has(data.element.attributes, 'data-search')){
                    const search = data.element.attributes.getNamedItem('data-search').value;
                    if (search.toUpperCase().indexOf(params.term.toUpperCase()) > -1) {
                        return data;
                    }
                }

                return null;
            }
        }).maximizeSelect2Height({cushion: 15});
    });

    $('.complex-search-select2').each(function(e){
        const $select = $(this);
        $select.select2({
            theme:'bootstrap-5',
            minimumResultsForSearch: 1,
            width:'resolve',
            escapeMarkup: function(markup) {
                return markup;
            },
            templateResult: function(data) {
                return $(data.element).data('html');
            },
            templateSelection: function(data) {
                if (data.id === '') {
                    return $select.data('placeholder');
                }
                return $(data.element).data('text');
            },
            matcher: function(params, data){
                if ($.trim(params.term) === '') {
                    return data;
                }

                if (typeof data.text === 'undefined') {
                  return null;
                }

                if (_.has(data.element.attributes, 'data-search')){
                    const search = data.element.attributes.getNamedItem('data-search').value;
                    if (search.toUpperCase().indexOf(params.term.toUpperCase()) > -1) {
                        return data;
                    }
                }

                return null;
            }

        }).maximizeSelect2Height({cushion: 15});
    });
});
