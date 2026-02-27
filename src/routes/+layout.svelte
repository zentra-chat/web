<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { Maximize, X, Minus } from 'lucide-svelte';
	import { isDesktop } from '$lib/utils/platform';
	
	let { children } = $props();
	let showDesktopTitlebar = $state(false);
	let appWindow: {
		minimize: () => Promise<void>;
		toggleMaximize: () => Promise<void>;
		close: () => Promise<void>;
	} | null = null;

	type DesktopWindow = Window & {
		__TAURI__?: unknown;
		__TAURI_IPC__?: unknown;
	};

	onMount(() => {
		const w = window as DesktopWindow;
		
		// Already available (production / fast load)
		if (w.__TAURI__ || w.__TAURI_IPC__) {
			initTitlebar();
			return;
		}

		// Poll until Tauri injects its globals (dev mode: can take 15+ seconds)
		const interval = setInterval(async () => {
			if (w.__TAURI__ || w.__TAURI_IPC__) {
				clearInterval(interval);
				await initTitlebar();
			}
		}, 200);

		// Give up after 30 seconds
		setTimeout(() => clearInterval(interval), 30_000);
	});

	async function initTitlebar() {
		try {
			const { getCurrentWindow } = await import('@tauri-apps/api/window');
			appWindow = getCurrentWindow();
			showDesktopTitlebar = true;
		} catch (error) {
			console.error('Titlebar init failed:', error);
		}
	}

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

<div class="desktop-shell" class:desktop-shell-enabled={showDesktopTitlebar}>
	{#if showDesktopTitlebar}
		<header class="desktop-titlebar">
			<div class="desktop-titlebar-drag" data-tauri-drag-region>
				<div class="desktop-title" data-tauri-drag-region>
					<img src="/favicon-32x32.png" alt="Zentra" width="16" height="16" />
					<span>Zentra</span>
				</div>
			</div>
			<div class="desktop-window-controls">
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

	<div class="desktop-content" class:desktop-content-with-titlebar={showDesktopTitlebar}>
		{@render children()}
	</div>
</div>

<style>
	.desktop-shell {
		min-height: 100vh;
	}

	.desktop-shell-enabled {
		height: 100vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.desktop-titlebar {
		height: 32px;
		background: var(--color-background-secondary);
		border-bottom: 1px solid var(--color-border);
		display: flex;
		align-items: center;
		justify-content: space-between;
		user-select: none;
		flex-shrink: 0;
	}

	.desktop-titlebar-drag {
		flex: 1;
		height: 100%;
		display: flex;
		align-items: center;
		-webkit-app-region: drag;
	}

	.desktop-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.75rem;
		color: var(--color-text-secondary);
		font-size: 0.825rem;
		font-weight: 500;
		-webkit-app-region: drag;
	}

	.desktop-window-controls {
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

	.desktop-content {
		min-height: 0;
	}

	.desktop-content-with-titlebar {
		flex: 1;
		overflow: hidden;
	}

	.desktop-content-with-titlebar :global(.h-screen) {
		height: 100%;
	}
</style>
