import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

/**
 * Local development / self-hosting config.
 *
 *   npm run dev     → http://localhost:8080 (HMR)
 *   npm run build   → .output/  (Nitro node-server bundle)
 *   npm start       → serves .output on http://localhost:8080
 *
 * Set PORT / HOST to override at run time.
 */
const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? "localhost";

export default defineConfig(({ command, isPreview }) => ({
  server: {
    host: HOST,
    port: PORT,
  },
  preview: {
    host: HOST,
    port: PORT + 1,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    ...(command === "build" || isPreview ? [nitro({ preset: "node-server" })] : []),
    viteReact(),
  ],
}));
