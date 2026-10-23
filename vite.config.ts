import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: { host: true },
  // three.js alone is ~700 kB; the bundle ships inside the app, not over the network.
  build: { chunkSizeWarningLimit: 1500 },
  test: {
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
  },
})
