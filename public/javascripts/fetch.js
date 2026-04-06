async function fetchWithCsrfRetry(url, options = {}, retries = 1){
    let response = await fetch(url,options);
    if (response.status === 403 && retries > 0) {
        console.warn('CSRF token mismatch, retrying...');

        const csrfResponse = await fetch('/api/csrf');
        const csrfTokenData =  await csrfResponse.json();
        if (options.headers){
            options.headers['x-csrf-token'] = csrfTokenData.csrfToken;
        } else {
            options.headers = {
                'x-csrf-token':  csrfTokenData.csrfToken
            };
        }
        // Remove form-based CSRF Token
        if (options.body){
           options.body.delete('_csrf')
        }

        return fetchWithCsrfRetry(url, options, retries - 1);
    }
    return response;
}
