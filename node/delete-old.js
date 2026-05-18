// Delete rss docs older than maxAgeDays from Elasticsearch.
// Importable as a function; runnable as a CLI script.

const es = require("./es-client");

async function deleteOld(maxAgeDays) {
  const days = parseInt(maxAgeDays || process.env.MAX_AGE_DAYS || "365", 10);
  const response = await es.deleteByQuery(
    {
      index: "rss",
      body: {
        query: {
          range: {
            pubDate: {
              lt: `now-${days}d/d`,
            },
          },
        },
      },
      refresh: true,
      conflicts: "proceed",
    },
    { requestTimeout: 120000 }
  );

  const body = response.body || response;
  console.log(
    `delete-old: removed ${body.deleted || 0} docs older than ${days} days (took ${body.took}ms, failures=${(body.failures || []).length})`
  );
  return body;
}

module.exports = { deleteOld };

// CLI mode: only when invoked directly, not when require()d.
if (require.main === module) {
  deleteOld().catch((err) => {
    console.error("delete-old failed:", err && err.message ? err.message : err);
    process.exit(1);
  });
}
