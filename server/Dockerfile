FROM python:3.7-alpine

COPY ./requirements.txt /app/server/requirements.txt

WORKDIR /app/server

RUN pip install -r requirements.txt

COPY . /app/server

CMD [ "python", "app.py" ]

EXPOSE 5000