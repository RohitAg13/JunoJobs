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

# Migrations + collectstatic + gunicorn. Railway sets $PORT.
CMD sh -c "python manage.py migrate --noinput && \
  python manage.py collectstatic --noinput && \
  gunicorn dj.wsgi:application \
    --bind 0.0.0.0:${PORT:-8000} \
    --workers ${WEB_CONCURRENCY:-3} \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -"
