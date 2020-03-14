#!/bin/bash

# Housekeeping
apt-get update
apt-get upgrade

# Configure SPI and I2C
raspi-config

# Install git so we can pull down the repository
apt-get install git

# Make sure the correct locations exist for docker
mkdir -p /app/database
mkdir -p /app/server
mkdir -p /app/client
chown -R pi:pi /app

# Install docker and docker-compose
curl -sSL https://get.docker.com | sh
usermod -aG docker pi
apt-get install -y libffi-dev libssl-dev
apt-get install -y python3 python3-pip
apt-get remove python-configparser
pip3 install docker-compose

#### NEED TO LOG OUT AND BACK IN FOR DOCKER TO WORK ####