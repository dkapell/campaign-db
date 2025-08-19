'use strict';
import pg from 'pg';
import config from 'config';
import parseDbUrl from 'parse-database-url';


if ( config.has('db.poolSize')){
    pg.defaults.poolSize = config.get('db.poolSize');
}

let dbURL = config.get('app.dbURL');
if(config.get('app.dbSSL')){
    dbURL +=  '?ssl=true';
}

const poolConfig = parseDbUrl(dbURL);
if(config.get('app.dbSSL')){
    poolConfig.ssl = {
        rejectUnauthorized: false
    };
}

if (config.get('app.dbPoolSize')){
    poolConfig.max = config.get('app.dbPoolSize');
}

const pool = new pg.Pool(poolConfig);

pool.on('error', function (err) {
    console.error('idle client error', err.message, err.stack);
});

// Helper Functions

// Handle errors with postgres driver
/*
function handleError(err, client, done){
    // no error occurred, continue with the request
    if(!err) return false;
    // else close connection and hand back failure
    done(client);
    return true;
}
*/
// Rollback helper for postgres transactions
/*
function rollback(client, done){
    client.query('ROLLBACK', function(err) {
        return done(err);
    });
}
*/

async function query(query:string, data:unknown[]): Promise<pg.QueryResult> {
    return pool.query(query, data);
};

function end(){
    pool.end();
};

async function connect(){
    return pool.connect();
}

export default { query, connect, end }
