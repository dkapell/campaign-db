$(function(){
    $('.resizer-close').on('click', function(e){
        closeDetailPanel();
    });

    $('.resizer-expand').on('click', function(){
        fullDetailPanel();
    });
    $('.resizer-restore').on('click', function(){
        splitDetailPanel();
    });

    $('.resizer').each(function(){
        resizable($(this)[0]);
    });
    $('[data-bs-toggle="tooltip"]').tooltip({
        delay: { 'show': 300, 'hide': 100 },
    });

});

async function closeDetailPanel(){
    new Promise((resolve, reject) => {
        if (!$('#detail-container').hasClass('show')){
            return;
        }

        $('#top-panel')
            .removeClass('d-none')
            .addClass('d-flex')

            .animate({height:'100%'}, 200);

        $('#detail-container')
            .trigger('closing')
            .addClass('d-none')
            .removeClass('show')
            .css({overflow:'hidden'})
            .animate({height:'0'}, 200, ()=>{
                $('#detail-container').trigger('closed');
                resolve();
            });
    });
}

async function fullDetailPanel(hideAdjust, hideClose = false){
    new Promise((resolve, reject)=>{
        let minSize = 0;
        if ($('#top-panel').attr('min-size')){
            minSize = $('#top-panel').attr('min-size');
        }
        $('#top-panel')
            .removeClass('d-none')
            .addClass('d-flex')
            .animate({height:`${minSize}%`}, 200);
        if(hideAdjust){
            $('#detail-container').addClass('d-none');
        } else {
            $('#detail-container').removeClass('d-none');
        }

        if (hideClose){
            $('#detail-container >> .resizer-close').addClass('d-none');
        } else {
            $('#detail-container >> .resizer-close').removeClass('d-none');
        }
        $('#detail-container .resizer-expand').hide();
        $('#detail-container .resizer-restore').show();
        $('#detail-container')
            .trigger('opening')
            .removeClass('d-none')
            .addClass('show')
            .css({overflow:'visible', display:'block'})
            .animate({height:`${100-minSize}%`}, 200, ()=>{
                $('#detail-container').trigger('opened');
                resolve();
            });
    });
}

async function splitDetailPanel(percent=40, hideClose = false){
    new Promise((resolve, reject) => {
        if (hideClose){
            $('#detail-container .resizer-close').addClass('d-none');
        } else {
            $('#detail-container .resizer-close').removeClass('d-none');
        }

        $('#detail-container .resizer-expand').show();
        $('#detail-container .resizer-restore').hide();
        $('#top-panel')
            .removeClass('d-none')
            .addClass('d-flex')
            .show()
            .animate({height:`${100-percent}%`}, 200);

        $('#detail-container')
            .trigger('opening')
            .removeClass('d-none')
            .addClass('show')
            .css({overflow:'visible', display:'block'})
            .show();

        if(!$('#detail-container').hasClass('show')){
            $('#detail-container').css({height:'0%'});
        }
        $('#detail-container .resizer-expand').show();
        $('#detail-container .resizer-restore').hide();
        $('#detail-container').animate({height:`${percent}%`}, 200, () => {
            $('#detail-container').trigger('opened');
            resolve();
        });
    });
}

function resizable(resizer) {
    const direction = resizer.getAttribute('data-direction') || 'horizontal';
    const prevSibling = resizer.parentElement.previousElementSibling;
    const nextSibling = resizer.parentElement;
    const minSize = Number(prevSibling.getAttribute('min-size'));
    // The current position of mouse
    let x = 0;
    let y = 0;
    let prevSiblingHeight = 0;
    let prevSiblingWidth = 0;

    // Handle the mousedown event
    // that's triggered when user drags the resizer
    const mouseDownHandler = function(e) {
        // Get the current mouse position
        x = e.clientX;
        y = e.clientY;
        const rect = prevSibling.getBoundingClientRect();
        prevSiblingHeight = rect.height;
        prevSiblingWidth = rect.width;

        // Attach the listeners to `document`
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    };

    const mouseMoveHandler = function(e) {
        // How far the mouse has been moved
        const dx = e.clientX - x;
        const dy = e.clientY - y;


        switch (direction) {
            case 'vertical':{
                let h = (prevSiblingHeight + dy) * 100 / prevSibling.parentNode.getBoundingClientRect().height;
                if (minSize && h < minSize){
                    h = minSize;
                }

                prevSibling.style.height = `${h}%`;
                nextSibling.style.height = `${100-h}%`;
                break;
            }
            case 'horizontal':
            default:{
                let w = (prevSiblingWidth + dx) * 100 / resizer.parentNode.getBoundingClientRect().width;
                if (minSize && w < minSize){
                    w = minSize;
                }
                prevSibling.style.width = `${w}%`;
                break;
            }
        }

        const cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
        resizer.style.cursor = cursor;
        document.body.style.cursor = cursor;

        prevSibling.style.userSelect = 'none';
        prevSibling.style.pointerEvents = 'none';

        nextSibling.style.userSelect = 'none';
        nextSibling.style.pointerEvents = 'none';
        if (direction === 'vertical'){
            if (parseInt(prevSibling.style.height) < (minSize+3)){
                $(resizer).find('.resizer-expand').hide();
                $(resizer).find('.resizer-restore').show();
            } else {
                $(resizer).find('.resizer-expand').show();
                $(resizer).find('.resizer-restore').hide();
            }
        }
    };

    const mouseUpHandler = function() {
        resizer.style.removeProperty('cursor');
        document.body.style.removeProperty('cursor');

        prevSibling.style.removeProperty('user-select');
        prevSibling.style.removeProperty('pointer-events');

        nextSibling.style.removeProperty('user-select');
        nextSibling.style.removeProperty('pointer-events');

        // Remove the handlers of `mousemove` and `mouseup`
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
        if (parseInt(nextSibling.style.height) < 10){
            closeDetailPanel();
        }
    };

    // Attach the handler
    resizer.addEventListener('mousedown', mouseDownHandler);

    resizer.addEventListener('dblclick', function(){
        const height = parseInt($('#top-panel')[0].style.height);
        if ( height < (minSize+5)){
            splitDetailPanel();

        } else {
            fullDetailPanel();
        }
    });
}
