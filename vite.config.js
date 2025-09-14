// // vite.config.js
// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'
// import path from 'path'

// export default defineConfig(({ mode }) => {
//   const isCI = process.env.CI === 'true'

//   return {
//     plugins: [react()],
//     server: {
//       port: 5176,
//       open: !isCI,          // don't auto-open in CI
//       host: false,          // change to true if you want LAN access
//       proxy: {
//         '/api': {
//           target: 'http://localhost:4000',
//           changeOrigin: true,
//           secure: false,
//         },
//         '/uploads': {
//           target: 'http://localhost:4000',
//           changeOrigin: true,
//           secure: false,
//         },
//       },
//     },
//     resolve: {
//       alias: {
//         '@': path.resolve(__dirname, 'src'),
//       },
//     },
//     // set base if you host app under a subpath in production
//     // base: process.env.BASE_URL || '/',
//   }
// })
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const isCI = process.env.CI === 'true'
  const isDev = mode === 'development'

  return {
    plugins: [react()],
    server: isDev ? {
      port: 5176,
      open: !isCI,          // don't auto-open in CI
      host: false,          // change to true if you want LAN access
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: 'http://localhost:4000',
          changeOrigin: true,
          secure: false,
        },
      },
    } : undefined,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    // base: process.env.BASE_URL || '/',
  }
})
