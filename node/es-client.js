let elasticsearch = require('elasticsearch');

let es = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH_URL || 'localhost:9200',
    log: 'trace'
});

module.exports = es;
