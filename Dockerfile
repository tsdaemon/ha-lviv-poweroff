FROM mcr.microsoft.com/devcontainers/python:1-3.12

RUN \
    apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        git \
        cmake \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .pre-commit-config.yaml ./
RUN pip install -r requirements.txt

ENV SHELL /bin/bash
ENV MYPYPATH "/workspaces/ha-lviv-poweroff/custom_components"
