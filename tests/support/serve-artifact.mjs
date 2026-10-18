// IMP-01 — Playwright webServer entry: build fresh + assemble + serve.
//
// Replaces `QA_PROBE=1 npm run build && astro preview`: astro preview serves
// dist/ only, which never contains /media/ (the derivatives live in
// generated/media/ until final release assembly). This harness performs the
// test-side assembly (tests/support/artifact.mjs) and serves the isolated,
// self-contained artifact instead.
//
// Usage: node tests/support/serve-artifact.mjs [--mode qa] [--port 4179]
// Modes: qa (default — test-only QA harness build, includes /qa-probe)
//        production (canonical production build)
// The build is ALWAYS run fresh (explicit mode contract, IMP-05): no reuse
// of whatever dist/ happens to contain.
import { runBuild, assembleArtifact, createStaticServer, artifactRoot } from "./artifact.mjs";

function parseArgs(argv) {
  const args = { mode: "qa", port: 4179 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--mode") args.mode = argv[++i];
    else if (argv[i] === "--port") args.port = Number(argv[++i]);
  }
  if (!["production", "qa"].includes(args.mode)) {
    throw new Error(`--mode must be production|qa, got: ${args.mode}`);
  }
  return args;
}

const { mode, port } = parseArgs(process.argv.slice(2));

const sourceDir = runBuild(mode);
const artifact = assembleArtifact(sourceDir, mode);
const server = createStaticServer(artifact);
server.listen(port, "127.0.0.1", () => {
  console.log(`[serve-artifact] mode=${mode} artifact=${artifactRoot(mode)} http://127.0.0.1:${port}/`);
});
