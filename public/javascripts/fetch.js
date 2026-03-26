async function fetchWithCsrfRetry(url, options = {}, retries = 1){
    options.credentials = 'same-origin';
    let response = await fetch(url,options);
    if (response.status === 403 && retries > 0) {
        console.warn('CSRF token mismatch, retrying...');

        const csrfResponse = await fetch('/api/csrf');
        const csrfTokenData =  await csrfResponse.json();
        if (options.header){
            options.header['x-csrf-token'] = csrfTokenData.csrfToken;
        } else {
            options.header = {
                'x-csrf-token':  csrfTokenData.csrfToken
            };
        }
        // Remove form-based CSRF Token
        if (options.body && options.body._csrf){
            delete options.body._csrf;
        }

        return fetchWithCsrfRetry(url, options, retries - 1);
    }
    return response;
}
