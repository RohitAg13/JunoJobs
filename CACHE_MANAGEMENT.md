# Django Cache Management Guide

This document explains how to prevent cached HTML/template issues during deployments.

## The Problem

Django caches compiled templates in two places:
1. **Memcached**: Template content and rendered output
2. **Python Bytecode (.pyc files)**: Compiled Python code

When you update templates without clearing these caches, Django serves old cached HTML.

## Solutions Implemented

### 1. Updated Deployment Scripts ✅

Both `deploy.sh` and `deploy-quick.sh` now automatically:
- Clear Django cache (Memcached)
- Delete Python bytecode cache (.pyc files and __pycache__)
- Rebuild static files with new hashes
- Clear cache again after containers restart

### 2. Deployment Steps

The scripts now follow this sequence:

```bash
1. Pull latest code from git
2. Clear Django cache (if containers running)
3. Clear Python bytecode cache
4. Collect static files
5. Rebuild and restart Docker containers
6. Clear cache in new containers
```

## Manual Cache Clearing

If you need to clear cache manually without full deployment:

### Clear Django Cache
```bash
# From local machine
ssh do 'cd /root/JunoJobs && docker-compose exec -T web python -c "from django.core.cache import cache; cache.clear()"'

# Or on server directly
docker-compose exec web python manage.py shell
>>> from django.core.cache import cache
>>> cache.clear()
```

### Clear Python Bytecode
```bash
# On server
cd /root/JunoJobs
find . -type d -name __pycache__ -exec rm -rf {} +
find . -name '*.pyc' -delete
```

### Restart Web Container
```bash
# Restart without rebuilding
docker-compose restart web

# Full rebuild
docker-compose up -d --build web
```

## Alternative Solutions

### Option A: Disable Template Caching (Development Only)

Add to `dj/settings.py` for development:

```python
if DEBUG:
    # Disable template caching in development
    for template_engine in TEMPLATES:
        template_engine['OPTIONS']['loaders'] = [
            'django.template.loaders.filesystem.Loader',
            'django.template.loaders.app_directories.Loader',
        ]
```

**⚠️ Warning**: Never use this in production as it severely impacts performance.

### Option B: Cache Key Versioning

Add to `dj/settings.py`:

```python
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.memcached.MemcachedCache",
        "LOCATION": f"{env('MEMCACHED_HOST', default='127.0.0.1')}:{env('MEMCACHED_PORT', default='11211')}",
        "VERSION": env('CACHE_VERSION', default=1),  # Increment on deployment
    }
}
```

Then increment `CACHE_VERSION` environment variable on each deployment.

### Option C: Add Cache-Clear Management Command

Create `rss/management/commands/clear_all_caches.py`:

```python
from django.core.management.base import BaseCommand
from django.core.cache import cache
import os
import shutil

class Command(BaseCommand):
    help = 'Clear all Django caches'

    def handle(self, *args, **options):
        # Clear Django cache
        cache.clear()
        self.stdout.write(self.style.SUCCESS('✓ Django cache cleared'))

        # Clear Python bytecode
        for root, dirs, files in os.walk('.'):
            if '__pycache__' in dirs:
                shutil.rmtree(os.path.join(root, '__pycache__'))

        self.stdout.write(self.style.SUCCESS('✓ Python bytecode cleared'))
```

Usage:
```bash
docker-compose exec web python manage.py clear_all_caches
```

## Best Practices

### 1. Always Use Deployment Scripts
```bash
# Good
./deploy-quick.sh

# Bad (missing cache clearing)
ssh do 'cd /root/JunoJobs && git pull && docker-compose up -d'
```

### 2. Test Templates After Deployment
```bash
# Quick validation
curl -s https://juno.rohitagarwal.dev/ | grep "Start Your Job Search"
```

### 3. Monitor Cache Size
```bash
# Check Memcached stats
docker-compose exec memcached sh -c 'echo "stats" | nc localhost 11211'
```

### 4. Static Files Management
Static files are versioned automatically by Django's `ManifestStaticFilesStorage`. When you run `collectstatic`, it:
- Generates new hashed filenames (e.g., `style.abc123.css`)
- Updates manifest.json
- Old files are not automatically deleted

Clear old static files periodically:
```bash
# On server
cd /root/JunoJobs
rm -rf staticfiles/*
docker-compose exec web python manage.py collectstatic --noinput
```

## Troubleshooting

### Issue: Templates still showing old content after deployment

**Solution**:
```bash
# 1. Clear cache manually
ssh do 'cd /root/JunoJobs && docker-compose exec -T web python -c "from django.core.cache import cache; cache.clear()"'

# 2. Restart containers
ssh do 'cd /root/JunoJobs && docker-compose restart web'

# 3. Check if code is actually updated
ssh do 'cd /root/JunoJobs && git log -1 --oneline'
```

### Issue: Static files not updating

**Solution**:
```bash
# 1. Clear staticfiles directory
ssh do 'cd /root/JunoJobs && rm -rf staticfiles/*'

# 2. Rebuild Tailwind CSS (if needed)
npx tailwindcss -i ./static/css/tailwind.input.css -o ./static/css/tailwind.output.css --minify

# 3. Collect static files
ssh do 'cd /root/JunoJobs && docker-compose exec -T web python manage.py collectstatic --noinput'

# 4. Restart web
ssh do 'cd /root/JunoJobs && docker-compose restart web'
```

### Issue: Memcached connection errors

**Solution**:
```bash
# Check if Memcached is running
docker-compose ps memcached

# Restart Memcached
docker-compose restart memcached

# Check connection from web container
docker-compose exec web python -c "from django.core.cache import cache; cache.set('test', 'value'); print(cache.get('test'))"
```

## When to Clear Cache

### Always Clear:
- ✅ After template changes
- ✅ After Django settings changes
- ✅ After model changes
- ✅ After view logic changes

### Optional:
- Static file updates (handled by versioning)
- CSS/JS changes (handled by versioning)

### Never Needed:
- Content updates (e.g., new job listings)
- Database data changes

## Performance Considerations

- **Template caching**: Improves page load times by 50-80%
- **Memcached**: Recommended for production
- **Cache size**: Monitor and tune `MEMCACHED_MEMORY` if needed
- **Cache expiration**: Set appropriate `TIMEOUT` values for different cache keys

## Summary

The updated deployment scripts now handle cache clearing automatically. You should never experience cached HTML issues again as long as you:

1. Use `./deploy.sh` or `./deploy-quick.sh` for deployments
2. Wait for the deployment to complete fully (don't interrupt it)
3. Check the deployment output for any cache clearing errors

If issues persist, refer to the troubleshooting section above.
