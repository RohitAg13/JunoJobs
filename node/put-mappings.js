let es = require('./es-client');
let fs = require('fs');



let body = JSON.parse(fs.readFileSync('./mappings.json'));

let params = {
    index: 'rss',
    type: 'item',
    body: body
};

es.indices.putMapping(params, (err, resp, status) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(resp, status);
});
