import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:4173", ...devices["Desktop Chrome"] },
  webServer: {
    // Ecart #5 du plan : `vite preview` seul se lie a `[::1]` (localhost IPv6)
    // sous Windows ; l'URL d'attente 127.0.0.1 ne repond jamais -> timeout.
    // `--host 127.0.0.1` force le binding IPv4 attendu par `baseURL`.
    command: "npm run build && npm run preview -- --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
