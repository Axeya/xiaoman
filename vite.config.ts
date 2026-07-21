import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from 'vite-plugin-pwa'
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    inspectAttr(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // manifest 使用 public/manifest.webmanifest（iOS 需要固定路径的 apple-touch-icon）
      manifest: false,
      workbox: {
        // 默认预缓存构建产物即可，数据在 localStorage
        globPatterns: ['**/*.{js,css,html,png,webmanifest}'],
      },
    }),
  ],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
