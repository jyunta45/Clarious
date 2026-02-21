import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";

const distDir = path.resolve("dist");
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

await esbuild.build({
  entryPoints: ["server/index.ts"],
  outfile: "dist/index.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: [
    "pg-native",
    "bufferutil",
    "utf-8-validate",
    "bcrypt",
    "pg",
    "connect-pg-simple",
    "express",
    "express-session",
  ],
  loader: {
    ".ts": "ts",
    ".js": "js",
  },
  resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  sourcemap: true,
  minify: false,
});

fs.cpSync("public", path.join(distDir, "public"), { recursive: true });

console.log("Build completed successfully!");
