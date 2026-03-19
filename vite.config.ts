import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'node:path';
import { defineConfig } from 'vite';

const pluginSdkPath = process.env.ZENTRA_PLUGIN_SDK_PATH?.trim();
const useLocalPluginSdk = Boolean(pluginSdkPath) && process.env.NODE_ENV !== 'production';
const localPluginSdkRoot = useLocalPluginSdk ? path.resolve(process.cwd(), pluginSdkPath as string) : '';

const pluginSdkAlias = useLocalPluginSdk
	? {
			'@zentra/plugin-sdk/runtime': path.join(localPluginSdkRoot, 'src/runtime.ts'),
			'@zentra/plugin-sdk': path.join(localPluginSdkRoot, 'src'),
			'@zentra-chat/plugin-sdk/runtime': path.join(localPluginSdkRoot, 'src/runtime.ts'),
			'@zentra-chat/plugin-sdk': path.join(localPluginSdkRoot, 'src')
		}
	: {
			'@zentra/plugin-sdk/runtime': '@zentra-chat/plugin-sdk/runtime',
			'@zentra/plugin-sdk': '@zentra-chat/plugin-sdk'
		};

const fsAllow = useLocalPluginSdk ? ['.', '..', localPluginSdkRoot] : ['.', '..'];

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	resolve: {
		alias: {
			'@zentra/default-plugin': new URL('./default-plugin/src', import.meta.url).pathname,
			...pluginSdkAlias
		}
	},
	server: {
		fs: {
			allow: fsAllow
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