/* globals DateRangePicker */
$(function(){
    $('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve'
    });

    const elem = document.getElementById('event_dates');
    if (typeof DateRangePicker !== 'undefined'){
        const rangepicker = new DateRangePicker(elem, {
            inputs: [document.getElementById('event_start_time'), document.getElementById('event_end_time')],
            buttonClass: 'btn',
            format: 'yyyy-mm-dd'
        });
    }

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
            }
        });
    });
    $('[data-bs-toggle="popover"]').popover({
        trigger: 'hover'
    });
    $('[data-bs-toggle="tooltip"]').tooltip();

    $('#attendance_user_id').on('change', updateCharacterPicker);
    $('#event-unregister-btn').confirmation({
        title: 'Unregister from this event?'
    }).on('click', deleteAttendance);
});


async function updateCharacterPicker(e){
    const $this = $(this);
    const userId = $this.val();

    const result = await fetch(`/user/${userId}/characters`);
    const data = await result.json();

    const characters = data.characters.map( character => {

        return {
            id: character.id,
            text: character.active?`${character.name} <span class="badge text-bg-success ms-1">Active</badge>`:character.name,
            selected: character.active,
            html: character.active?`${character.name} <span class="badge text-bg-success ms-1">Active</badge>`:character.name
        };
    });

    $('#attendance_character_id').empty().select2({
        data: characters,
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve',
        templateResult: function(data) {
            return data.html;
        },
        templateSelection: function(data) {
            return data.text;
        },
        escapeMarkup: function(markup) {
            return markup;
        },

    }).trigger('change');

    if (data.user.type === 'player'){
        $('#characterPicker').show();
    } else {
        $('#characterPicker').hide();

    }
}

async function deleteAttendance(e){
    e.preventDefault();
    e.stopPropagation();


    const $this = $(this);
    $this.tooltip('hide');
    const url = $this.attr('url');

    const csrfToken = $this.data('csrf');
    const result = await fetch(url, {
        method:'DELETE',
        headers: {
            'CSRF-Token': csrfToken
        },
        redirect:'manual'
    });

    if($this.attr('data-back')){
        location = $this.attr('data-back');
    } else {
        location.reload();
    }
}

