from django.contrib.flatpages import sitemaps
from django.contrib.sitemaps.views import sitemap
from django.urls import path

from . import views

urlpatterns = [
    path("", views.index),
    path("job/", views.job),
    path("job/<title>/", views.job),
    path("search/", views.search),
    path("source/", views.source_specific),
]
