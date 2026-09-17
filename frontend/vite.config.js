import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-charts': ['chart.js', 'react-chartjs-2', 'chartjs-plugin-datalabels'],
          'vendor-supabase': ['@supabase/supabase-js'],
        }
      }
    }
  }
})
