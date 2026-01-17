FROM python:3.9

ENV PYTHONUNBUFFERED=1
WORKDIR /code

# Install Node.js for Tailwind CSS build
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
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

# Collect static files will be done at runtime via entrypoint script
