'use strict';
const _ = require('underscore');
const reportHelper = require('../../lib/reportHelper');

const characterList = [83, 46, 73];

(async function main() {
    const output = await reportHelper.data(characterList, 5);
    console.log(JSON.stringify(output.styles, null ,2));
    //console.log(JSON.stringify(output, null, 2));
    console.log('done');
    process.exit(0);
})().catch((error) => {
    console.trace(error);
    process.exit(1);
});
