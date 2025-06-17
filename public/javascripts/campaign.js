$(function(){
    $('.select2').select2({
        theme:'bootstrap-5',
        minimumResultsForSearch: 6,
        width:'resolve'
    });
    $('#stripe-signup-btn').on('click', stripeSignup);
    $('#stripe-add-info-btn').on('click', stripeCreateAccountLinkaAndRedirect);

});

let connectedAccountId = null;

async function stripeSignup(e){
    e.preventDefault();
    $('#stripe-dev-callout').show();
    $('#stripe-creating-account').show();
    $('#stripe-error').hide();
    $('#stripe-signup-btn').hide();
    const url = $(this).data('url');
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'CSRF-Token': $(this).data('csrf')
        },
    });
    const json = await response.json();

    const {account, error} = json;

    if (error) {
        $('#stripe-error').show();
        $('#stripe-signup-btn').show();
        $('#stripe-creating-account').hide();
        $('#stripe-dev-callout').hide();
        return;
    }
    $('#stripe-account-id').val(account);

    $('#stripe-connected-account-id')
        .html(`Your connected account ID is: <code class="bold">${account}</code>`)
        .show();

    $('#stripe-add-info-btn').show();
    $('#stripe-creating-account').hide();
}

async function stripeCreateAccountLinkaAndRedirect(e){
    e.preventDefault();
    $('#stripe-adding-info').show();
    $('#stripe-error').hide();
    $('#stripe-add-info-btn').hide();
    const addLinkurl = $(this).data('url');
    const result = await fetch(addLinkurl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'CSRF-Token': $(this).data('csrf')
        },
        body: JSON.stringify({
            account: $('#stripe-account-id').val(),
        }),
    });
    const json = await result.json();
    const {url, error} = json;

    if (error) {
        $('#stripe-error').show();
        $('#stripe-add-info-btn').show();
        return;
    }
    $('#stripe-adding-info').show();
    window.location.href = url;
}
