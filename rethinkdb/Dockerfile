# base-image for node on any machine using a template variable,
# see more about dockerfile templates here: http://docs.resin.io/deployment/docker-templates/
# and about resin base images here: http://docs.resin.io/runtime/resin-base-images/
# Note the node:slim image doesn't have node-gyp
FROM resin/raspberrypi3-node:6-slim

# use apt-get if you need to install dependencies,
RUN apt-get update

# double swapspace
RUN dd if=/dev/zero of=/swapfile bs=1M count=2048
RUN chmod 600 /swapfile
RUN mkswap /swapfile
RUN swapon /swapfile

# install rethinkdb
RUN sudo apt-get install g++ protobuf-compiler libprotobuf-dev libboost-dev curl m4 wget libssl-dev
RUN wget https://download.rethinkdb.com/dist/rethinkdb-2.3.6.tgz
RUN tar xf rethinkdb-2.3.6.tgz
RUN cd rethinkdb-2.3.6
RUN ./configure --with-system-malloc --allow-fetch
RUN make ALLOW_WARNINGS=1
RUN sudo make install ALLOW_WARNINGS=1

# Defines our working directory in container
WORKDIR /usr/src/rethinkdb

# This will copy all files in our root to the working directory in the container
COPY . ./

# Enable systemd init system in container
ENV INITSYSTEM on

# server.js will run when container starts up on the device
#CMD ["npm", "start"]
