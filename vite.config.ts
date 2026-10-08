import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}


// Every Vercel and Railway frontend build publishes its immutable source revision.
// Do not use the latest backend build to identify the frontend: they deploy independently.
function herenciaDeploymentManifest() {
  return {
    name: 'herencia-deployment-manifest',
    apply: 'build',
    generateBundle() {
      const candidate = process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.RAILWAY_GIT_COMMIT_SHA ||
        process.env.GITHUB_SHA || '';
      const commit = /^[0-9a-f]{40}$/i.test(candidate) ? candidate.toLowerCase() : null;
      const platform = process.env.VERCEL ? 'vercel' :
        process.env.RAILWAY_ENVIRONMENT_ID ? 'railway' : 'local';
      this.emitFile({
        type: 'asset',
        fileName: 'herencia-deploy.json',
        source: JSON.stringify({ commit, platform, builtAt: new Date().toISOString() }),
      });
    },
  };
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    herenciaDeploymentManifest(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    proxy: process.env.VITE_API_URL
      ? undefined
      : {
          '/api': {
            target: process.env.DEV_BACKEND_URL || 'http://127.0.0.1:3001',
            changeOrigin: true,
          },
        },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
