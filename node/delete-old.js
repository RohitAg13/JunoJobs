// Delete rss docs older than MAX_AGE_DAYS (default 365) from Elasticsearch.
// Runs as part of the daily Railway cron after ingest.

let es = require("./es-client");

const maxAgeDays = parseInt(process.env.MAX_AGE_DAYS || "365", 10);

async function main() {
  const result = await es.deleteByQuery({
    index: "rss",
    body: {
      query: {
        range: {
          pubDate: {
            lt: `now-${maxAgeDays}d/d`,
          },
        },
      },
    },
    refresh: true,
    conflicts: "proceed",
    requestTimeout: 120000,
  });

  console.log(
    `delete-old: removed ${result.deleted || 0} docs older than ${maxAgeDays} days (took ${result.took}ms, failures=${(result.failures || []).length})`
  );
}

main().catch((err) => {
  console.error("delete-old failed:", err && err.message ? err.message : err);
  process.exit(1);
});
