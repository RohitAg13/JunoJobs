FROM python:3.9

ENV PYTHONUNBUFFERED=1
WORKDIR /code

# Install Node.js for Tailwind CSS build
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    node --version && npm --version

# Install Python dependencies
COPY requirements.txt /code/
RUN pip install --no-cache-dir -r requirements.txt

# Copy package.json and install Node dependencies
COPY package.json package-lock.json* /code/
RUN npm install

# Copy project files
COPY . /code/

# Build Tailwind CSS
RUN npm run build:css

# Two roles:
#   ROLE=web (default): migrate + collectstatic + gunicorn on $PORT
#   ROLE=cron        : long-running node process; runs main() now and via internal croner daily at 00:00 UTC
CMD sh -c '\
  if [ "$ROLE" = "cron" ]; then \
    echo "Starting cron role"; \
    cd /code/node && exec node ingest.js; \
  else \
    python manage.py migrate --noinput && \
    python manage.py collectstatic --noinput && \
    exec gunicorn dj.wsgi:application \
      --bind 0.0.0.0:${PORT:-8000} \
      --workers ${WEB_CONCURRENCY:-3} \
      --timeout 120 \
      --access-logfile - \
      --error-logfile -; \
  fi'
