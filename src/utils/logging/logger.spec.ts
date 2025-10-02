import { beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "./logger.js";

describe("Logger", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn<Console, keyof Console>>;

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
    };
  });

  describe("constructor", () => {
    it("should create logger with default options", () => {
      const logger = new Logger();
      expect(logger).toBeInstanceOf(Logger);
    });

    it("should create logger with custom options", () => {
      const logger = new Logger({ verbose: true, quiet: false });
      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe("info logging", () => {
    it("should log info messages with emoji when not quiet", () => {
      const logger = new Logger({ verbose: false, quiet: false });
      logger.info("test message");
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining("test message"));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining("ℹ️"));
    });

    it("should not log info messages when quiet", () => {
      const logger = new Logger({ verbose: false, quiet: true });
      logger.info("test message");
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe("error logging", () => {
    it("should log error messages with emoji", () => {
      const logger = new Logger({ verbose: false, quiet: false });
      logger.error("error message");
      expect(consoleSpy.error).toHaveBeenCalledWith("❌ error message");
    });

    it("should log error messages even when quiet", () => {
      const logger = new Logger({ verbose: false, quiet: true });
      logger.error("error message");
      expect(consoleSpy.error).toHaveBeenCalledWith("❌ error message");
    });
  });

  describe("warn logging", () => {
    it("should log warn messages with emoji when not quiet", () => {
      const logger = new Logger({ verbose: false, quiet: false });
      logger.warn("warn message");
      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining("warn message"));
      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining("⚠️"));
    });

    it("should not log warn messages when quiet", () => {
      const logger = new Logger({ verbose: false, quiet: true });
      logger.warn("warn message");
      expect(consoleSpy.warn).not.toHaveBeenCalled();
    });
  });

  describe("success logging", () => {
    it("should log success messages with emoji when not quiet", () => {
      const logger = new Logger({ verbose: false, quiet: false });
      logger.success("success message");
      expect(consoleSpy.log).toHaveBeenCalledWith("✅ success message");
    });

    it("should not log success messages when quiet", () => {
      const logger = new Logger({ verbose: false, quiet: true });
      logger.success("success message");
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe("verbose logging", () => {
    it("should log verbose messages when verbose is enabled and not quiet", () => {
      const logger = new Logger({ verbose: true, quiet: false });
      logger.verbose("verbose message");
      expect(consoleSpy.log).toHaveBeenCalledWith("🔍 verbose message");
    });

    it("should not log verbose messages when verbose is disabled", () => {
      const logger = new Logger({ verbose: false, quiet: false });
      logger.verbose("verbose message");
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it("should not log verbose messages when quiet", () => {
      const logger = new Logger({ verbose: true, quiet: true });
      logger.verbose("verbose message");
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe("service summary logging", () => {
    it("should log service summary when not quiet", () => {
      const logger = new Logger({ verbose: false, quiet: false });
      const services = [
        { name: "web", varName: "WEB_TAG_VER", imageTag: "web:123_abc" },
        { name: "api", varName: "API_TAG_VER", imageTag: "api:456_def" },
      ];

      logger.logServiceSummary(services);

      // Check that info message was logged
      const calls = consoleSpy.log.mock.calls;
      expect(calls[0][0]).toContain("Generated 2 service tags");
      expect(consoleSpy.log).toHaveBeenCalledWith(` API_TAG_VER: "api:456_def"`);
      expect(consoleSpy.log).toHaveBeenCalledWith(` WEB_TAG_VER: "web:123_abc"`);
    });

    it("should handle empty services array", () => {
      const logger = new Logger({ verbose: false, quiet: false });
      logger.logServiceSummary([]);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("No services with calculate_on criteria found"),
      );
    });

    it("should not log when quiet", () => {
      const logger = new Logger({ verbose: false, quiet: true });
      const services = [{ name: "web", varName: "WEB_TAG_VER", imageTag: "web:123_abc" }];
      logger.logServiceSummary(services);
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe("service processing logging", () => {
    it("should log service processing when verbose and not quiet", () => {
      const logger = new Logger({ verbose: true, quiet: false });
      logger.logServiceProcessing("web", "Building", "Dockerfile.web");
      expect(consoleSpy.log).toHaveBeenCalledWith("🔍 [web] Building: Dockerfile.web");
    });

    it("should log service processing without details", () => {
      const logger = new Logger({ verbose: true, quiet: false });
      logger.logServiceProcessing("api", "Starting");
      expect(consoleSpy.log).toHaveBeenCalledWith("🔍 [api] Starting");
    });

    it("should not log when not verbose", () => {
      const logger = new Logger({ verbose: false, quiet: false });
      logger.logServiceProcessing("web", "Building");
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it("should not log when quiet", () => {
      const logger = new Logger({ verbose: true, quiet: true });
      logger.logServiceProcessing("web", "Building");
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe("updateOptions", () => {
    it("should update logger options", () => {
      const logger = new Logger({ verbose: false, quiet: false });

      logger.info("before");
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining("before"));

      logger.updateOptions({ quiet: true });
      logger.info("after");
      expect(consoleSpy.log).toHaveBeenCalledTimes(1); // Only the first call
    });

    it("should partially update options", () => {
      const logger = new Logger({ verbose: false, quiet: true });

      logger.updateOptions({ verbose: true });
      logger.verbose("verbose message");
      expect(consoleSpy.log).not.toHaveBeenCalled(); // Still quiet

      logger.updateOptions({ quiet: false });
      logger.verbose("verbose message 2");
      expect(consoleSpy.log).toHaveBeenCalledWith("🔍 verbose message 2");
    });
  });
});
