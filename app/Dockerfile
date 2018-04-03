# base-image for node on any machine using a template variable,
# see more about dockerfile templates here: http://docs.resin.io/deployment/docker-templates/
# and about resin base images here: http://docs.resin.io/runtime/resin-base-images/
# Note the node:slim image doesn't have node-gyp
FROM resin/raspberrypi3-node:6-slim

# use apt-get if you need to install dependencies,
RUN apt-get update && apt-get install g++ protobuf-compiler libprotobuf-dev libboost-dev curl m4 wget libssl-dev
RUN wget https://download.rethinkdb.com/dist/rethinkdb-2.3.6.tgz && tar xf rethinkdb-2.3.6.tgz && cd rethinkdb-2.3.6 && ./configure --with-system-malloc --allow-fetch && make ALLOW_WARNINGS=1 && make install ALLOW_WARNINGS=1

# Defines our working directory in container
WORKDIR /usr/src/app

# Copies the package.json first for better cache on later pushes
COPY package.json package.json

# This install npm dependencies on the resin.io build server,
# making sure to clean up the artifacts it creates in order to reduce the image size.
RUN JOBS=MAX npm install --production --unsafe-perm && npm cache clean && rm -rf /tmp/*

# This will copy all files in our root to the working  directory in the container
COPY . ./

# Enable systemd init system in container
ENV INITSYSTEM on

# server.js will run when container starts up on the device
CMD ["npm", "start"]
