import esbuild from "esbuild";

const isWatchMode = process.argv.includes("--watch");
const ESM_REQUIRE_SHIM = `#!/usr/bin/env node

await (async () => {
  const { dirname } = await import("path");
  const { fileURLToPath } = await import("url");

  /**
   * Shim entry-point related paths.
   */
  if (typeof globalThis.__filename === "undefined") {
    globalThis.__filename = fileURLToPath(import.meta.url);
  }
  if (typeof globalThis.__dirname === "undefined") {
    globalThis.__dirname = dirname(globalThis.__filename);
  }
  /**
   * Shim require if needed.
   */
  if (typeof globalThis.require === "undefined") {
    const { default: module } = await import("module");
    globalThis.require = module.createRequire(import.meta.url);
  }
})();
`;

/** Tell esbuild to add the shim to emitted JS. */
const shimBanner = {
  js: ESM_REQUIRE_SHIM,
};

const watchStatus = {
  name: "watch-status",
  setup(build) {
    let isFirstBuild = true;
    let startTime;

    const getCurrentTime = () => {
      const now = new Date();
      return `${now.getHours().toString().padStart(2, "0")}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;
    };

    const log = (message) => {
      console.log(`[${getCurrentTime()}] ${message}`);
    };

    build.onStart(() => {
      startTime = Date.now();
      if (isFirstBuild) {
        log("Initial build started");
        isFirstBuild = false;
      } else {
        log("Rebuild started");
      }
    });

    build.onEnd((result) => {
      const endTime = Date.now();
      const buildTime = ((endTime - startTime) / 1000).toFixed(2);

      if (result.errors.length > 0) {
        log(`Build failed with errors (${buildTime}s)`);
      } else {
        log(`Build completed successfully (${buildTime}s)`);
      }
    });
  },
};

/**
 * ESNext + ESM, bundle: true, and require() shim in banner.
 */
const buildOptions = {
  entryPoints: ["src/index.ts", "src/widgets/index.ts", "src/examples/*.ts"],
  outdir: "./dist",
  format: "esm",
  target: "esnext",
  platform: "node",
  banner: shimBanner,
  bundle: true,
  sourcemap: true,
  minify: true,
  plugins: [
    isWatchMode && watchStatus, // Add the watchStatus plugin only in watch mode
  ].filter(Boolean), // Filter out falsy values (when not in watch mode)
};

(async () => {
  const ctx = await esbuild.context(buildOptions);
  if (isWatchMode) {
    await ctx.watch();
    console.log("Watching for changes...");
  } else {
    await ctx.rebuild();
    ctx.dispose();
    console.log("Build complete.");
  }
})();