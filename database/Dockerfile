FROM resin/raspberrypi3-python

RUN sudo apt-get install g++ protobuf-compiler libprotobuf-dev libboost-dev curl m4 wget libssl-dev

RUN wget https://download.rethinkdb.com/dist/rethinkdb-2.4.0.tgz && tar xf rethinkdb-2.4.0.tgz && cd rethinkdb-2.4.0 && ./configure --allow-fetch CXX=clang++ && sudo make install ALLOW_WARNINGS=1

VOLUME ["/data"]

WORKDIR /data

CMD ["rethinkdb", "--bind", "all"]

EXPOSE 28015 29015 8080
