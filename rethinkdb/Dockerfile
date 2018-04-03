# base-image for node on any machine using a template variable,
# see more about dockerfile templates here: http://docs.resin.io/deployment/docker-templates/
# and about resin base images here: http://docs.resin.io/runtime/resin-base-images/
# Note the node:slim image doesn't have node-gyp
FROM resin/raspberrypi3-node:6-slim

RUN -c 'echo "CONF_SWAPSIZE=2048" > /etc/dphys-swapfile'
RUN dphys-swapfile setup
RUN dphys-swapfile swapon

# Install RethinkDB.
# RUN sudo apt-get install g++ protobuf-compiler libprotobuf-dev \
   # libboost-dev curl m4 wget libssl-dev

# # Define mountable directories.
# VOLUME ["/data"]
#
# # Define working directory.
# WORKDIR /data
#
# # Define default command.
# CMD ["rethinkdb", "--bind", "all"]
#
# # Expose ports.
# #   - 8080: web UI
# #   - 28015: process
# #   - 29015: cluster
# EXPOSE 8080
# EXPOSE 28015
# EXPOSE 29015
