// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// GitHub Pages build: `GITHUB_PAGES=true npm run build`.
// Everything below is inert for the normal Lovable build.
const isGithubPages = process.env["GITHUB_PAGES"] === "true";

// Project pages are served from https://<user>.github.io/<repo>/, so the app
// needs that sub-path as its base. Derived from GITHUB_REPOSITORY (set by
// GitHub Actions) or overridable with GH_PAGES_BASE. Never hardcoded.
const repoName = process.env["GITHUB_REPOSITORY"]?.split("/")[1];
const ghPagesBase =
  process.env["GH_PAGES_BASE"] ?? (repoName ? `/${repoName}/` : "/");

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Static SPA output: one HTML shell, client-side router takes over.
    ...(isGithubPages ? { spa: { enabled: true } } : {}),
  },
  // Static preset => plain files, no runtime server.
  ...(isGithubPages ? { nitro: { preset: "static" as const } } : {}),
  vite: {
    ...(isGithubPages ? { base: ghPagesBase } : {}),
  },
});
