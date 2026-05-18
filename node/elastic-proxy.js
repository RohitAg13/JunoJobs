const express = require("express");
const es = require("./es-client");

const app = express();

app.get("/search/:q", async (req, res, next) => {
  if (!req.params.q) {
    return next("No q param");
  }
  try {
    const result = await es.search({
      index: "rss",
      q: req.params.q,
    });
    res.send(result.body || result);
  } catch (err) {
    next(err);
  }
});

app.listen(3000, () => {
  console.log("elastic-proxy listening on :3000");
});
