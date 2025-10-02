# syntax=docker/dockerfile:1.6

ARG GRADLE_IMAGE=gradle:8.11-jdk21-alpine

FROM ${GRADLE_IMAGE} AS builder
WORKDIR /home/gradle/project

COPY build.gradle.kts settings.gradle.kts ./
COPY src ./src

ARG BUILD_TIME="unknown"
ARG GIT_SHA="dev-snapshot"
ARG SERVICE_VERSION="0.0.0"
ENV BUILD_TIME=${BUILD_TIME}
ENV GIT_SHA=${GIT_SHA}
ENV SERVICE_VERSION=${SERVICE_VERSION}

RUN gradle clean installDist --no-daemon

FROM eclipse-temurin:21-jre-alpine
WORKDIR /opt/app

ARG BUILD_TIME="unknown"
ARG GIT_SHA="dev-snapshot"
ARG SERVICE_VERSION="0.0.0"
ENV BUILD_TIME=${BUILD_TIME}
ENV GIT_SHA=${GIT_SHA}
ENV SERVICE_VERSION=${SERVICE_VERSION}
ENV PORT=8080

COPY --from=builder /home/gradle/project/build/install/audit-engine-api ./app

EXPOSE 8080
CMD ["/opt/app/app/bin/audit-engine-api"]
