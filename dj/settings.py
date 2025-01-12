from .shared_settings import *

DEBUG = True
ALLOWED_HOSTS = ["localhost"]

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.dummy.DummyCache',
    }
}
