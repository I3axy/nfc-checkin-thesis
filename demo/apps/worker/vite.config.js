import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  // HTTPS (self-signed) so Web NFC works on a phone over the LAN —
  // the Web NFC API requires a secure context, which a plain http://<ip> is not.
  plugins: [react(), basicSsl()],
  server: {
    host: true,          // listen on the LAN IP, not just localhost
    allowedHosts: true,
  },
})
