#!/bin/bash

# Housekeeping
apt-get update
apt-get upgrade

# Configure SPI and I2C
raspi-config

# Install dependencies
apt-get install -y build-essential python3-gpiozero python3-smbus python3-dev

# Install nodejs
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" # This loads nvm
nvm --version
nvm install node
npm install -g node-gyp

# Make sure the correct locations exist for docker
mkdir -p /app/database
mkdir -p /app/server
mkdir -p /app/client
chown -R pi:pi /app

# Install docker and docker-compose
curl -sSL https://get.docker.com | sh
groupadd docker
usermod -aG docker pi
apt-get install -y libffi-dev libssl-dev
apt-get install -y python3-pip
# apt-get remove python-configparser
pip3 install docker-compose

#### NEED TO LOG OUT AND BACK IN FOR DOCKER TO WORK ####