from django.contrib.flatpages import sitemaps
from django.contrib.sitemaps.views import sitemap
from django.urls import path

from . import views
from .sitemaps import JobSitemap, StaticViewSitemap

# Sitemap configuration
sitemaps = {
    'jobs': JobSitemap,
    'static': StaticViewSitemap,
}

urlpatterns = [
    path("", views.landing),
    path("jobs/", views.index),
    path("job/", views.job),
    path("job/<title>/", views.job),
    path("search/", views.search),
    path("source/", views.source_specific),
    path('sitemap.xml', sitemap, {'sitemaps': sitemaps}, name='django.contrib.sitemaps.views.sitemap'),
]
