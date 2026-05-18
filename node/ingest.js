let es = require("./es-client");
let RssParser = require("rss-parser");
let sources = require("./sources.json");
let preproc = require("./preproc");
let userAgents = require("./user-agents.json").data;

function getRandomUserAgent() {
  const randomIndex = Math.floor(Math.random() * userAgents.length);
  return userAgents[randomIndex].ua;
}
let httpreq = require("./httpreq");
const { Cron } = require("croner");
const { deleteOld } = require("./delete-old");

let rss = new RssParser();

function defaultItemToDoc(item) {
  return {
    title: item.title.trim(),
    link: item.link,
    body: item.contentSnippet,
    body_html: item.content,
    pubDate: new Date(item.pubDate),
  };
}

// Bulk-create a batch of docs. Bonsai Sandbox allows only 1 concurrent connection
// so we MUST batch and serialize. 409 (already exists) per-item is expected and ignored.
const BULK_SIZE = parseInt(process.env.BULK_SIZE || "100", 10);

async function bulkCreate(docs) {
  if (!docs.length) return { created: 0, conflicts: 0, errored: 0 };
  let created = 0;
  let conflicts = 0;
  let errored = 0;
  for (let i = 0; i < docs.length; i += BULK_SIZE) {
    const batch = docs.slice(i, i + BULK_SIZE);
    const body = [];
    for (const doc of batch) {
      body.push({ create: { _index: "rss", _id: doc.link } });
      body.push(doc);
    }
    try {
      const resp = await es.bulk({ body, refresh: false });
      const respBody = resp.body || resp;
      for (const op of respBody.items || []) {
        const r = op.create || op.index;
        if (!r) continue;
        if (r.status === 201) created++;
        else if (r.status === 409) conflicts++;
        else {
          errored++;
          if (errored <= 5) {
            console.error("bulk item err:", r.status, JSON.stringify(r.error).slice(0, 200));
          }
        }
      }
    } catch (err) {
      errored += batch.length;
      const status = (err && err.meta && err.meta.statusCode) || err.statusCode;
      console.error("bulk failed:", status, err.message);
    }
  }
  return { created, conflicts, errored };
}

async function handleRss(source) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const userAgent = getRandomUserAgent();
  let xml = await httpreq(source.url, {
    headers: { "User-Agent": userAgent },
  }).catch((err) => {
    console.log(`Cannot fetch ${source.name} ${source.url}`);
  });
  if (!xml) return;
  let feed = await rss.parseString(xml).catch((err) => {
    console.log(`Cannot parse RSS ${source.name} ${source.url}`);
  });
  if (!feed || !feed.items) return;

  const itemToDoc = source.itemToDoc || defaultItemToDoc;
  const docs = [];
  for (const item of feed.items) {
    if (source.debug) {
      console.log(item);
      continue;
    }
    let doc;
    try {
      doc = itemToDoc(item);
    } catch (e) {
      continue;
    }
    if (!doc || !doc.link) continue;
    doc.source = source.name;
    doc.category = source.category;
    if (preproc.hasOwnProperty(source.name)) {
      preproc[source.name](doc);
    }
    docs.push(doc);
  }

  const stats = await bulkCreate(docs);
  console.log(
    `[${source.name}] items=${docs.length} created=${stats.created} conflicts=${stats.conflicts} errored=${stats.errored}`
  );
}

async function handleItems(items) {
  const stats = await bulkCreate(items);
  console.log(
    `[special] items=${items.length} created=${stats.created} conflicts=${stats.conflicts} errored=${stats.errored}`
  );
}

async function main() {
  // Process sources sequentially — Bonsai Sandbox = 1 concurrent connection.
  for (const source of sources) {
    console.log(source.url);
    try {
      if (source.protocol === "rss" || !source.protocol) {
        await handleRss(source);
      } else if (source.protocol === "special") {
        const items = await source.handleSpecial(source);
        if (items && items.length) await handleItems(items);
      }
    } catch (err) {
      console.error(`source ${source.name} failed:`, err && err.message ? err.message : err);
    }
  }
  // After ingest, prune docs older than MAX_AGE_DAYS to stay under ES quota.
  try {
    await deleteOld();
  } catch (err) {
    console.error("delete-old after ingest failed:", err && err.message ? err.message : err);
  }

  let r = await httpreq(
    "https://hc-ping.com/b2a17a45-f7fe-4d11-ae8a-35b87a0fd4ee"
  ).catch((err) => {
    console.log(`Cannot ping server`);
    console.error(err);
  });
}

main();

const job = Cron("0 0 * * *", () => {
  const date = new Date();
  console.log("Running Scrapper on: ", date);
  main();
});
