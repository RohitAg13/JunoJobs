import json

import dateutil
import math

import elasticsearch
from django import forms
from django.shortcuts import render
from django.http import Http404
from django.views.generic import CreateView, TemplateView
from elasticsearch_dsl import Search
from django.views.decorators.cache import cache_page
from elasticsearch_dsl.connections import connections

from rss.postproc import postproc
from rss.models import Feedback
from rss.sources import sources

from elasticsearch.exceptions import NotFoundError


def create_index_if_not_exists(index_name):
    es = connections.get_connection()
    try:
        if not es.indices.exists(index=index_name):
            es.indices.create(index=index_name)
    except NotFoundError:
        es.indices.create(index=index_name)


import os

es_host = os.getenv("ELASTICSEARCH_HOST", "localhost")
es_port = os.getenv("ELASTICSEARCH_PORT", "9200")

# Create ES connection with error handling
try:
    connections.create_connection(hosts=[f"{es_host}:{es_port}"], timeout=5)
    create_index_if_not_exists("rss")
except Exception as e:
    print(f"Warning: Could not connect to Elasticsearch at {es_host}:{es_port}")
    print(f"Error: {e}")
    print("Server will start but search functionality will be limited.")

from django.conf import settings

# Cache times from settings or defaults
ONE_WEEK = getattr(settings, 'CACHE_TIME_JOB_DETAIL', 7 * 24 * 60 * 60)
ONE_HOUR = getattr(settings, 'CACHE_TIME_JOBS', 60 * 60)
FIVE_MINUTES = getattr(settings, 'CACHE_TIME_SEARCH', 5 * 60)


def _fetch_latest_for_source(source):
    query_body = {
        "size": 20,
        "sort": [{"pubDate": {"unmapped_type": "date", "order": "desc"}}],
        "query": {"match_phrase": {"source": source}},
    }
    query = Search(index="rss")
    query.update_from_dict(query_body)
    res = query.execute()
    return res


@cache_page(ONE_HOUR)
def landing(request):
    """Landing page view with job count."""
    try:
        total_jobs = Search(index="rss").count()
    except:
        total_jobs = "1000+"  # Fallback when ES is offline
    context = {"count": total_jobs}
    return render(request, "rss/landing.html", context)


@cache_page(ONE_HOUR)
def index(request):
    context = {"sources": [], "count": 0}
    try:
        for source in sources:
            if "show_in_homepage" not in source:
                source["show_in_homepage"] = True
            items = _fetch_latest_for_source(source["name"])
            if items:
                context["sources"].append({"desc": source, "items": items})

        total_jobs = Search(index="rss").count()
        context["count"] = total_jobs
    except:
        # Graceful degradation when ES is offline
        context["count"] = "1000+"
        context["es_offline"] = True

    return render(request, "rss/index.html", context)


def _convert_dates(hits):
    for hit in hits:
        if hit["pubDate"] is not None:
            hit["pubDate"] = dateutil.parser.parse(hit["pubDate"])


@cache_page(FIVE_MINUTES)
def search(request):
    SIZE = 40
    q = request.GET.get("q", "")
    _from = int(request.GET.get("from", 0))

    # Get filter parameters
    selected_sources = request.GET.getlist("source")
    selected_categories = request.GET.getlist("category")
    date_filter = request.GET.get("date", "")

    # Build query
    query = Search(index="rss")

    # Base query with text search
    if q:
        base_query = {
            "query_string": {
                "fields": ["title^2", "body"],
                "query": q,
                "default_operator": "AND"
            }
        }
    else:
        base_query = {"match_all": {}}

    # Build filters
    filters = []

    # Source filter
    if selected_sources:
        filters.append({"terms": {"source": selected_sources}})

    # Category filter
    if selected_categories:
        filters.append({"terms": {"category": selected_categories}})

    # Date filter
    if date_filter:
        date_ranges = {
            "24h": "now-1d/d",
            "7d": "now-7d/d",
            "30d": "now-30d/d"
        }
        if date_filter in date_ranges:
            filters.append({
                "range": {
                    "pubDate": {
                        "gte": date_ranges[date_filter]
                    }
                }
            })

    # Combine query and filters
    if filters:
        final_query = {
            "bool": {
                "must": base_query,
                "filter": filters
            }
        }
    else:
        final_query = base_query

    # Build query body with aggregations
    query_body = {
        "size": SIZE,
        "from": _from,
        "query": final_query,
        "sort": [{"pubDate": {"order": "desc", "unmapped_type": "date"}}],
        "aggs": {
            "sources": {
                "terms": {
                    "field": "source",
                    "size": 50
                }
            },
            "categories": {
                "terms": {
                    "field": "category",
                    "size": 20
                }
            },
            "date_ranges": {
                "date_range": {
                    "field": "pubDate",
                    "ranges": [
                        {"key": "24h", "from": "now-1d/d"},
                        {"key": "7d", "from": "now-7d/d"},
                        {"key": "30d", "from": "now-30d/d"}
                    ]
                }
            }
        }
    }

    query.update_from_dict(query_body)

    try:
        res = query.execute()
    except elasticsearch.RequestError as err:
        json_error = json.dumps(err.info["error"]["root_cause"], indent=4)
        return render(
            request, "rss/search_error.html", {"json_error": json_error, "q": q}
        )

    _convert_dates(res.hits)
    total_hits = res["hits"]["total"]["value"]

    # Process aggregations
    aggs = res.aggregations if hasattr(res, 'aggregations') else {}

    context = {
        "q": q,
        "hits": res.hits,
        "total_hits": total_hits,
        "has_prev": _from != 0,
        "has_next": (total_hits - _from - SIZE) > 0,
        "prev": _from - SIZE,
        "next": _from + SIZE,
        "page_num": (math.floor(_from / SIZE) + 1),
        "aggregations": aggs,
        "selected_sources": selected_sources,
        "selected_categories": selected_categories,
        "date_filter": date_filter,
    }
    return render(request, "rss/search.html", context)


@cache_page(ONE_HOUR)
def popular(request, name=None):
    return search(request)


@cache_page(ONE_WEEK)
def job(request, title=None):
    id = request.GET.get("id", None)
    if id is None:
        raise Http404("id param not provided.")
    q = request.GET.get("q", None)
    query = Search(index="rss").query("match", _id=id)
    res = query.execute()
    if len(res.hits) == 0:
        raise Http404("ID does not exists")

    doc = res.hits[0]
    postproc(doc)
    context = {"q": q, "hit": doc}
    return render(request, "rss/job.html", context)


@cache_page(ONE_WEEK)
def data_sources(request):
    sources_json = json.dumps(sources, indent=4)
    return render(request, "rss/data_sources.html", {"sources_json": sources_json})


def source_specific(request):
    q = request.GET.get("q", "")
    SIZE = 50
    _from = int(request.GET.get("from", 0))
    query = Search(index="rss")
    query_body = {
        "size": SIZE,
        "sort": [{"pubDate": {"unmapped_type": "date", "order": "desc"}}],
        "query": {"match_phrase": {"source": q}},
    }
    query.update_from_dict(query_body)
    try:
        res = query.execute()
    except elasticsearch.RequestError as err:
        json_error = json.dumps(err.info["error"]["root_cause"], indent=4)
        return render(
            request, "rss/search_error.html", {"json_error": json_error, "q": q}
        )
    _convert_dates(res.hits)
    total_hits = res["hits"]["total"]["value"]
    context = {
        "q": q,
        "hits": res.hits,
        "total_hits": total_hits,
        "has_prev": _from != 0,
        "has_next": (total_hits - _from - SIZE) > 0,
        "prev": _from - SIZE,
        "next": _from + SIZE,
        "page_num": (math.floor(_from / SIZE) + 1),
    }
    return render(request, "rss/source.html", context)


class FeedbackCreate(CreateView):
    model = Feedback
    fields = ["sender_email", "message"]

    def get_form(self):
        form = super(FeedbackCreate, self).get_form()
        form.fields["message"].widget = forms.Textarea(attrs={"rows": 10, "cols": 60})
        return form


feedback_create = FeedbackCreate.as_view(success_url="/feedback/thanks")
feedback_thanks = TemplateView.as_view(template_name="rss/feedback_thanks.html")
opensearch = TemplateView.as_view(template_name="rss/opensearch.xml")
