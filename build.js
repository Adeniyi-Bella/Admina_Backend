const esbuild = require("esbuild");

esbuild.build({
  entryPoints: ["src/server.ts"],
  outfile: "dist/app.js",
  bundle: true,
  platform: "node",
  target: "node18",
  external: ["pdf-parse"]
});