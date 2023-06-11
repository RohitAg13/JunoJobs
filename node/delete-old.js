let elasticsearch = require('elasticsearch');

let es = new elasticsearch.Client({
    host: '172.26.12.192:9200',
    log: 'trace'
});


es.deleteByQuery({
    index: 'rss',
});
