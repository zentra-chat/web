import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	resolve: {
		alias: {
			'@zentra/default-plugin': new URL('../default-plugin/src', import.meta.url).pathname,
			'@zentra/plugin-sdk/runtime': new URL('../plugin-sdk/src/runtime.ts', import.meta.url).pathname,
			'@zentra/plugin-sdk': new URL('../plugin-sdk/src', import.meta.url).pathname
		}
	},
	server: {
		fs: {
			allow: ['.', '..']
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