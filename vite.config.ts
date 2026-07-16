import { defineConfig, type Plugin } from "vite";
import { resolve } from "path";
import { writeFileSync, readFileSync } from "fs";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

type Browser = "firefox" | "chrome";

const browser: Browser =
  process.env.BROWSER === "chrome" ? "chrome" : "firefox";

const { version } = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf-8"),
) as { version: string };

const baseManifest = {
  manifest_version: 3,
  name: "Element Translator",
  version,
  description:
    "Translate clicked <p>/<li> text and show in popup with history.",
  action: {
    default_title: "Translate Element",
    default_popup: "popup.html",
  },
  permissions: ["storage", "activeTab"],
  host_permissions: ["http://127.0.0.1:1234/*", "http://localhost:1234/*"],
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["browser-polyfill.js", "content.js"],
      run_at: "document_idle",
    },
  ],
};

const manifests: Record<Browser, object> = {
  firefox: {
    ...baseManifest,
    browser_specific_settings: {
      gecko: {
        id: "siokonbu_addon@example.com",
        data_collection_permissions: {
          required: ["websiteContent"],
          optional: [],
        },
      },
    },
    background: {
      scripts: ["background.js"],
      type: "module",
    },
  },
  chrome: {
    ...baseManifest,
    background: {
      service_worker: "background.js",
      type: "module",
    },
  },
};

function manifestPlugin(browser: Browser): Plugin {
  return {
    name: "generate-manifest",
    writeBundle(options) {
      const dir = options.dir!;
      const manifest = JSON.stringify(manifests[browser], null, 2) + "\n";
      writeFileSync(resolve(dir, "manifest.json"), manifest);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), manifestPlugin(browser)],
  build: {
    outDir: `dist/${browser}`,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        background: resolve(__dirname, "src/background.ts"),
        content: resolve(__dirname, "src/content.ts"),
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
});
