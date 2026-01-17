from django.contrib.sitemaps import Sitemap
from django.urls import reverse
from elasticsearch_dsl import Search
from datetime import datetime, timedelta


class JobSitemap(Sitemap):
    """Sitemap for recent job listings."""
    changefreq = "daily"
    priority = 0.8
    limit = 1000

    def items(self):
        """Return recent jobs from last 30 days."""
        thirty_days_ago = datetime.now() - timedelta(days=30)

        query = Search(index="rss", doc_type="item")
        query_body = {
            "size": self.limit,
            "sort": [{"pubDate": {"order": "desc", "unmapped_type": "date"}}],
            "query": {
                "range": {
                    "pubDate": {
                        "gte": thirty_days_ago.isoformat()
                    }
                }
            },
            "_source": ["title", "pubDate", "link"]
        }
        query.update_from_dict(query_body)

        try:
            res = query.execute()
            return [
                {
                    "id": hit.meta.id,
                    "title": hit.title,
                    "pubDate": hit.pubDate if hasattr(hit, 'pubDate') else None
                }
                for hit in res.hits
            ]
        except Exception as e:
            print(f"Error fetching jobs for sitemap: {e}")
            return []

    def location(self, item):
        """Return the URL for a job item."""
        from django.utils.text import slugify
        from urllib.parse import urlencode

        slug = slugify(item['title'])
        params = urlencode({'id': item['id']})
        return f"/job/{slug}/?{params}"

    def lastmod(self, item):
        """Return the last modified date for a job item."""
        if item.get('pubDate'):
            if isinstance(item['pubDate'], str):
                from dateutil import parser
                return parser.parse(item['pubDate'])
            return item['pubDate']
        return None


class StaticViewSitemap(Sitemap):
    """Sitemap for static pages."""
    priority = 1.0
    changefreq = "weekly"

    def items(self):
        return ['landing', 'index', 'search']

    def location(self, item):
        if item == 'landing':
            return '/'
        elif item == 'index':
            return '/jobs/'
        elif item == 'search':
            return '/search/'
        return '/'
