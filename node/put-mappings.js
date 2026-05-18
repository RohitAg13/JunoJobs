const es = require("./es-client");
const fs = require("fs");

async function main() {
  const body = JSON.parse(fs.readFileSync("./mappings.json", "utf8"));

  // Ensure index exists first.
  const exists = await es.indices.exists({ index: "rss" });
  if (!(exists.body || exists)) {
    await es.indices.create({ index: "rss" });
    console.log("created rss index");
  }

  const resp = await es.indices.putMapping({
    index: "rss",
    body,
  });
  console.log("putMapping ok:", (resp.body || resp));
}

main().catch((err) => {
  console.error("put-mappings failed:", err && err.message ? err.message : err);
  process.exit(1);
});
