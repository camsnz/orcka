# syntax=docker/dockerfile:1.6

FROM python:3.11-alpine AS runtime
WORKDIR /srv/app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apk add --no-cache build-base libffi-dev

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ARG BUILD_TIME="unknown"
ARG GIT_SHA="dev-snapshot"
ARG SERVICE_VERSION="0.0.0"
ENV BUILD_TIME=${BUILD_TIME}
ENV GIT_SHA=${GIT_SHA}
ENV SERVICE_VERSION=${SERVICE_VERSION}
ENV PORT=8000

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
