#!/bin/bash

docker logs --tail=150 --follow brewpi_flask_1 | grep --color=always -E '*'