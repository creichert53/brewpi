# base-image for node on any machine using a template variable,
# see more about dockerfile templates here: http://docs.resin.io/deployment/docker-templates/
# and about resin base images here: http://docs.resin.io/runtime/resin-base-images/
# Note the node:slim image doesn't have node-gyp
FROM resin/raspberrypi3-node:6-slim

# use apt-get if you need to install dependencies,
RUN apt-get update && apt-get install -y python
RUN apt-get update && apt-get install g++ protobuf-compiler libprotobuf-dev libboost-dev curl m4 wget libssl-dev

# install rethinkdb
RUN echo "deb http://download.rethinkdb.com/apt `lsb_release -cs` main" | sudo tee /etc/apt/sources.list.d/rethinkdb.list
RUN wget -qO- https://download.rethinkdb.com/apt/pubkey.gpg | sudo apt-key add -
RUN sudo apt-get update
RUN apt-get install rethinkdb

# Defines our working directory in container
WORKDIR /usr/src/rethinkdb

# This will copy all files in our root to the working directory in the container
COPY . ./

# Enable systemd init system in container
ENV INITSYSTEM on

# server.js will run when container starts up on the device
#CMD ["npm", "start"]
