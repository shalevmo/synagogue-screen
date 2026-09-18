import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Baked at build time from package.json (bumped by the deploy workflow).
    // The kiosk displays it under the clock; CI writes the same value to
    // Firestore /version/current so clients can detect+reload on deploys.
    __APP_VERSION__: JSON.stringify(JSON.parse(
      readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
    ).version),
  },
})
