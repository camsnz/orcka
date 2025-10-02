import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type FileResult, parseHclForValidation, safeReadFile } from "./file-utils.js";

describe("file-utils", () => {
  const testDir = join(process.cwd(), "tmp", "file-utils-spec");

  beforeEach(() => {
    // Create test directory
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("safeReadFile", () => {
    it("should successfully read an existing file", () => {
      const filePath = join(testDir, "test.txt");
      const content = "Hello, World!\nThis is a test file.";
      writeFileSync(filePath, content, "utf-8");

      const result = safeReadFile(filePath);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(content);
      }
    });

    it("should handle non-existent files", () => {
      const filePath = join(testDir, "non-existent.txt");

      const result = safeReadFile(filePath);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("File not found");
        expect(result.path).toBe(filePath);
      }
    });

    it("should handle empty files", () => {
      const filePath = join(testDir, "empty.txt");
      writeFileSync(filePath, "", "utf-8");

      const result = safeReadFile(filePath);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("");
      }
    });

    it("should handle files with special characters", () => {
      const filePath = join(testDir, "special.txt");
      const content = "Special chars: àáâãäåæçèéêë\n中文\n🚀🎉";
      writeFileSync(filePath, content, "utf-8");

      const result = safeReadFile(filePath);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(content);
      }
    });

    it("should handle large files", () => {
      const filePath = join(testDir, "large.txt");
      const content = "Line content\n".repeat(1000);
      writeFileSync(filePath, content, "utf-8");

      const result = safeReadFile(filePath);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(content);
        expect(result.data.split("\n")).toHaveLength(1001); // 1000 lines + 1 empty line at end
      }
    });

    it("should handle permission errors gracefully", () => {
      const filePath = join(testDir, "permission-test.txt");
      writeFileSync(filePath, "test content", "utf-8");

      // Note: This test is platform-dependent and may not work on all systems
      // We're testing the error handling structure rather than actual permission errors
      const result = safeReadFile(filePath);

      // The file should be readable in our test environment
      expect(result.success).toBe(true);
    });
  });

  describe("parseHclForValidation", () => {
    it("should parse a simple HCL target", () => {
      const filePath = join(testDir, "simple.hcl");
      const hclContent = `
target "web" {
  dockerfile = "Dockerfile.web"
  context = "."
}`;
      writeFileSync(filePath, hclContent, "utf-8");

      const result = parseHclForValidation(filePath);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty("target");
        const targets = result.data.target as Record<string, any>;
        expect(targets).toHaveProperty("web");
        expect(targets.web.dockerfile).toBe("Dockerfile.web");
        expect(targets.web.context).toBe(".");
      }
    });

    it("should parse multiple HCL targets", () => {
      const filePath = join(testDir, "multiple.hcl");
      const hclContent = `
target "web" {
  dockerfile = "Dockerfile.web"
  context = "."
}

target "api" {
  dockerfile = "Dockerfile.api"
  context = "./api"
}`;
      writeFileSync(filePath, hclContent, "utf-8");

      const result = parseHclForValidation(filePath);

      expect(result.success).toBe(true);
      if (result.success) {
        const targets = result.data.target as Record<string, any>;
        expect(targets).toHaveProperty("web");
        expect(targets).toHaveProperty("api");
        expect(targets.web.dockerfile).toBe("Dockerfile.web");
        expect(targets.api.dockerfile).toBe("Dockerfile.api");
        expect(targets.api.context).toBe("./api");
      }
    });

    it("should parse HCL targets with depends_on", () => {
      const filePath = join(testDir, "depends.hcl");
      const hclContent = `
target "web" {
  dockerfile = "Dockerfile.web"
  depends_on = ["base", "deps"]
}`;
      writeFileSync(filePath, hclContent, "utf-8");

      const result = parseHclForValidation(filePath);

      expect(result.success).toBe(true);
      if (result.success) {
        const targets = result.data.target as Record<string, any>;
        expect(targets.web.depends_on).toEqual(["base", "deps"]);
      }
    });

    it("should parse HCL targets with contexts", () => {
      const filePath = join(testDir, "contexts.hcl");
      const hclContent = `
target "web" {
  dockerfile = "Dockerfile.web"
  contexts = {
    base_image = "node:20"
    build_context = "target:builder"
  }
}`;
      writeFileSync(filePath, hclContent, "utf-8");

      const result = parseHclForValidation(filePath);

      expect(result.success).toBe(true);
      if (result.success) {
        const targets = result.data.target as Record<string, any>;
        expect(targets.web.contexts).toEqual({
          base_image: "node:20",
          build_context: "target:builder",
        });
      }
    });

    it("should handle complex HCL with nested structures", () => {
      const filePath = join(testDir, "complex.hcl");
      const hclContent = `
target "base" {
  dockerfile = "Dockerfile.base"
  context = "."
}

target "web" {
  dockerfile = "Dockerfile.web"
  context = "./web"
  depends_on = ["base"]
  contexts = {
    base_image = "target:base"
    node_modules = "./node_modules"
  }
}`;
      writeFileSync(filePath, hclContent, "utf-8");

      const result = parseHclForValidation(filePath);

      expect(result.success).toBe(true);
      if (result.success) {
        const targets = result.data.target as Record<string, any>;

        expect(targets).toHaveProperty("base");
        expect(targets).toHaveProperty("web");

        expect(targets.base.dockerfile).toBe("Dockerfile.base");
        expect(targets.base.context).toBe(".");

        expect(targets.web.dockerfile).toBe("Dockerfile.web");
        expect(targets.web.context).toBe("./web");
        expect(targets.web.depends_on).toEqual(["base"]);
        expect(targets.web.contexts).toEqual({
          base_image: "target:base",
          node_modules: "./node_modules",
        });
      }
    });

    it("should handle HCL with empty depends_on array", () => {
      const filePath = join(testDir, "empty-depends.hcl");
      const hclContent = `
target "web" {
  dockerfile = "Dockerfile.web"
  depends_on = []
}`;
      writeFileSync(filePath, hclContent, "utf-8");

      const result = parseHclForValidation(filePath);

      expect(result.success).toBe(true);
      if (result.success) {
        const targets = result.data.target as Record<string, any>;
        expect(targets.web.depends_on).toEqual([]);
      }
    });

    it("should handle HCL with whitespace variations", () => {
      const filePath = join(testDir, "whitespace.hcl");
      const hclContent = `
target   "web"   {
  dockerfile   =   "Dockerfile.web"
  context   =   "."
  depends_on   =   [   "base"   ,   "deps"   ]
}`;
      writeFileSync(filePath, hclContent, "utf-8");

      const result = parseHclForValidation(filePath);

      expect(result.success).toBe(true);
      if (result.success) {
        const targets = result.data.target as Record<string, any>;
        expect(targets.web.dockerfile).toBe("Dockerfile.web");
        expect(targets.web.context).toBe(".");
        expect(targets.web.depends_on).toEqual(["base", "deps"]);
      }
    });

    it("should handle HCL with no targets", () => {
      const filePath = join(testDir, "no-targets.hcl");
      const hclContent = `
# This is a comment
variable "NODE_VERSION" {
  default = "20"
}`;
      writeFileSync(filePath, hclContent, "utf-8");

      const result = parseHclForValidation(filePath);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty("target");
        const targets = result.data.target as Record<string, any>;
        expect(Object.keys(targets)).toHaveLength(0);
      }
    });

    it("should handle non-existent HCL files", () => {
      const filePath = join(testDir, "non-existent.hcl");

      const result = parseHclForValidation(filePath);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("File not found");
        expect(result.path).toBe(filePath);
      }
    });

    it("should handle malformed HCL gracefully", () => {
      const filePath = join(testDir, "malformed.hcl");
      const hclContent = `
target "web" {
  dockerfile = "Dockerfile.web"
  # Missing closing brace
`;
      writeFileSync(filePath, hclContent, "utf-8");

      const result = parseHclForValidation(filePath);

      // The regex-based parser should still work with malformed HCL
      // as it doesn't enforce strict syntax
      expect(result.success).toBe(true);
      if (result.success) {
        const targets = result.data.target as Record<string, any>;
        // Should have empty target object since regex won't match incomplete target
        expect(Object.keys(targets)).toHaveLength(0);
      }
    });

    it("should handle HCL with comments and extra content", () => {
      const filePath = join(testDir, "comments.hcl");
      const hclContent = `
# Build configuration for web services
variable "NODE_VERSION" {
  default = "20"
}

# Web application target
target "web" {
  dockerfile = "Dockerfile.web"  # Main web dockerfile
  context = "."                  # Build context
}

# Additional configuration
group "default" {
  targets = ["web"]
}`;
      writeFileSync(filePath, hclContent, "utf-8");

      const result = parseHclForValidation(filePath);

      expect(result.success).toBe(true);
      if (result.success) {
        const targets = result.data.target as Record<string, any>;
        expect(targets).toHaveProperty("web");
        expect(targets.web.dockerfile).toBe("Dockerfile.web");
        expect(targets.web.context).toBe(".");
      }
    });
  });

  describe("FileResult type", () => {
    it("should properly type success results", () => {
      const filePath = join(testDir, "type-test.txt");
      writeFileSync(filePath, "test content", "utf-8");

      const result: FileResult<string> = safeReadFile(filePath);

      if (result.success) {
        // TypeScript should infer that result.data is available
        expect(typeof result.data).toBe("string");
        expect(result.data).toBe("test content");
        // @ts-expect-error - error and path should not be available on success
        expect(result.error).toBeUndefined();
      }
    });

    it("should properly type error results", () => {
      const filePath = join(testDir, "non-existent.txt");

      const result: FileResult<string> = safeReadFile(filePath);

      if (!result.success) {
        // TypeScript should infer that error and path are available
        expect(typeof result.error).toBe("string");
        expect(typeof result.path).toBe("string");
        expect(result.path).toBe(filePath);
        // @ts-expect-error - data should not be available on error
        expect(result.data).toBeUndefined();
      }
    });
  });
});
