#!/bin/bash

# Quick deployment script (no checks, just deploy)
# Usage: ./deploy-quick.sh

set -e

echo "🚀 Deploying to production..."
echo "📦 Pulling latest code..."
ssh do "cd /root/JunoJobs && git pull origin main"

echo "🧹 Clearing Django cache..."
ssh do "cd /root/JunoJobs && docker-compose exec -T web python -c \"from django.core.cache import cache; cache.clear(); print('Cache cleared')\" 2>/dev/null || echo 'Cache clear skipped (container not running)'"

echo "🗑️  Clearing Python bytecode cache..."
ssh do "cd /root/JunoJobs && find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true"
ssh do "cd /root/JunoJobs && find . -name '*.pyc' -delete 2>/dev/null || true"

echo "📦 Collecting static files..."
ssh do "cd /root/JunoJobs && docker-compose exec -T web python manage.py collectstatic --noinput 2>/dev/null || echo 'Static files will be collected on container start'"

echo "🐳 Building and starting containers..."
ssh do "cd /root/JunoJobs && docker-compose up -d --build"

echo "⏳ Waiting for containers to start..."
sleep 5

echo "🔄 Clearing cache in new containers..."
ssh do "cd /root/JunoJobs && docker-compose exec -T web python -c \"from django.core.cache import cache; cache.clear(); print('Cache cleared in new container')\""

echo "✓ Deployment complete!"
