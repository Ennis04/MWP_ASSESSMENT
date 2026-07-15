import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const page = (name) => fileURLToPath(new URL(name, import.meta.url));

export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        main: page('./index.html'),
        ennis: page('./ennis.html'),
        liew: page('./liew.html'),
        chua: page('./chua.html'),
        tai: page('./tai.html')
      }
    }
  }
});
