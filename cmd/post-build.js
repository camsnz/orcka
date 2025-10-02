#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const distributable_dir = "bin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get build info
const buildDate = new Date().toISOString();
let gitSha = "unknown";
let gitBranch = "unknown";
const gitAppDir = path.relative(
	path.dirname(path.dirname(__dirname)), // Get parent of SCRIPT_DIR
	process.cwd(), // Current working directory (GIT_DIR)
);

try {
	gitSha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
	gitBranch = execSync("git rev-parse --abbrev-ref HEAD", {
		encoding: "utf8",
	}).trim();
} catch (_error) {
	console.warn("Warning: Could not get git information");
}

// Read header template
const headerPath = path.join(__dirname, "..", "src", "header.txt");
let header = "";

if (fs.existsSync(headerPath)) {
	header = fs
		.readFileSync(headerPath, "utf8")
		.replace("${BUILD_DATE}", buildDate)
		.replace(/\${GIT_SHA}/g, gitSha)
		.replace(/\${DIR_PATH}/g, gitAppDir)
		.replace("${GIT_BRANCH}", gitBranch);
}

// Process the built file
const distPath = path.join(__dirname, "..", distributable_dir, "orcka.cjs");

if (fs.existsSync(distPath)) {
	let content = fs.readFileSync(distPath, "utf8");

	// Replace build info placeholders in the content
	content = content
		.replace("${BUILD_DATE}", buildDate)
		.replace(/\${GIT_SHA}/g, gitSha)
		.replace("${GIT_BRANCH}", gitBranch);

	// Add shebang and header
	const shebang = "#!/usr/bin/env node\n\n";
	const finalContent = content.startsWith("#!/usr/bin/env node")
		? content.replace("#!/usr/bin/env node", shebang + header)
		: `${shebang + header}\n${content}`;

	fs.writeFileSync(distPath, finalContent);

	// Make executable
	fs.chmodSync(distPath, "755");

	console.log(
		"✓ Added build info header, shebang and made orcka.cjs executable",
	);
	console.log(`✓ Build: ${buildDate}`);
	console.log(`✓ Git SHA: ${gitSha.substring(0, 8)}`);
	console.log(`✓ Branch: ${gitBranch}`);
} else {
	console.error("✗ bin/orcka.cjs not found");
	process.exit(1);
}
