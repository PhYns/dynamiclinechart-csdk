import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
    server: {
    port: 5173,
    // Fail loudly instead of silently moving to 5174 if the port is taken.
    // The CORS entry you are about to add on the Sisense side names this exact
    // origin, so a port that quietly drifts means a broken demo.
    strictPort: true,
    }  
})