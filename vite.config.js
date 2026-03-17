import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/firebase/")) return "firebase";
          if (id.includes("node_modules/jspdf") || id.includes("node_modules/html2canvas")) {
            return "pdf";
          }
          if (id.includes("node_modules/jsqr") || id.includes("node_modules/qrcode")) {
            return "qr";
          }
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "react-vendor";
          }
        },
      },
    },
  },
})
