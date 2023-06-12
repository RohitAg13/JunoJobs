let httpreq = require('./httpreq');
let RssParser = require('rss-parser');
let rss = new RssParser();

//  Update the following source object with the source you want to test
source = {
    "name": "Python.org Jobs",
    "url": "https://vuejobs.com/feed",
    "category": "lang-jobs",
}

function defaultItemToDoc(item) {
    return {
        title: item.title.trim(),
        link: item.link,
        body: item.contentSnippet,
        body_html: item.content,
        pubDate: new Date(item.pubDate),
    }
}

async function handleRss(source) {
    let xml = await httpreq(source.url).catch(err => {
        console.log(`Cannot fetch ${source.name} ${source.url}`);
        console.error(err);
    });
    let feed = await rss.parseString(xml).catch(err => {
        console.log(`Cannot parse RSS ${source.name} ${source.url}`);
    });
    console.log("parsed successfully" )
    return Promise.all(feed.items.map(async item => {
        if (source.debug) {
            console.log(item);
            return;
        }
        let doc = defaultItemToDoc(item);
        doc.source = source.name;
        doc.category = source.category;
        console.log("Completed!!", doc)
    }))
}


handleRss(source)