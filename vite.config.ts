import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter(
          dep =>
            !dep.includes('vendor-three') &&
            !dep.includes('vendor-rapier') &&
            !dep.includes('vendor-kinetic') &&
            !dep.includes('MochiTube') &&
            !dep.includes('Scene3D') &&
            !dep.includes('PilePhysics') &&
            !dep.includes('RefractiveLoupe') &&
            !dep.includes('BeliefSection') &&
            !dep.includes('FooterSection'),
        ),
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('vite/preload-helper') || id.includes('commonjsHelpers')) {
            return 'vendor-react'
          }
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@react-three/rapier') || id.includes('@dimforge/rapier')) return 'vendor-rapier'
          if (id.includes('three') || id.includes('@react-three')) return 'vendor-three'
          if (id.includes('gsap') || id.includes('lenis')) return 'vendor-motion'
          if (id.includes('opentype.js') || id.includes('matter-js')) return 'vendor-kinetic'
          if (id.includes('react')) return 'vendor-react'
          return undefined
        },
      },
    },
  },
})
