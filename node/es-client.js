const { Client } = require("@elastic/elasticsearch");

// Prefer ELASTICSEARCH_URL (full URL with auth, e.g. https://user:pass@cluster.bonsaisearch.net),
// fall back to HOST:PORT for local Docker compose.
const esUrl =
  process.env.ELASTICSEARCH_URL ||
  `http://${process.env.ELASTICSEARCH_HOST || "elasticsearch"}:${
    process.env.ELASTICSEARCH_PORT || "9200"
  }`;

const es = new Client({
  node: esUrl,
  requestTimeout: 30000,
});

module.exports = es;
