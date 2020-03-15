FROM python:3.8-slim

RUN apt-get update && apt-get dist-upgrade

COPY ./requirements.txt /app/server/requirements.txt

WORKDIR /app/server

RUN apt-get install -y python3-gpiozero
RUN apt-get install -y gcc
RUN apt-get install -y python3-dev
RUN pip3 install -r requirements.txt

COPY . /app/server

CMD [ "python", "app.py" ]

EXPOSE 5000