#!/bin/bash

# Juno Jobs Deployment Script
# Deploys the application to production server via SSH
# Usage: ./deploy.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SSH_HOST="do"
REMOTE_DIR="/root/JunoJobs"
DOCKER_COMPOSE_CMD="docker-compose up -d --build"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Juno Jobs Deployment Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Check if SSH connection works
echo -e "${YELLOW}[1/4]${NC} Testing SSH connection to ${GREEN}${SSH_HOST}${NC}..."
if ssh -o BatchMode=yes -o ConnectTimeout=5 ${SSH_HOST} exit 2>/dev/null; then
    echo -e "${GREEN}✓${NC} SSH connection successful"
else
    echo -e "${RED}✗${NC} SSH connection failed"
    echo -e "${RED}Error:${NC} Cannot connect to server '${SSH_HOST}'"
    echo "Please check:"
    echo "  - SSH config file (~/.ssh/config) has 'Host do' entry"
    echo "  - SSH keys are set up correctly"
    echo "  - Server is accessible"
    exit 1
fi
echo ""

# Step 2: Check if remote directory exists
echo -e "${YELLOW}[2/4]${NC} Checking remote directory..."
if ssh ${SSH_HOST} "[ -d ${REMOTE_DIR} ]"; then
    echo -e "${GREEN}✓${NC} Directory ${REMOTE_DIR} exists"
else
    echo -e "${RED}✗${NC} Directory ${REMOTE_DIR} does not exist"
    echo -e "${RED}Error:${NC} Remote directory not found"
    exit 1
fi
echo ""

# Step 3: Pull latest changes from git
echo -e "${YELLOW}[3/4]${NC} Pulling latest code from git..."
if ssh ${SSH_HOST} "cd ${REMOTE_DIR} && git pull origin main"; then
    echo -e "${GREEN}✓${NC} Code updated successfully"
else
    echo -e "${RED}✗${NC} Git pull failed"
    echo -e "${RED}Error:${NC} Could not pull latest code"
    echo "This could mean:"
    echo "  - Not a git repository"
    echo "  - No internet connection on server"
    echo "  - Merge conflicts"
    echo "  - No 'main' branch"
    exit 1
fi
echo ""

# Step 4: Clear caches before deployment
echo -e "${YELLOW}[4/7]${NC} Clearing Django cache..."
ssh ${SSH_HOST} "cd ${REMOTE_DIR} && docker-compose exec -T web python -c \"from django.core.cache import cache; cache.clear(); print('Cache cleared')\" 2>/dev/null" && echo -e "${GREEN}✓${NC} Cache cleared" || echo -e "${YELLOW}⚠${NC} Cache clear skipped (container not running)"
echo ""

# Step 5: Clear Python bytecode cache
echo -e "${YELLOW}[5/7]${NC} Clearing Python bytecode cache..."
ssh ${SSH_HOST} "cd ${REMOTE_DIR} && find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true"
ssh ${SSH_HOST} "cd ${REMOTE_DIR} && find . -name '*.pyc' -delete 2>/dev/null || true"
echo -e "${GREEN}✓${NC} Bytecode cache cleared"
echo ""

# Step 6: Collect static files
echo -e "${YELLOW}[6/7]${NC} Collecting static files..."
ssh ${SSH_HOST} "cd ${REMOTE_DIR} && docker-compose exec -T web python manage.py collectstatic --noinput 2>/dev/null" && echo -e "${GREEN}✓${NC} Static files collected" || echo -e "${YELLOW}⚠${NC} Static files will be collected on container start"
echo ""

# Step 7: Deploy with Docker Compose
echo -e "${YELLOW}[7/7]${NC} Deploying application..."
echo -e "Running: ${BLUE}${DOCKER_COMPOSE_CMD}${NC}"
echo ""

ssh ${SSH_HOST} "cd ${REMOTE_DIR} && ${DOCKER_COMPOSE_CMD}" && {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  ✓ Deployment Successful!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""

    # Wait for containers to fully start
    echo -e "${YELLOW}Waiting for containers to start...${NC}"
    sleep 5
    echo ""

    # Clear cache in new containers
    echo -e "${YELLOW}Clearing cache in new containers...${NC}"
    ssh ${SSH_HOST} "cd ${REMOTE_DIR} && docker-compose exec -T web python -c \"from django.core.cache import cache; cache.clear(); print('Cache cleared in new container')\"" && echo -e "${GREEN}✓${NC} Cache cleared in new containers"
    echo ""

    echo "Application is now running on the server."
    echo ""

    # Show running containers
    echo -e "${BLUE}Running containers:${NC}"
    ssh ${SSH_HOST} "cd ${REMOTE_DIR} && docker-compose ps"
    echo ""

    echo -e "${BLUE}View logs:${NC}"
    echo "  ssh ${SSH_HOST} 'cd ${REMOTE_DIR} && docker-compose logs -f'"
    echo ""
    echo -e "${BLUE}Stop application:${NC}"
    echo "  ssh ${SSH_HOST} 'cd ${REMOTE_DIR} && docker-compose down'"
    echo ""

} || {
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  ✗ Deployment Failed${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo "Deployment encountered an error."
    echo ""
    echo -e "${BLUE}Check logs:${NC}"
    echo "  ssh ${SSH_HOST} 'cd ${REMOTE_DIR} && docker-compose logs'"
    echo ""
    exit 1
}
