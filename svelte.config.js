import adapter from '@sveltejs/adapter-static';
import path from 'node:path';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const pluginSdkPath = process.env.ZENTRA_PLUGIN_SDK_PATH?.trim();
const useLocalPluginSdk = Boolean(pluginSdkPath) && process.env.NODE_ENV !== 'production';
const localPluginSdkRoot = useLocalPluginSdk ? path.resolve(process.cwd(), pluginSdkPath) : '';

const pluginSdkAlias = useLocalPluginSdk
	? {
			'@zentra/plugin-sdk/runtime': path.join(localPluginSdkRoot, 'src/runtime.ts'),
			'@zentra/plugin-sdk': path.join(localPluginSdkRoot, 'src'),
			'@zentra-chat/plugin-sdk/runtime': path.join(localPluginSdkRoot, 'src/runtime.ts'),
			'@zentra-chat/plugin-sdk': path.join(localPluginSdkRoot, 'src')
		}
	: {};

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		alias: {
			'@zentra/default-plugin': './default-plugin/src',
			...pluginSdkAlias
		},
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter({
			fallback: 'index.html', // Enable SPA mode
			pages: 'build',
			assets: 'build',
			precompress: false,
			strict: true
		})
	}
};

export default config;
