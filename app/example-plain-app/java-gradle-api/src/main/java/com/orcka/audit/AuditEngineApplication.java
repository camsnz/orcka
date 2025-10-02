package com.orcka.audit;

import static spark.Spark.*;

import com.google.gson.Gson;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

public final class AuditEngineApplication {
  private static final Gson GSON = new Gson();

  private AuditEngineApplication() {}

  public static void main(String[] args) {
    port(resolvePort());
    enableCORS();

    get(
        "/info",
        (request, response) -> {
          response.type("application/json");
          ServiceInfo payload = buildServiceInfo();
          return GSON.toJson(payload);
        });
  }

  private static int resolvePort() {
    return Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
  }

  private static void enableCORS() {
    before(
        (request, response) -> {
          response.header("Access-Control-Allow-Origin", "*");
          response.header("Access-Control-Allow-Methods", "GET");
          response.header("Access-Control-Allow-Headers", "Content-Type");
        });
  }

  private static ServiceInfo buildServiceInfo() {
    String buildTime = env("BUILD_TIME", Instant.now().toString());
    String gitSha = env("GIT_SHA", "dev-snapshot");
    String version = env("SERVICE_VERSION", "0.0.0");

    List<DependencyInfo> dependencies =
        List.of(
            new DependencyInfo("spark-core", "2.9.4"),
            new DependencyInfo("gson", "2.11.0"),
            new DependencyInfo("slf4j-simple", "2.0.16"));

    return new ServiceInfo(
        "Audit Engine",
        "Java 21 + SparkJava",
        buildTime,
        gitSha,
        version,
        dependencies);
  }

  private static String env(String key, String fallback) {
    return Optional.ofNullable(System.getenv(key)).filter(value -> !value.isBlank()).orElse(fallback);
  }

  private record ServiceInfo(
      String serviceName,
      String techStack,
      String buildTime,
      String gitSha,
      String buildVersion,
      List<DependencyInfo> dependencies) {}

  private record DependencyInfo(String name, String version) {}
}
