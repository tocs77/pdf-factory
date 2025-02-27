import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigpaths from 'vite-tsconfig-paths';

export default defineConfig(({  mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tsconfigpaths()],
    resolve: {
      alias: {
        src: "/src",
      },
    },
    build: {
      target: 'esnext',
    },
    server: {
      port: Number(env.APP_URL),
      proxy: {
        '/api': {
          target: env.SERVER_URL,
          changeOrigin: true,
          secure: false,
          ws: true,
        }
      }
    }
  }
})


