/* global _ */
$(document).ready(function () {
    $('.gallery-filter').on('change', updateGalleryFilter);
    loadGalleryFilter();
    $('#gallerySearch').on('input', gallerySearch);
});

function loadGalleryFilter(){
    const types = JSON.parse(localStorage.getItem('cdb-gallery-type-filter'));
    if (types){
        for (const type in types){
            if (types[type]){
                $(`.gallery-type-${type}`).show();
                $(`#gallery-type-filter-${type}`).prop('checked', true);
            } else {
                $(`.gallery-type-${type}`).hide();
                $(`#gallery-type-filter-${type}`).prop('checked', false);
            }
        }
    }
    gallerySearch();
}

function updateGalleryFilter(){
    const types = {};
    $('.gallery-filter').each(function(e){
        const $this = $(this);
        const val = $this.is(':checked');
        const type = $this.data('type');
        if (val){
            $(`.gallery-type-${type}`).show();

        } else {
            $(`.gallery-type-${type}`).hide();
        }
        types[type] = val;
    });
    if (_.keys(types).length){
        localStorage.setItem('cdb-gallery-type-filter', JSON.stringify(types));
    }
    gallerySearch();
}

function gallerySearch(){
    const query = $('#gallerySearch').val().toUpperCase();
    let shown = 0;
    $('.gallery-item').each(function(){
        const $item = $(this);
        if (!$(`#gallery-type-filter-${$item.data('type')}`).is(':checked')){
            return;
        }

        if (! query || query === ''){
            $item.show();
            shown++;
        } else if ($item.data('name').includes(query) || $item.data('charactername').includes(query)){
            $item.show();
            shown++;
        } else {
            $item.hide();
        }
    });

    if (!shown){
        $('#noResults').show();
        $('#resultsContainer').hide();
    } else {
        console.log('hiding');
        $('#noResults').hide();
        $('#resultsContainer').show();
    }
}
