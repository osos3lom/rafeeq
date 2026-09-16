import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const getBase = () => {
  if (process.env.BASE_PATH !== undefined) {
    const p = process.env.BASE_PATH.trim()
    if (!p || p === '/') return '/'
    return `/${p.replace(/^\/+|\/+$/g, '')}/`
  }
  if (process.env.GITHUB_ACTIONS) {
    return '/rafeeq/'
  }
  return '/'
}

// https://vite.dev/config/
export default defineConfig({
  base: getBase(),
  plugins: [react()],
})
