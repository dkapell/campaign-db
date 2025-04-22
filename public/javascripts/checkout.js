/* globals Stripe */
$(function(){
    const publishableKey = $('#stripe-pub-key').val();
    const accountId = $('#stripe-account-id').val();


    // Initialize Stripe.j
    const stripe = Stripe(publishableKey, {
        stripeAccount: accountId,
    });

    initialize(stripe);
});

// Fetch Checkout Session and retrieve the client secret
async function initialize(stripe) {
    const fetchClientSecret = async () => {
        const body = {};
        if ($('#back-url').length && $('#back-url').val()){
            body.back = $('#back-url').val();
        }
        const response = await fetch('/order/create-checkout-session', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        const { clientSecret } = await response.json();
        return clientSecret;
    };

    // Initialize Checkout
    const checkout = await stripe.initEmbeddedCheckout({
        fetchClientSecret,
    });

    // Mount Checkout
    checkout.mount('#checkout');
}
