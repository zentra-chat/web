// Plugin sandbox - manages iframe isolation for third-party plugins.
// Each plugin gets its own sandboxed iframe. All SDK access goes through
// a postMessage bridge that validates every call against the plugin's
// granted permissions before executing it.

import type {
	PluginMessageEnvelope,
	PluginRequest,
	HostResponse
} from '$lib/pluginBridge';
import {
	PERMISSION_METHOD_MAP,
	BLOCKED_METHODS
} from '$lib/pluginBridge';
import { api } from '$lib/api';
import {
	activeChannel,
	activeCommunity,
	activeChannelMessages,
	addMessage
} from '$lib/stores/community';
import { addToast } from '$lib/stores/ui';
import {
	register as registerChannelType,
	unregister as unregisterChannelType,
	registerHeaderAction,
	unregisterHeaderAction
} from '$lib/channelTypes';
import { PluginPermission } from '$lib/types';
import type { ChannelHeaderActionContext } from '$lib/channelTypes';

// Lazy-load the icon resolver to avoid circular deps at module level
let iconResolver: ((name: string) => unknown) | null = null;
async function getIconResolver() {
	if (iconResolver) return iconResolver;
	const { ZentraSDK } = await import('$lib/pluginSDK');
	iconResolver = (name: string) => ZentraSDK.getIcon(name);
	return iconResolver;
}

interface SandboxedPlugin {
	pluginId: string;
	iframe: HTMLIFrameElement;
	grantedPermissions: number;
	bundleUrl: string;
	ready: boolean;
	// Header action callbacks that live on the host side - the iframe just
	// tells us the action ID, we forward the click context back to it
	headerActionCallbacks: Map<string, (ctx: ChannelHeaderActionContext) => void>;
	// Cleanup functions for store subscriptions
	unsubscribers: Array<() => void>;
}

const sandboxes = new Map<string, SandboxedPlugin>();

// Hidden staging area where plugin iframes live when they're not actively
// visible. Iframes must be attached to the DOM for their scripts to run,
// so we keep them here off-screen until a PluginFrame mounts them.
let hiddenContainer: HTMLDivElement | null = null;
function getHiddenContainer(): HTMLDivElement {
	if (!hiddenContainer) {
		hiddenContainer = document.createElement('div');
		hiddenContainer.style.cssText =
			'position:fixed;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;';
		hiddenContainer.setAttribute('aria-hidden', 'true');
		document.body.appendChild(hiddenContainer);
	}
	return hiddenContainer;
}

// Move an iframe back to the hidden staging area (called when the user
// navigates away from a plugin's channel type view)
export function stagePluginIframe(pluginId: string): void {
	const sandbox = sandboxes.get(pluginId);
	if (!sandbox) return;
	getHiddenContainer().appendChild(sandbox.iframe);
}

// Creates a sandboxed iframe for a third-party plugin. The bundle is fetched
// from the host frame and inlined into the srcdoc to avoid CORS issues with
// module scripts in sandboxed iframes (which have a null origin).
// The iframe starts in a hidden staging area - PluginFrame.svelte moves it
// into the visible DOM when a plugin's channel type is active.
export async function createPluginSandbox(
	pluginId: string,
	bundleUrl: string,
	grantedPermissions: number
): Promise<HTMLIFrameElement> {
	// Tear down any existing sandbox for this plugin
	destroyPluginSandbox(pluginId);

	const iframe = document.createElement('iframe');

	// Strict sandbox: allow scripts only. No same-origin, no forms, no popups,
	// no top navigation, no downloads. The plugin cannot access the parent
	// document, localStorage, cookies, or any same-origin APIs.
	iframe.sandbox.add('allow-scripts');

	// CORS-isolated with a unique null origin so the plugin can't reach
	// back to our storage
	iframe.style.border = 'none';
	iframe.style.width = '100%';
	iframe.style.height = '100%';
	iframe.setAttribute('loading', 'lazy');
	iframe.setAttribute('title', `Plugin: ${pluginId}`);

	const sandbox: SandboxedPlugin = {
		pluginId,
		iframe,
		grantedPermissions,
		bundleUrl,
		ready: false,
		headerActionCallbacks: new Map(),
		unsubscribers: []
	};

	sandboxes.set(pluginId, sandbox);

	// Listen for messages from this iframe
	const handler = (e: MessageEvent) => handleMessage(sandbox, e);
	window.addEventListener('message', handler);
	sandbox.unsubscribers.push(() => window.removeEventListener('message', handler));

	// Wire up store subscriptions to push state changes to the iframe
	wireStoreSubscriptions(sandbox);

	// Fetch the plugin bundle from our origin (the host frame can reach it
	// without CORS issues) and inline it into the srcdoc. We do this because
	// module scripts in a sandboxed iframe (null origin) would need CORS
	// headers on the server, and inlining avoids that entirely.
	let bundleSource = '';
	try {
		const res = await fetch(bundleUrl);
		if (!res.ok) throw new Error(`HTTP ${res.status} fetching plugin bundle`);
		bundleSource = await res.text();
	} catch (err) {
		console.error(`[PluginSandbox] Failed to load bundle for "${pluginId}":`, err);
		for (const unsub of sandbox.unsubscribers) unsub();
		sandboxes.delete(pluginId);
		throw err;
	}

	iframe.srcdoc = buildSrcdoc(pluginId, bundleSource, grantedPermissions);

	// Attach to the hidden staging area so the iframe's scripts actually run.
	// PluginFrame.svelte will move it into the visible DOM when needed.
	getHiddenContainer().appendChild(iframe);

	return iframe;
}

export function destroyPluginSandbox(pluginId: string): void {
	const sandbox = sandboxes.get(pluginId);
	if (!sandbox) return;

	for (const unsub of sandbox.unsubscribers) {
		unsub();
	}

	sandbox.iframe.remove();
	sandboxes.delete(pluginId);
}

// Tear down every active sandbox (used on community switch)
export function destroyAllPluginSandboxes(): void {
	for (const pluginId of [...sandboxes.keys()]) {
		destroyPluginSandbox(pluginId);
	}
}

export function getPluginIframe(pluginId: string): HTMLIFrameElement | null {
	return sandboxes.get(pluginId)?.iframe ?? null;
}

// Build the HTML content for the sandboxed iframe. The bundle source is
// inlined directly so we don't need external script loads from a null origin.
function buildSrcdoc(pluginId: string, bundleSource: string, grantedPermissions: number): string {
	// Escape </script> in the bundle so the HTML parser doesn't treat it as
	// the end of our script tag. \/ is a valid JS escape for / so this is safe.
	const escapedBundle = bundleSource.replace(/<\/script/gi, '<\\/script');
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
	*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
	html, body { width: 100%; height: 100%; overflow: hidden; }
	body {
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: #0A1427;
		color: #f1f5f9;
	}
</style>
</head>
<body>
<div id="plugin-root" style="width:100%;height:100%;"></div>
<script>
// Inline guest bridge - sets up window.__zentra with the postMessage SDK
(function() {
	const PLUGIN_ID = ${JSON.stringify(pluginId)};
	const GRANTED_PERMISSIONS = ${grantedPermissions};
	const pendingCalls = new Map();
	let callIdCounter = 0;
	let readyResolve;
	const readyPromise = new Promise(r => { readyResolve = r; });

	// Channel state pushed from host
	let currentChannel = null;
	let currentMessages = [];
	let currentCommunityId = null;
	const listeners = { channel: [], messages: [], community: [] };

	function send(payload) {
		window.parent.postMessage({
			__zentra_plugin: true,
			pluginId: PLUGIN_ID,
			payload: payload
		}, '*');
	}

	function callSDK(method, args) {
		return new Promise((resolve, reject) => {
			const id = String(++callIdCounter);
			pendingCalls.set(id, { resolve, reject });
			send({ type: 'sdk:call', id, method, args: args || [] });
			// Timeout after 15 seconds so we don't leak promises
			setTimeout(() => {
				if (pendingCalls.has(id)) {
					pendingCalls.delete(id);
					reject(new Error('SDK call timed out: ' + method));
				}
			}, 15000);
		});
	}

	window.addEventListener('message', function(e) {
		const data = e.data;
		if (!data || !data.__zentra_plugin || data.pluginId !== PLUGIN_ID) return;
		const msg = data.payload;
		if (!msg) return;

		if (msg.type === 'sdk:response') {
			const pending = pendingCalls.get(msg.id);
			if (pending) {
				pendingCalls.delete(msg.id);
				if (msg.error) {
					pending.reject(new Error(msg.error));
				} else {
					pending.resolve(msg.result);
				}
			}
		} else if (msg.type === 'host:init') {
			if (readyResolve) { readyResolve(); readyResolve = null; }
		} else if (msg.type === 'host:channel-changed') {
			currentChannel = msg.channelId ? { id: msg.channelId, type: msg.channelType } : null;
			listeners.channel.forEach(fn => fn(currentChannel));
		} else if (msg.type === 'host:messages-updated') {
			currentMessages = msg.messages || [];
			listeners.messages.forEach(fn => fn(currentMessages));
		} else if (msg.type === 'host:community-changed') {
			currentCommunityId = msg.communityId;
			listeners.community.forEach(fn => fn(currentCommunityId));
		} else if (msg.type === 'host:header-action-clicked') {
			const cb = headerActionHandlers.get(msg.actionId);
			if (cb) cb(msg.context);
		}
	});

	const headerActionHandlers = new Map();

	// This is the SDK object that plugins use. It mirrors ZentraPluginSDK
	// but every call goes through postMessage instead of direct access.
	window.__zentra = {
		pluginId: PLUGIN_ID,
		grantedPermissions: GRANTED_PERMISSIONS,
		ready: readyPromise,

		// API calls - all async, go through the bridge
		api: new Proxy({}, {
			get(_, method) {
				return function(...args) {
					return callSDK('api.' + method, args);
				};
			}
		}),

		// UI actions
		ui: {
			addToast: function(toast) { return callSDK('ui.addToast', [toast]); },
			addMessage: function(channelId, message) { return callSDK('ui.addMessage', [channelId, message]); }
		},

		// Reactive-ish state with subscribe pattern (works without Svelte)
		stores: {
			activeChannel: {
				get: function() { return currentChannel; },
				subscribe: function(fn) {
					listeners.channel.push(fn);
					fn(currentChannel);
					return function() {
						listeners.channel = listeners.channel.filter(f => f !== fn);
					};
				}
			},
			activeChannelMessages: {
				get: function() { return currentMessages; },
				subscribe: function(fn) {
					listeners.messages.push(fn);
					fn(currentMessages);
					return function() {
						listeners.messages = listeners.messages.filter(f => f !== fn);
					};
				}
			},
			currentCommunityId: {
				get: function() { return currentCommunityId; },
				subscribe: function(fn) {
					listeners.community.push(fn);
					fn(currentCommunityId);
					return function() {
						listeners.community = listeners.community.filter(f => f !== fn);
					};
				}
			}
		},

		// Registration (these go through the bridge too)
		registerChannelType: function(def) {
			const id = String(++callIdCounter);
			send({
				type: 'plugin:register-channel-type',
				id: id,
				def: {
					typeId: def.id,
					icon: typeof def.icon === 'string' ? def.icon : 'hash',
					label: def.label,
					description: def.description,
					showHash: def.showHash,
					headerActionIds: def.headerActionIds
				}
			});
		},

		unregisterChannelType: function(typeId) {
			const id = String(++callIdCounter);
			send({ type: 'plugin:unregister-channel-type', id: id, typeId: typeId });
		},

		registerHeaderAction: function(def) {
			const id = String(++callIdCounter);
			if (def.onClick) {
				headerActionHandlers.set(def.id, def.onClick);
			}
			send({
				type: 'plugin:register-header-action',
				id: id,
				def: {
					actionId: def.id,
					title: def.title,
					icon: typeof def.icon === 'string' ? def.icon : 'hash'
				}
			});
		},

		unregisterHeaderAction: function(actionId) {
			const id = String(++callIdCounter);
			headerActionHandlers.delete(actionId);
			send({ type: 'plugin:unregister-header-action', id: id, actionId: actionId });
		},

		// DOM root for rendering
		getRootElement: function() { return document.getElementById('plugin-root'); }
	};

	// Tell the host we're ready to receive
	send({ type: 'plugin:ready' });
})();
${'<'}/script>
<script type="module">
${escapedBundle}
${'<'}/script>
</body>
</html>`;
}

// Handle messages from a plugin iframe
function handleMessage(sandbox: SandboxedPlugin, event: MessageEvent) {
	const data = event.data as PluginMessageEnvelope | undefined;
	if (!data || !data.__zentra_plugin) return;
	if (data.pluginId !== sandbox.pluginId) return;

	// Verify the message actually came from this plugin's iframe
	if (event.source !== sandbox.iframe.contentWindow) return;

	const msg = data.payload as PluginRequest;
	if (!msg || !msg.type) return;

	switch (msg.type) {
		case 'plugin:ready':
			handlePluginReady(sandbox);
			break;
		case 'sdk:call':
			handleSDKCall(sandbox, msg.id, msg.method, msg.args);
			break;
		case 'plugin:register-channel-type':
			handleRegisterChannelType(sandbox, msg);
			break;
		case 'plugin:unregister-channel-type':
			handleUnregisterChannelType(sandbox, msg.typeId);
			break;
		case 'plugin:register-header-action':
			handleRegisterHeaderAction(sandbox, msg);
			break;
		case 'plugin:unregister-header-action':
			handleUnregisterHeaderAction(sandbox, msg.actionId);
			break;
	}
}

function sendToPlugin(sandbox: SandboxedPlugin, payload: HostResponse) {
	sandbox.iframe.contentWindow?.postMessage(
		{
			__zentra_plugin: true,
			pluginId: sandbox.pluginId,
			payload
		} satisfies PluginMessageEnvelope,
		'*'
	);
}

function handlePluginReady(sandbox: SandboxedPlugin) {
	sandbox.ready = true;
	sendToPlugin(sandbox, {
		type: 'host:init',
		grantedPermissions: sandbox.grantedPermissions,
		pluginId: sandbox.pluginId
	});
}

// Execute an SDK call from a plugin, but only if the method is allowed
// by the plugin's granted permissions
async function handleSDKCall(
	sandbox: SandboxedPlugin,
	callId: string,
	method: string,
	args: unknown[]
) {
	try {
		const result = await executeSDKMethod(sandbox, method, args);
		sendToPlugin(sandbox, { type: 'sdk:response', id: callId, result });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		sendToPlugin(sandbox, { type: 'sdk:response', id: callId, error: message });
	}
}

// The core permission check + dispatch for SDK calls from the bridge
async function executeSDKMethod(
	sandbox: SandboxedPlugin,
	method: string,
	args: unknown[]
): Promise<unknown> {
	// UI methods are handled separately
	if (method === 'ui.addToast') {
		addToast(args[0] as Parameters<typeof addToast>[0]);
		return undefined;
	}

	if (method === 'ui.addMessage') {
		if ((sandbox.grantedPermissions & PluginPermission.SendMessages) === 0) {
			throw new Error('Permission denied: SendMessages required for ui.addMessage');
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		addMessage(args[0] as string, args[1] as any);
		return undefined;
	}

	// API methods
	if (method.startsWith('api.')) {
		const apiMethod = method.slice(4);

		// Hard block on dangerous methods
		if (BLOCKED_METHODS.has(apiMethod)) {
			throw new Error(`Method "${apiMethod}" is not available to plugins`);
		}

		// Check the permission map
		const requiredPerm = PERMISSION_METHOD_MAP[apiMethod];
		if (requiredPerm !== undefined) {
			if ((sandbox.grantedPermissions & requiredPerm) === 0) {
				throw new Error(
					`Permission denied: "${apiMethod}" requires a permission this plugin was not granted`
				);
			}
		} else {
			// Method not in our allowlist - deny by default
			throw new Error(`Method "${apiMethod}" is not available through the plugin bridge`);
		}

		// Call the actual API method
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const fn = (api as any)[apiMethod];
		if (typeof fn !== 'function') {
			throw new Error(`Unknown API method: ${apiMethod}`);
		}

		return await fn.apply(api, args);
	}

	throw new Error(`Unknown SDK method: ${method}`);
}

// Register a channel type from a sandboxed plugin. Instead of a Svelte component,
// the registration uses viewFrame which tells ChannelView to render an iframe.
async function handleRegisterChannelType(
	sandbox: SandboxedPlugin,
	msg: Extract<PluginRequest, { type: 'plugin:register-channel-type' }>
) {
	if ((sandbox.grantedPermissions & PluginPermission.AddChannelTypes) === 0) {
		console.warn(`[PluginSandbox] Plugin "${sandbox.pluginId}" tried to register a channel type without AddChannelTypes permission`);
		return;
	}

	const resolve = await getIconResolver();
	const icon = resolve(msg.def.icon);
	if (!icon) {
		console.warn(`[PluginSandbox] Unknown icon "${msg.def.icon}" for channel type "${msg.def.typeId}"`);
		return;
	}

	registerChannelType(msg.def.typeId, {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		icon: icon as any,
		viewFrame: {
			pluginId: sandbox.pluginId
		},
		label: msg.def.label,
		description: msg.def.description,
		showHash: msg.def.showHash,
		headerActionIds: msg.def.headerActionIds
	});
}

function handleUnregisterChannelType(sandbox: SandboxedPlugin, typeId: string) {
	if ((sandbox.grantedPermissions & PluginPermission.AddChannelTypes) === 0) return;
	unregisterChannelType(typeId);
}

async function handleRegisterHeaderAction(
	sandbox: SandboxedPlugin,
	msg: Extract<PluginRequest, { type: 'plugin:register-header-action' }>
) {
	if ((sandbox.grantedPermissions & PluginPermission.AddCommands) === 0) {
		console.warn(`[PluginSandbox] Plugin "${sandbox.pluginId}" tried to register a header action without AddCommands permission`);
		return;
	}

	const resolve = await getIconResolver();
	const icon = resolve(msg.def.icon);
	if (!icon) return;

	registerHeaderAction({
		id: msg.def.actionId,
		title: msg.def.title,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		icon: icon as any,
		onClick: (ctx: ChannelHeaderActionContext) => {
			// Forward the click back to the plugin iframe
			sendToPlugin(sandbox, {
				type: 'host:header-action-clicked',
				actionId: msg.def.actionId,
				context: {
					channelId: ctx.channelId,
					isPinnedOpen: ctx.isPinnedOpen,
					isMemberSidebarOpen: ctx.isMemberSidebarOpen
				}
			});
		}
	});
}

function handleUnregisterHeaderAction(sandbox: SandboxedPlugin, actionId: string) {
	if ((sandbox.grantedPermissions & PluginPermission.AddCommands) === 0) return;
	unregisterHeaderAction(actionId);
}

// Push reactive store changes to the plugin iframe so it stays in sync
function wireStoreSubscriptions(sandbox: SandboxedPlugin) {
	const has = (perm: number) => (sandbox.grantedPermissions & perm) !== 0;

	// Always push channel changes (needed for any plugin with a channel type view)
	if (has(PluginPermission.ReadChannels) || has(PluginPermission.AddChannelTypes)) {
		const unsub = activeChannel.subscribe((ch) => {
			if (!sandbox.ready) return;
			sendToPlugin(sandbox, {
				type: 'host:channel-changed',
				channelId: ch?.id ?? null,
				channelType: ch?.type ?? null
			});
		});
		sandbox.unsubscribers.push(unsub);
	}

	if (has(PluginPermission.ReadMessages)) {
		const unsub = activeChannelMessages.subscribe((msgs) => {
			if (!sandbox.ready) return;
			// Send a serializable snapshot (strip Svelte reactive wrappers)
			sendToPlugin(sandbox, {
				type: 'host:messages-updated',
				messages: JSON.parse(JSON.stringify(msgs || []))
			});
		});
		sandbox.unsubscribers.push(unsub);
	}

	if (has(PluginPermission.ServerInfo)) {
		const unsub = activeCommunity.subscribe((community) => {
			if (!sandbox.ready) return;
			sendToPlugin(sandbox, {
				type: 'host:community-changed',
				communityId: community?.id ?? null
			});
		});
		sandbox.unsubscribers.push(unsub);
	}
}
