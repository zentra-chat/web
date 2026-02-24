<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { Maximize, X, Minus } from 'lucide-svelte';
	import { isDesktop } from '$lib/utils/platform';
	
	let { children } = $props();
	let showWaylandTitlebar = $state(false);
	let appWindow: {
		minimize: () => Promise<void>;
		toggleMaximize: () => Promise<void>;
		close: () => Promise<void>;
	} | null = null;

	onMount(async () => {
		if (!isDesktop() || !(window as Window & { __ZENTRA_WAYLAND__?: boolean }).__ZENTRA_WAYLAND__) {
			return;
		}

		showWaylandTitlebar = true;

		const tauriApi = await import('@tauri-apps/api');
		appWindow = tauriApi.window.getCurrentWindow();
	});

	async function minimizeWindow() {
		if (!appWindow) return;
		await appWindow.minimize();
	}

	async function toggleWindowMaximize() {
		if (!appWindow) return;
		await appWindow.toggleMaximize();
	}

	async function closeWindow() {
		if (!appWindow) return;
		await appWindow.close();
	}
</script>

<div class="wayland-shell" class:wayland-shell-enabled={showWaylandTitlebar}>
	{#if showWaylandTitlebar}
		<header class="wayland-titlebar">
			<div class="wayland-titlebar-drag" data-tauri-drag-region>
				<div class="wayland-title" data-tauri-drag-region>
					<img src="/favicon-32x32.png" alt="Zentra" width="16" height="16" />
					<span>Zentra</span>
				</div>
			</div>
			<div class="wayland-window-controls">
				<button type="button" class="titlebar-btn" aria-label="Minimize window" onclick={minimizeWindow}>
					<Minus size={14} strokeWidth={2} />
				</button>
				<button type="button" class="titlebar-btn" aria-label="Maximize window" onclick={toggleWindowMaximize}>
					<Maximize size={14} strokeWidth={2} />
				</button>
				<button type="button" class="titlebar-btn titlebar-btn-close" aria-label="Close window" onclick={closeWindow}>
					<X size={14} strokeWidth={2} />
				</button>
			</div>
		</header>
	{/if}

	<div class="wayland-content" class:wayland-content-with-titlebar={showWaylandTitlebar}>
		{@render children()}
	</div>
</div>

<style>
	.wayland-shell {
		min-height: 100vh;
	}

	.wayland-shell-enabled {
		height: 100vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.wayland-titlebar {
		height: 32px;
		background: var(--color-background-secondary);
		border-bottom: 1px solid var(--color-border);
		display: flex;
		align-items: center;
		justify-content: space-between;
		user-select: none;
		flex-shrink: 0;
	}

	.wayland-titlebar-drag {
		flex: 1;
		height: 100%;
		display: flex;
		align-items: center;
		-webkit-app-region: drag;
	}

	.wayland-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.75rem;
		color: var(--color-text-secondary);
		font-size: 0.825rem;
		font-weight: 500;
		-webkit-app-region: drag;
	}

	.wayland-window-controls {
		display: flex;
		height: 100%;
		-webkit-app-region: no-drag;
	}

	.titlebar-btn {
		width: 44px;
		height: 100%;
		border: 0;
		background: transparent;
		color: var(--color-text-secondary);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: default;
		transition: background-color var(--transition-fast), color var(--transition-fast);
	}

	.titlebar-btn:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.titlebar-btn-close:hover {
		background: var(--color-danger);
		color: #fff;
	}

	.wayland-content {
		min-height: 0;
	}

	.wayland-content-with-titlebar {
		flex: 1;
		overflow: hidden;
	}

	.wayland-content-with-titlebar :global(.h-screen) {
		height: 100%;
	}
</style>
