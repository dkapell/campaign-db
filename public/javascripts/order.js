$(function(){
    $('#refund-order-btn').confirmation({
        title:'Delete this order and refund charges?'
    }).on('click', deleteOrder);
    $('#delete-order-btn').confirmation({
        title:'Delete this order without refund?'
    }).on('click', deleteOrder);
});

async function deleteOrder(e){
    e.preventDefault();
    const $btn = $(this);
    $btn.tooltip('hide');

    const url = $btn.attr('url');
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'CSRF-Token': $btn.data('csrf')
    };
    const body = {
        refund: $btn.data('refund')
    };

    const result = await fetch(url, {
        method:'DELETE',
        redirect:'manual',
        headers:headers,
        body:JSON.stringify(body)
    });

    if($btn.data('back')){
        location = $btn.data('back');
    } else {
        location.reload();
    }
}
