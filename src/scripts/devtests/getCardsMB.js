const database = require('../../lib/database');
const stringify = require('csv-stringify-as-promised');
const fs = require('node:fs/promises');


(async function main() {
    const query = 'select jsonb_array_elements(configuration #> \'{"options"}\') from custom_fields where id = 19';
    const result = await database.query(query);
    const output = [];
    output.push(['name', 'order', 'description']);
    for( const card of result.rows){
        output.push([card.jsonb_array_elements.value, card.jsonb_array_elements.sort_order, card.jsonb_array_elements.description]);
    }
    const formatted = await stringify(output);
    await fs.writeFile('./cards', formatted);
    console.log('done');
    database.end();
})().catch((error) => {
    process.exitCode = 1;
    console.trace(error);
});
