import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		fs: {
			allow: ['.']
		}
	},
	build: {
		rollupOptions: {
			external: ['@tauri-apps/api', '@tauri-apps/api/window']
		}
	},
	optimizeDeps: {
		exclude: ['@tauri-apps/api']
	}
});