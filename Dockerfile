FROM python:3.9-slim-bullseye

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates curl gnupg lsb-release && \
    install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
    chmod a+r /etc/apt/keyrings/docker.gpg && \
    echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian bullseye stable" > /etc/apt/sources.list.d/docker.list && \
    apt-get update && apt-get install -y --no-install-recommends docker-ce-cli && \
    rm -rf /var/lib/apt/lists/*

ADD requirements.txt /
RUN pip3 install -r /requirements.txt && mkdir /code

ADD . /code/

WORKDIR /code/
EXPOSE 5000
CMD ["python3", "/code/main.py"]
