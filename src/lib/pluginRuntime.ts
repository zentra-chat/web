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
async function loadPluginBundle(bundleUrl: string, cacheKey: string): Promise<void> {
	if (!bundleUrl || loadedBundleUrls.has(cacheKey)) {
		return;
	}

	loadedBundleUrls.add(cacheKey);

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
		loadedBundleUrls.delete(cacheKey);
		throw err;
	}
}

function withCacheBuster(url: string, cacheTag: string): string {
	const separator = url.includes('?') ? '&' : '?';
	return `${url}${separator}v=${encodeURIComponent(cacheTag)}`;
}

function pluginUpdatedAt(plugin: CommunityPlugin): number {
	const updatedAt = plugin.plugin?.updatedAt || plugin.updatedAt;
	if (!updatedAt) return 0;
	const millis = Date.parse(updatedAt);
	return Number.isNaN(millis) ? 0 : millis;
}

function pluginVersionParts(version: string): number[] {
	if (!version) return [0, 0, 0];
	return version
		.replace(/^v/i, '')
		.split('.')
		.map((part) => Number.parseInt(part.replace(/[^0-9].*$/, ''), 10))
		.map((part) => (Number.isNaN(part) ? 0 : part));
}

function comparePluginVersion(left: string, right: string): number {
	const leftParts = pluginVersionParts(left);
	const rightParts = pluginVersionParts(right);
	const maxLen = Math.max(leftParts.length, rightParts.length);

	for (let index = 0; index < maxLen; index += 1) {
		const leftValue = leftParts[index] ?? 0;
		const rightValue = rightParts[index] ?? 0;
		if (leftValue !== rightValue) {
			return leftValue - rightValue;
		}
	}

	return 0;
}

function pluginSlug(plugin: CommunityPlugin): string {
	return plugin.plugin?.slug || plugin.pluginId;
}

function pluginChannelTypes(plugin: CommunityPlugin): string[] {
	const channelTypes = plugin.plugin?.manifest?.channelTypes;
	return Array.isArray(channelTypes) ? channelTypes.filter((item) => typeof item === 'string') : [];
}

export async function loadCommunityPluginFrontends(communityId: string): Promise<void> {
	// Always load the default plugin first
	loadDefaultPlugin();

	if (!communityId || loadedCommunityIds.has(communityId)) {
		return;
	}

	const installed = await api.getCommunityPlugins(communityId);
	const enabledPlugins = (installed || [])
		.filter((cp: CommunityPlugin) => cp.enabled && cp.plugin)
		.sort((left, right) => {
			const versionDelta = comparePluginVersion(
				right.plugin?.version || '',
				left.plugin?.version || ''
			);
			if (versionDelta !== 0) return versionDelta;
			return pluginUpdatedAt(right) - pluginUpdatedAt(left);
		});

	const seenSlugs = new Set<string>();
	const claimedChannelTypes = new Set<string>();

	for (const cp of enabledPlugins) {
		const slug = pluginSlug(cp);
		if (seenSlugs.has(slug)) {
			continue;
		}

		const types = pluginChannelTypes(cp);
		if (types.some((typeId) => claimedChannelTypes.has(typeId))) {
			continue;
		}

		// Built-in plugins are compiled into the bundle, no need to load dynamically
		if (cp.plugin?.builtIn) {
			seenSlugs.add(slug);
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

		const cacheTag = `${cp.pluginId}:${cp.plugin?.updatedAt || cp.updatedAt || ''}`;
		const cacheBustedUrl = withCacheBuster(bundleUrl, cacheTag);
		await loadPluginBundle(cacheBustedUrl, cacheTag);

		seenSlugs.add(slug);
		for (const typeId of types) {
			claimedChannelTypes.add(typeId);
		}
	}

	loadedCommunityIds.add(communityId);
}

export function resetPluginRuntimeCache(): void {
	loadedBundleUrls.clear();
	loadedCommunityIds.clear();
	// Don't reset defaultPluginLoaded - it stays loaded across communities
}
