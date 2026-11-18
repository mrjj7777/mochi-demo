import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@react-three/rapier') || id.includes('@dimforge/rapier')) return 'vendor-rapier'
            if (id.includes('three') || id.includes('@react-three')) return 'vendor-three'
            if (id.includes('gsap') || id.includes('lenis')) return 'vendor-motion'
            if (id.includes('opentype.js') || id.includes('matter-js')) return 'vendor-kinetic'
            if (id.includes('react')) return 'vendor-react'
          }
        },
      },
    },
  },
})
