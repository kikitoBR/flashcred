#!/bin/bash

# FlashCred Deployment Script for Ubuntu VPS
# This script installs Node.js, Nginx, PM2 and Playwright dependencies

set -e

echo "🚀 Starting FlashCred Deployment..."

# 1. Update System
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# 3. Install NPM latest
sudo npm install -g npm@latest

# 4. Install PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
fi

# 5. Install Nginx
if ! command -v nginx &> /dev/null; then
    echo "📦 Installing Nginx..."
    sudo apt install -y nginx
fi

# 5.5 Create Database
echo "🗄️ Setting up Local Database..."
sudo mysql -e "CREATE DATABASE IF NOT EXISTS flashcred;"
sudo mysql -e "CREATE USER IF NOT EXISTS 'flashcred_user'@'localhost' IDENTIFIED BY '44434241Mm.';"
sudo mysql -e "GRANT ALL PRIVILEGES ON flashcred.* TO 'flashcred_user'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"

# 6. Install Playwright Dependencies (Headless Browsers)
echo "📦 Installing Playwright dependencies..."
sudo npx playwright install-deps

# 7. Setup Project Directory
PROJECT_DIR="/var/www/flashcred"
sudo mkdir -p $PROJECT_DIR
sudo chown -R $USER:$USER $PROJECT_DIR

# 8. Clone Repository (if not exists)
if [ ! -d "$PROJECT_DIR/.git" ]; then
    echo "📂 Cloning repository..."
    git clone https://github.com/kikitoBR/flashcred.git $PROJECT_DIR
else
    echo "📂 Updating repository..."
    cd $PROJECT_DIR
    git pull origin main
fi

cd $PROJECT_DIR

# 9. Server Setup
echo "⚙️ Setting up Server..."
cd server
npm install
# Note: Manually edit .env after this script or use environment variables

# 10. Client Setup & Build
echo "⚙️ Setting up Client..."
cd ../client
npm install
npm run build

# 11. Configure Nginx
echo "🌐 Configuring Nginx..."
cat <<EOF | sudo tee /etc/nginx/sites-available/flashcred
server {
    listen 80;
    server_name _; # Change this to your domain later

    root $PROJECT_DIR/client/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/flashcred /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# 12. Start Application with PM2
echo "🚀 Starting Server with PM2..."
cd ../server
pm2 stop flashcred-server || true
pm2 start "npx ts-node src/index.ts" --name flashcred-server

echo "✅ Deployment Complete!"
echo "⚠️ IMPORTANT: Don't forget to configure your /var/www/flashcred/server/.env file!"
echo "⚠️ If using a domain, update /etc/nginx/sites-available/flashcred with your domain and setup SSL with Certbot."
