let elasticsearch = require("elasticsearch");

let es = new elasticsearch.Client({
  host: `${process.env.ELASTICSEARCH_HOST || "localhost"}:${
    process.env.ELASTICSEARCH_PORT || "9200"
  }`,
  log: "trace",
});

module.exports = es;
