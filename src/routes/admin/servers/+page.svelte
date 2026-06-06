<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		Server,
		Activity,
		Database,
		RefreshCw,
		Terminal,
		Cpu,
		Clock,
		Calendar,
		ToggleLeft,
		Wifi,
		WifiOff,
		AlertTriangle,
		Save,
		Play,
		CheckCircle,
		XCircle,
		ChevronDown,
		ChevronRight,
		Settings
	} from 'lucide-svelte';
	import { api } from '$lib/api';
	import { maintenanceMode, showToast } from '$lib/stores/ui';
	import Button from '$lib/components/ui/Button.svelte';
	import type { ServerInfo, ServerConfig, ServerUpdateStatus } from '$lib/types';

	let serverInfo: ServerInfo | null = $state(null);
	let serverConfig: ServerConfig | null = $state(null);
	let loading = $state(true);
	let saving = $state(false);

	let maintenanceEnabled = $state(false);
	let maintenanceMessage = $state('');

	let updaterRunning = $state(false);
	let activeStatus: ServerUpdateStatus | null = $state(null);
	let updateStatuses = $state<ServerUpdateStatus[]>([]);
	let expandedOutput = $state<Record<string, boolean>>({});
	let pollTimer: ReturnType<typeof setInterval> | null = null;

	onMount(async () => {
		try {
			const [info, config, statuses] = await Promise.all([
				api.getServerInfo(),
				api.getServerConfig(),
				api.listServerUpdateStatuses()
			]);
			serverInfo = info;
			serverConfig = config;
			maintenanceEnabled = config.maintenanceMode;
			maintenanceMessage = config.maintenanceMessage ?? '';
			updateStatuses = statuses;

			const running = statuses.find(s => s.status === 'running' || s.status === 'pending');
			if (running) {
				activeStatus = running;
				startPolling(running.id);
			}
		} catch (e) {
			showToast('error', 'Failed to load server data');
			console.error(e);
		} finally {
			loading = false;
		}
	});

	onDestroy(() => {
		if (pollTimer) clearInterval(pollTimer);
	});

	function formatUptime(seconds: number): string {
		const d = Math.floor(seconds / 86400);
		const h = Math.floor((seconds % 86400) / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = Math.floor(seconds % 60);
		const parts: string[] = [];
		if (d > 0) parts.push(`${d}d`);
		if (h > 0) parts.push(`${h}h`);
		if (m > 0) parts.push(`${m}m`);
		parts.push(`${s}s`);
		return parts.join(' ');
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function toggleOutput(id: string) {
		expandedOutput[id] = !expandedOutput[id];
	}

	function startPolling(id: string) {
		if (pollTimer) clearInterval(pollTimer);
		pollTimer = setInterval(async () => {
			try {
				const updated = await api.getServerUpdateStatus(id);
				activeStatus = updated;
				const idx = updateStatuses.findIndex(s => s.id === updated.id);
				if (idx >= 0) {
					updateStatuses[idx] = updated;
				} else {
					updateStatuses = [updated, ...updateStatuses];
				}
				updateStatuses = [...updateStatuses];

				if (updated.status !== 'running' && updated.status !== 'pending') {
					updaterRunning = false;
					if (pollTimer) {
						clearInterval(pollTimer);
						pollTimer = null;
					}
					if (updated.status === 'completed') {
						showToast('success', `${updated.target} update completed`);
					} else if (updated.status === 'failed') {
						showToast('error', `${updated.target} update failed: ${updated.message}`);
					}
				}
			} catch {
				// Server may be restarting - stop polling and show a message
				if (pollTimer) {
					clearInterval(pollTimer);
					pollTimer = null;
				}
				updaterRunning = false;
				if (activeStatus) {
					showToast('info', 'Update in progress, server may be restarting...');
				}
			}
		}, 2000);
	}

	async function triggerUpdate(target: string) {
		if (updaterRunning) return;
		updaterRunning = true;

		try {
			const result = await api.triggerUpdate(target);
			activeStatus = result;
			updateStatuses = [result, ...updateStatuses.filter(s => s.id !== result.id)];
			startPolling(result.id);
		} catch (e) {
			updaterRunning = false;
			showToast('error', 'Failed to start update');
			console.error(e);
		}
	}

	async function saveMaintenance() {
		saving = true;
		try {
			const result = await api.updateServerConfig({
				maintenanceEnabled,
				maintenanceMessage: maintenanceMessage || undefined
			});
			serverConfig = result;
			maintenanceMode.set({
				active: result.maintenanceMode,
				message: result.maintenanceMessage ?? ''
			});
			showToast('success', maintenanceEnabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled');
		} catch (e) {
			showToast('error', 'Failed to update server config');
			console.error(e);
		} finally {
			saving = false;
		}
	}

	async function refreshServerInfo() {
		try {
			serverInfo = await api.getServerInfo();
			showToast('success', 'Server info refreshed');
		} catch (e) {
			showToast('error', 'Failed to refresh server info');
			console.error(e);
		}
	}
</script>

<div class="p-8 max-w-[1600px] mx-auto">
	<div class="flex items-center justify-between mb-8">
		<div>
			<h1 class="text-2xl font-bold text-text-primary">Server Management</h1>
			<p class="text-sm text-text-muted mt-1">View and manage your instance configuration</p>
		</div>
		<Button variant="secondary" size="sm" onclick={refreshServerInfo}>
			{#snippet children()}
				<RefreshCw size={14} />
				Refresh
			{/snippet}
		</Button>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-32">
			<div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
		</div>
	{:else}
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
			<!-- Server Information -->
			<div class="bg-surface border border-border rounded-xl p-6">
				<div class="flex items-center gap-3 mb-5">
					<div class="p-2 rounded-lg bg-primary/10">
						<Server size={20} class="text-primary" />
					</div>
					<h2 class="text-lg font-semibold text-text-primary">Server Information</h2>
				</div>

				<div class="space-y-4">
					<div class="flex items-center justify-between py-2 border-b border-border/50">
						<span class="text-sm text-text-muted">Version</span>
						<span class="text-sm font-medium text-text-primary font-mono">{serverInfo?.version ?? '-'}</span>
					</div>
					<div class="flex items-center justify-between py-2 border-b border-border/50">
						<div class="flex items-center gap-2">
							<Terminal size={14} class="text-text-muted" />
							<span class="text-sm text-text-muted">Go Version</span>
						</div>
						<span class="text-sm font-medium text-text-primary font-mono">{serverInfo?.goVersion ?? '-'}</span>
					</div>
					<div class="flex items-center justify-between py-2 border-b border-border/50">
						<div class="flex items-center gap-2">
							<Cpu size={14} class="text-text-muted" />
							<span class="text-sm text-text-muted">Platform</span>
						</div>
						<span class="text-sm font-medium text-text-primary font-mono">
							{serverInfo?.os ?? '-'}/{serverInfo?.arch ?? '-'}
						</span>
					</div>
					<div class="flex items-center justify-between py-2 border-b border-border/50">
						<div class="flex items-center gap-2">
							<Activity size={14} class="text-text-muted" />
							<span class="text-sm text-text-muted">CPU Cores</span>
						</div>
						<span class="text-sm font-medium text-text-primary">{serverInfo?.cpuCount ?? '-'}</span>
					</div>
					<div class="flex items-center justify-between py-2 border-b border-border/50">
						<div class="flex items-center gap-2">
							<Activity size={14} class="text-text-muted" />
							<span class="text-sm text-text-muted">Goroutines</span>
						</div>
						<span class="text-sm font-medium text-text-primary">{serverInfo?.goRoutines ?? '-'}</span>
					</div>
				<div class="flex items-center justify-between py-2 border-b border-border/50">
						<div class="flex items-center gap-2">
							<Clock size={14} class="text-text-muted" />
							<span class="text-sm text-text-muted">Uptime</span>
						</div>
						<span class="text-sm font-medium text-text-primary">{serverInfo ? formatUptime(serverInfo.uptime) : '-'}</span>
					</div>
					<div class="flex items-center justify-between py-2 border-b border-border/50">
						<div class="flex items-center gap-2">
							<Calendar size={14} class="text-text-muted" />
							<span class="text-sm text-text-muted">Started</span>
						</div>
						<span class="text-sm font-medium text-text-primary">{serverInfo ? formatDate(serverInfo.startTime) : '-'}</span>
					</div>
					<div class="flex items-center justify-between py-2">
						<div class="flex items-center gap-2">
							<Settings size={14} class="text-text-muted" />
							<span class="text-sm text-text-muted">Update Method</span>
						</div>
						<span class="text-sm font-medium text-text-primary capitalize">{serverInfo?.updateMethod ?? '-'}</span>
					</div>
				</div>
			</div>

			<!-- Service Status -->
			<div class="bg-surface border border-border rounded-xl p-6">
				<div class="flex items-center gap-3 mb-5">
					<div class="p-2 rounded-lg bg-info/10">
						<Activity size={20} class="text-info" />
					</div>
					<h2 class="text-lg font-semibold text-text-primary">Service Status</h2>
				</div>

				<div class="space-y-4">
					<!-- Database -->
					<div class="rounded-lg border border-border p-4">
						<div class="flex items-center justify-between mb-3">
							<div class="flex items-center gap-2">
								<Database size={16} class="text-text-muted" />
								<span class="text-sm font-medium text-text-primary">PostgreSQL</span>
							</div>
							<div class="flex items-center gap-2">
								{#if serverInfo?.database.status === 'connected'}
									<span class="flex items-center gap-1.5 text-xs text-green-500 font-medium">
										<Wifi size={12} />
										Connected
									</span>
								{:else}
									<span class="flex items-center gap-1.5 text-xs text-red-500 font-medium">
										<WifiOff size={12} />
										{serverInfo?.database.status === 'error' ? 'Error' : 'Disconnected'}
									</span>
								{/if}
							</div>
						</div>
						{#if serverInfo?.database.latency}
							<div class="text-xs text-text-muted">
								Latency: {serverInfo.database.latency}
							</div>
						{/if}
						{#if serverInfo?.database.error}
							<div class="mt-2 text-xs text-red-500 bg-danger/5 rounded px-2 py-1.5">
								{serverInfo.database.error}
							</div>
						{/if}
					</div>

					<!-- Redis -->
					<div class="rounded-lg border border-border p-4">
						<div class="flex items-center justify-between mb-3">
							<div class="flex items-center gap-2">
								<Database size={16} class="text-text-muted" />
								<span class="text-sm font-medium text-text-primary">Redis</span>
							</div>
							<div class="flex items-center gap-2">
								{#if serverInfo?.redis.status === 'connected'}
									<span class="flex items-center gap-1.5 text-xs text-green-500 font-medium">
										<Wifi size={12} />
										Connected
									</span>
								{:else}
									<span class="flex items-center gap-1.5 text-xs text-red-500 font-medium">
										<WifiOff size={12} />
										{serverInfo?.redis.status === 'error' ? 'Error' : 'Disconnected'}
									</span>
								{/if}
							</div>
						</div>
						{#if serverInfo?.redis.latency}
							<div class="text-xs text-text-muted">
								Latency: {serverInfo.redis.latency}
							</div>
						{/if}
						{#if serverInfo?.redis.error}
							<div class="mt-2 text-xs text-red-500 bg-danger/5 rounded px-2 py-1.5">
								{serverInfo.redis.error}
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Configuration -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Feature Toggles -->
			<div class="bg-surface border border-border rounded-xl p-6">
				<div class="flex items-center gap-3 mb-5">
					<div class="p-2 rounded-lg bg-accent/10">
						<ToggleLeft size={20} class="text-accent" />
					</div>
					<h2 class="text-lg font-semibold text-text-primary">Feature Configuration</h2>
				</div>

				<div class="space-y-3">
					<div class="flex items-center justify-between py-3 px-4 rounded-lg bg-background/50">
						<div>
							<p class="text-sm font-medium text-text-primary">Registration</p>
							<p class="text-xs text-text-muted">Allow new users to register</p>
						</div>
						<div
							class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer
								{serverConfig?.registrationOpen ? 'bg-green-500' : 'bg-border'}"
						>
							<span
								class="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform
									{serverConfig?.registrationOpen ? 'translate-x-[18px]' : 'translate-x-[3px]'}"
							></span>
						</div>
					</div>

					<div class="flex items-center justify-between py-3 px-4 rounded-lg bg-background/50">
						<div>
							<p class="text-sm font-medium text-text-primary">Captcha</p>
							<p class="text-xs text-text-muted">Require captcha on registration</p>
						</div>
						<div
							class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer
								{serverConfig?.captchaEnabled ? 'bg-green-500' : 'bg-border'}"
						>
							<span
								class="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform
									{serverConfig?.captchaEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}"
							></span>
						</div>
					</div>

					<div class="flex items-center justify-between py-3 px-4 rounded-lg bg-background/50">
						<div>
							<p class="text-sm font-medium text-text-primary">Email Verification</p>
							<p class="text-xs text-text-muted">Require email verification for new accounts</p>
						</div>
						<div
							class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer
								{serverConfig?.emailVerificationRequired ? 'bg-green-500' : 'bg-border'}"
						>
							<span
								class="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform
									{serverConfig?.emailVerificationRequired ? 'translate-x-[18px]' : 'translate-x-[3px]'}"
							></span>
						</div>
					</div>
				</div>

				<div class="mt-4 px-4 py-3 rounded-lg bg-warning/5 border border-warning/20">
					<div class="flex items-start gap-2">
						<AlertTriangle size={14} class="text-warning mt-0.5 shrink-0" />
						<p class="text-xs text-text-muted">
							Feature toggles are read-only and reflect the current server configuration.
							Changes require updating environment variables and restarting the server.
						</p>
					</div>
				</div>
			</div>

			<!-- Maintenance Mode -->
			<div class="bg-surface border border-border rounded-xl p-6">
				<div class="flex items-center gap-3 mb-5">
					<div class="p-2 rounded-lg {maintenanceEnabled ? 'bg-danger/10' : 'bg-surface-hover'}">
						<AlertTriangle size={20} class={maintenanceEnabled ? 'text-danger' : 'text-text-muted'} />
					</div>
					<h2 class="text-lg font-semibold text-text-primary">Maintenance Mode</h2>
				</div>

				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-medium text-text-primary">Enable Maintenance</p>
							<p class="text-xs text-text-muted">Block access and show a maintenance message</p>
						</div>
						<button
							onclick={() => { maintenanceEnabled = !maintenanceEnabled; }}
							aria-label={maintenanceEnabled ? 'Disable maintenance mode' : 'Enable maintenance mode'}
							class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors
								{maintenanceEnabled ? 'bg-danger' : 'bg-border'}"
						>
							<span
								class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform
									{maintenanceEnabled ? 'translate-x-[26px]' : 'translate-x-[4px]'}"
							></span>
						</button>
					</div>

					{#if maintenanceEnabled}
						<div>
							<label for="maintenance-message" class="block text-xs font-medium text-text-muted mb-1.5">
								Maintenance Message
							</label>
							<textarea
								id="maintenance-message"
								bind:value={maintenanceMessage}
								placeholder="We are currently undergoing maintenance. Please check back shortly."
								rows={3}
								class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
							></textarea>
						</div>
					{/if}

					<Button onclick={saveMaintenance} loading={saving} disabled={!maintenanceEnabled && serverConfig?.maintenanceMode === maintenanceEnabled}>
						{#snippet children()}
							<Save size={14} />
							Save Changes
						{/snippet}
					</Button>
				</div>
			</div>
		</div>

		<!-- Updates -->
		<div class="mt-6">
			<div class="bg-surface border border-border rounded-xl p-6">
				<div class="flex items-center gap-3 mb-5">
					<div class="p-2 rounded-lg bg-accent/10">
						<Terminal size={20} class="text-accent" />
					</div>
					<h2 class="text-lg font-semibold text-text-primary">Updates</h2>
				</div>

				<div class="flex flex-wrap gap-3 mb-6">
					<Button variant="secondary" size="sm" onclick={() => triggerUpdate('backend')} disabled={updaterRunning}>
						{#snippet children()}
							<Terminal size={14} />
							Update Backend
						{/snippet}
					</Button>
					<Button variant="secondary" size="sm" onclick={() => triggerUpdate('frontend')} disabled={updaterRunning}>
						{#snippet children()}
							<Terminal size={14} />
							Update Frontend
						{/snippet}
					</Button>
					<Button variant="primary" size="sm" onclick={() => triggerUpdate('all')} disabled={updaterRunning}>
						{#snippet children()}
							<Play size={14} />
							Update All
						{/snippet}
					</Button>
				</div>

				{#if activeStatus}
					<div class="rounded-lg border border-border p-4 mb-4">
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2">
								{#if activeStatus.status === 'running'}
									<div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
								{:else if activeStatus.status === 'completed'}
									<CheckCircle size={16} class="text-green-500" />
								{:else if activeStatus.status === 'failed'}
									<XCircle size={16} class="text-red-500" />
								{/if}
								<span class="text-sm font-medium text-text-primary capitalize">{activeStatus.target}</span>
								<span class="text-xs px-1.5 py-0.5 rounded bg-background text-text-muted">{activeStatus.status}</span>
							</div>
							<span class="text-xs text-text-muted">{activeStatus.message}</span>
						</div>
						{#if activeStatus.output}
							<button
								onclick={() => activeStatus && toggleOutput(activeStatus.id)}
								class="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
							>
								{#if expandedOutput[activeStatus.id]}
									<ChevronDown size={12} />
								{:else}
									<ChevronRight size={12} />
								{/if}
								{expandedOutput[activeStatus.id] ? 'Hide output' : 'Show output'}
							</button>
							{#if expandedOutput[activeStatus.id]}
								<pre class="mt-2 p-3 bg-background rounded-lg text-xs text-text-muted font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">{activeStatus.output}</pre>
							{/if}
						{/if}
					</div>
				{/if}

				{#if updateStatuses.length > 0}
					<div class="space-y-2">
						<h3 class="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">History</h3>
						{#each updateStatuses.filter(s => s.id !== activeStatus?.id).slice(0, 5) as status}
							<div class="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50">
								<div class="flex items-center gap-2">
									{#if status.status === 'completed'}
										<CheckCircle size={14} class="text-green-500" />
									{:else if status.status === 'failed'}
										<XCircle size={14} class="text-red-500" />
									{/if}
									<span class="text-sm text-text-primary capitalize">{status.target}</span>
								</div>
								<span class="text-xs text-text-muted">{status.message}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
