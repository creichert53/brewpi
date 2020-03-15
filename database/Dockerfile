FROM resin/raspberrypi3-python

RUN apt-get update && apt-get install g++ protobuf-compiler libprotobuf-dev libboost-dev curl m4 wget libssl-dev

RUN wget https://download.rethinkdb.com/dist/rethinkdb-2.4.0.tgz
RUN tar xf rethinkdb-2.4.0.tgz
RUN cd rethinkdb-2.4.0
RUN ./configure --allow-fetch CXX=clang++
RUN make ALLOW_WARNINGS=1
RUN make install ALLOW_WARNINGS=1

VOLUME ["/data"]

WORKDIR /data

CMD ["rethinkdb", "--bind", "all"]

EXPOSE 28015 29015 8080