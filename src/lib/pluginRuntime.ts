// Plugin runtime - handles loading plugin frontend bundles and managing
// the lifecycle of plugins across community switches.
//
// The default plugin is loaded at build time via direct import.
// Third-party plugins are loaded dynamically from their bundle URLs.
// All plugins interact with Zentra through the same SDK API.

import { api } from '$lib/api';
import { ZentraSDK } from '$lib/pluginSDK';
import type { ZentraPluginSDK } from '@zentra/plugin-sdk';
import { register as registerDefaultPlugin } from '@zentra/default-plugin';
import type { CommunityPlugin } from '$lib/types';

const loadedBundleUrls = new Set<string>();
const loadedCommunityIds = new Set<string>();
let defaultPluginLoaded = false;

// Load the built-in default plugin. This runs synchronously since the
// plugin is compiled into the main bundle. Called once before any
// third-party plugins are loaded.
export function loadDefaultPlugin(): void {
	if (defaultPluginLoaded) return;
	defaultPluginLoaded = true;
	const sdk = ZentraSDK as unknown as ZentraPluginSDK;
	const win = window as Window & { ZentraSDK?: ZentraPluginSDK; ZentraPluginAPI?: ZentraPluginSDK };
	win.ZentraSDK = sdk;
	win.ZentraPluginAPI = sdk;
	registerDefaultPlugin(sdk);
}

function normalizeBundleUrl(bundlePath: string): string {
	if (!bundlePath) return '';
	if (bundlePath.startsWith('http://') || bundlePath.startsWith('https://')) {
		return bundlePath;
	}
	if (bundlePath.startsWith('/')) {
		return bundlePath;
	}
	return `/${bundlePath.replace(/^\/+/, '')}`;
}

// Load a third-party plugin's frontend bundle. The SDK is exposed both
// as a function argument and on window for IIFE-style plugin bundles.
async function loadPluginBundle(bundleUrl: string): Promise<void> {
	if (!bundleUrl || loadedBundleUrls.has(bundleUrl)) {
		return;
	}

	loadedBundleUrls.add(bundleUrl);

	// Expose SDK globally so IIFE plugins can grab it
	const sdk = ZentraSDK as unknown as ZentraPluginSDK;
	const win = window as Window & { ZentraSDK?: ZentraPluginSDK; ZentraPluginAPI?: ZentraPluginSDK };
	win.ZentraSDK = sdk;
	win.ZentraPluginAPI = sdk; // backwards compat

	try {
		const mod = await import(/* @vite-ignore */ bundleUrl);
		const registerFn = (mod as { register?: (sdk: ZentraPluginSDK) => void }).register;
		if (typeof registerFn === 'function') {
			registerFn(sdk);
		}
	} catch (err) {
		loadedBundleUrls.delete(bundleUrl);
		throw err;
	}
}

export async function loadCommunityPluginFrontends(communityId: string): Promise<void> {
	// Always load the default plugin first
	loadDefaultPlugin();

	if (!communityId || loadedCommunityIds.has(communityId)) {
		return;
	}

	const installed = await api.getCommunityPlugins(communityId);
	const enabledPlugins = (installed || []).filter((cp: CommunityPlugin) => cp.enabled && cp.plugin);

	for (const cp of enabledPlugins) {
		// Built-in plugins are compiled into the bundle, no need to load dynamically
		if (cp.plugin?.builtIn) {
			continue;
		}

		const bundlePath = cp.plugin?.manifest?.frontendBundle;
		if (!bundlePath) {
			continue;
		}
		const bundleUrl = normalizeBundleUrl(bundlePath);
		if (!bundleUrl) {
			continue;
		}
		await loadPluginBundle(bundleUrl);
	}

	loadedCommunityIds.add(communityId);
}

export function resetPluginRuntimeCache(): void {
	loadedBundleUrls.clear();
	loadedCommunityIds.clear();
	// Don't reset defaultPluginLoaded - it stays loaded across communities
}
