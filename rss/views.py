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

es_host = os.getenv("ELASTICSEARCH_HOST", "elasticsearch")
es_port = os.getenv("ELASTICSEARCH_PORT", "9200")
connections.create_connection(hosts=[f"{es_host}:{es_port}"])
create_index_if_not_exists("rss")
ONE_WEEK = 7 * 24 * 60 * 60
ONE_HOUR = 60 * 60


def _fetch_latest_for_source(source):
    query_body = {
        "size": 20,
        "sort": [{"pubDate": {"unmapped_type": "date", "order": "desc"}}],
        "query": {"match_phrase": {"source": source}},
    }
    query = Search(index="rss", doc_type="item")
    query.update_from_dict(query_body)
    res = query.execute()
    return res


@cache_page(ONE_HOUR)
def index(request):
    context = {"sources": [], "count": 0}
    for source in sources:
        if "show_in_homepage" not in source:
            source["show_in_homepage"] = True
        items = _fetch_latest_for_source(source["name"])
        if items:
            context["sources"].append({"desc": source, "items": items})

    total_jobs = Search(index="rss").count()
    context["count"] = total_jobs

    return render(request, "rss/index.html", context)


def _convert_dates(hits):
    for hit in hits:
        if hit["pubDate"] is not None:
            hit["pubDate"] = dateutil.parser.parse(hit["pubDate"])


@cache_page(ONE_HOUR)
def search(request):
    SIZE = 40
    q = request.GET.get("q", "")
    _from = int(request.GET.get("from", 0))
    query = Search(index="rss", doc_type="item")
    query_body = {
        "size": SIZE,
        "from": _from,
        "query": {
            "query_string": {"fields": ["title", "body"], "query": q},
            # "sort": [
            #     {"pubDate": {"order": "desc"}},
            # ]
        },
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
    query = Search(index="rss", doc_type="item").query("match", _id=id)
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
    query = Search(index="rss", doc_type="item")
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
