import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { resolveApiBaseUrl } from './src/apiEnvironment.utils.js'

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    // Fail before publishing a bundle that would send users to localhost.
    resolveApiBaseUrl(loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE_URL, true)
  }
  return {
    plugins: [react()],
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: { groups: [{ name(moduleId) {
            if (moduleId.includes('/node_modules/@supabase/')) return 'supabase'
            if (moduleId.includes('/node_modules/')) return 'vendor'
            return null
          } }] },
        },
      },
    },
  }
})
