FROM mcr.microsoft.com/devcontainers/python:1-3.12

RUN mkdir /src
WORKDIR /src

COPY requirements.txt .
RUN pip install -r requirements.txt && pre-commit install

ENV SHELL /bin/bash