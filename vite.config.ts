import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

function getVersion(): string {
	try {
		const stdout = execSync('git log -1 --format="%ct" HEAD', { encoding: 'utf-8' }).trim();
		const d = new Date(parseInt(stdout, 10) * 1000);
		const y = d.getUTCFullYear();
		const m = String(d.getUTCMonth() + 1).padStart(2, '0');
		const day = String(d.getUTCDate()).padStart(2, '0');
		const h = String(d.getUTCHours()).padStart(2, '0');
		const min = String(d.getUTCMinutes()).padStart(2, '0');
		return `${y}.${m}.${day}.${h}${min}`;
	} catch {
		return '0.0.0';
	}
}

const pluginSdkPath = process.env.ZENTRA_PLUGIN_SDK_PATH?.trim();
const useLocalPluginSdk = Boolean(pluginSdkPath) && process.env.NODE_ENV !== 'production';
const localPluginSdkRoot = useLocalPluginSdk
	? path.resolve(process.cwd(), pluginSdkPath as string)
	: '';

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
	define: {
		__APP_VERSION__: JSON.stringify(getVersion())
	},
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
		include: ['@emoji-mart/data', 'markdown-it', 'markdown-it-ins'],
		exclude: ['@tauri-apps/api']
	}
});
