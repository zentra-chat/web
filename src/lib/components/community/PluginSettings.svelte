<script lang="ts">
	import { Button, Spinner, Input } from '$lib/components/ui';
	import {
		Search, Puzzle, Download, Trash, ToggleLeft, ToggleRight,
		Shield, ShieldAlert, ChevronDown, ChevronRight, ExternalLink,
		RefreshCw, Plus, X, Globe, Package, Check, AlertTriangle
	} from 'lucide-svelte';
	import { api } from '$lib/api';
	import { addToast } from '$lib/stores/ui';
	import {
		PluginPermission,
		PluginPermissionLabels,
		type Plugin,
		type CommunityPlugin,
		type PluginSource,
		type PluginAuditEntry
	} from '$lib/types';

	interface Props {
		communityId: string;
	}

	let { communityId }: Props = $props();

	// State
	let view = $state<'installed' | 'browse' | 'sources'>('installed');
	let installedPlugins = $state<CommunityPlugin[]>([]);
	let catalogPlugins = $state<Plugin[]>([]);
	let sources = $state<PluginSource[]>([]);
	let auditLog = $state<PluginAuditEntry[]>([]);

	let isLoadingInstalled = $state(false);
	let isLoadingCatalog = $state(false);
	let isLoadingSources = $state(false);
	let hasAttemptedCatalogLoad = $state(false);
	let hasAttemptedSourcesLoad = $state(false);
	let isInstallingId = $state<string | null>(null);
	let isUninstallingId = $state<string | null>(null);
	let isTogglingId = $state<string | null>(null);
	let isSyncingSourceId = $state<string | null>(null);

	let searchQuery = $state('');
	let expandedPluginId = $state<string | null>(null);
	let showPermissionModal = $state(false);
	let permissionModalPlugin = $state<Plugin | null>(null);
	let pendingPermissions = $state(0);

	// Source form state
	let showAddSource = $state(false);
	let newSourceName = $state('');
	let newSourceUrl = $state('');
	let isAddingSource = $state(false);

	// IDs of plugins already installed so we can hide "install" in the catalog
	let installedPluginIds = $derived(new Set(installedPlugins.map((p) => p.pluginId)));

	// Filtered catalog - hide what's already installed
	let filteredCatalog = $derived(
		(catalogPlugins ?? []).filter((p) => !p.builtIn && !installedPluginIds.has(p.id) && p.slug !== 'core')
	);

	// Load installed plugins on mount
	$effect(() => {
		if (communityId) {
			loadInstalled();
		}
	});

	// Load catalog when switching to browse tab
	$effect(() => {
		if (view === 'browse' && !hasAttemptedCatalogLoad && !isLoadingCatalog) {
			loadCatalog();
		}
	});

	// Load sources when switching to sources tab
	$effect(() => {
		if (view === 'sources' && !hasAttemptedSourcesLoad && !isLoadingSources) {
			loadSources();
		}
	});

	async function loadInstalled() {
		isLoadingInstalled = true;
		try {
			const data = await api.getCommunityPlugins(communityId);
			installedPlugins = Array.isArray(data) ? data : [];
		} catch (err) {
			console.error('Failed to load plugins:', err);
			addToast({ type: 'error', message: 'Failed to load plugins' });
		} finally {
			isLoadingInstalled = false;
		}
	}

	async function loadCatalog() {
		isLoadingCatalog = true;
		try {
			if (searchQuery.trim()) {
				const data = await api.searchPlugins(searchQuery.trim());
				catalogPlugins = Array.isArray(data) ? data : [];
			} else {
				const data = await api.listPlugins();
				catalogPlugins = Array.isArray(data) ? data : [];
			}
		} catch (err) {
			console.error('Failed to load plugin catalog:', err);
			addToast({ type: 'error', message: 'Failed to load plugin catalog' });
		} finally {
			isLoadingCatalog = false;
			hasAttemptedCatalogLoad = true;
		}
	}

	async function loadSources() {
		isLoadingSources = true;
		try {
			const data = await api.getPluginSources(communityId);
			sources = Array.isArray(data) ? data : [];
		} catch (err) {
			console.error('Failed to load sources:', err);
			addToast({ type: 'error', message: 'Failed to load plugin sources' });
		} finally {
			isLoadingSources = false;
			hasAttemptedSourcesLoad = true;
		}
	}

	function handleSearch() {
		hasAttemptedCatalogLoad = false;
		loadCatalog();
	}

	// Opens the permission review modal before installing
	function startInstall(plugin: Plugin) {
		if (plugin.builtIn || plugin.slug === 'core') {
			addToast({ type: 'error', message: 'Built-in plugins are already installed by default' });
			return;
		}

		permissionModalPlugin = plugin;
		pendingPermissions = plugin.requestedPermissions;
		showPermissionModal = true;
	}

	async function confirmInstall() {
		if (!permissionModalPlugin) return;

		const plugin = permissionModalPlugin;
		showPermissionModal = false;
		isInstallingId = plugin.id;

		try {
			const installed = await api.installPlugin(communityId, plugin.id, pendingPermissions);
			installedPlugins = [...installedPlugins, installed];
			addToast({ type: 'success', message: `Installed ${plugin.name}` });
		} catch (err) {
			console.error('Failed to install plugin:', err);
			addToast({ type: 'error', message: `Failed to install ${plugin.name}` });
		} finally {
			isInstallingId = null;
			permissionModalPlugin = null;
		}
	}

	async function uninstallPlugin(cp: CommunityPlugin) {
		if (!cp.plugin) return;

		isUninstallingId = cp.pluginId;
		try {
			await api.uninstallPlugin(communityId, cp.pluginId);
			installedPlugins = installedPlugins.filter((p) => p.pluginId !== cp.pluginId);
			addToast({ type: 'success', message: `Uninstalled ${cp.plugin.name}` });
		} catch (err) {
			console.error('Failed to uninstall plugin:', err);
			addToast({ type: 'error', message: `Failed to uninstall ${cp.plugin?.name}` });
		} finally {
			isUninstallingId = null;
		}
	}

	async function togglePlugin(cp: CommunityPlugin) {
		isTogglingId = cp.pluginId;
		try {
			await api.togglePlugin(communityId, cp.pluginId, !cp.enabled);
			installedPlugins = installedPlugins.map((p) =>
				p.pluginId === cp.pluginId ? { ...p, enabled: !p.enabled } : p
			);
		} catch (err) {
			console.error('Failed to toggle plugin:', err);
			addToast({ type: 'error', message: 'Failed to toggle plugin' });
		} finally {
			isTogglingId = null;
		}
	}

	async function addSource() {
		if (!newSourceName.trim() || !newSourceUrl.trim()) return;

		isAddingSource = true;
		try {
			const source = await api.addPluginSource(communityId, newSourceName.trim(), newSourceUrl.trim());
			sources = [...sources, source];
			newSourceName = '';
			newSourceUrl = '';
			showAddSource = false;
			addToast({ type: 'success', message: 'Source added' });
		} catch (err) {
			console.error('Failed to add source:', err);
			addToast({ type: 'error', message: 'Failed to add source' });
		} finally {
			isAddingSource = false;
		}
	}

	async function removeSource(sourceId: string) {
		try {
			await api.removePluginSource(communityId, sourceId);
			sources = sources.filter((s) => s.id !== sourceId);
			addToast({ type: 'success', message: 'Source removed' });
		} catch (err) {
			console.error('Failed to remove source:', err);
			addToast({ type: 'error', message: 'Failed to remove source' });
		}
	}

	async function syncSource(sourceId: string) {
		isSyncingSourceId = sourceId;
		try {
			await api.syncPluginSource(communityId, sourceId);
			addToast({ type: 'success', message: 'Source synced - new plugins should appear in the catalog' });
			// Refresh catalog if we're on that tab
			if (view === 'browse') {
				await loadCatalog();
			}
		} catch (err) {
			console.error('Failed to sync source:', err);
			addToast({ type: 'error', message: 'Failed to sync source' });
		} finally {
			isSyncingSourceId = null;
		}
	}

	// Returns an array of { key, label, description, risky, granted, requested } for a permission bitmask
	function getPermissionList(requested: number, granted?: number) {
		return Object.entries(PluginPermission)
			.map(([key, bit]) => {
				const info = PluginPermissionLabels[bit];
				if (!info) return null;
				const isRequested = (requested & bit) !== 0;
				if (!isRequested) return null;
				return {
					key,
					bit,
					label: info.label,
					description: info.description,
					risky: info.risky,
					granted: granted !== undefined ? (granted & bit) !== 0 : true,
					requested: isRequested
				};
			})
			.filter(Boolean) as Array<{
				key: string;
				bit: number;
				label: string;
				description: string;
				risky: boolean;
				granted: boolean;
				requested: boolean;
			}>;
	}

	function togglePendingPermission(bit: number) {
		pendingPermissions = pendingPermissions ^ bit;
	}

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<div class="space-y-4">
	<!-- Header with sub-navigation -->
	<div class="flex items-center justify-between">
		<div>
			<h3 class="text-lg font-semibold text-text-primary">Plugins</h3>
			<p class="text-sm text-text-muted">Extend your community with plugins</p>
		</div>
	</div>

	<!-- Sub-tabs -->
	<div class="flex gap-1 border-b border-border pb-px">
		<button
			onclick={() => view = 'installed'}
			class="px-3 py-1.5 text-sm rounded-t-lg transition-colors {view === 'installed'
				? 'bg-surface-hover text-text-primary border-b-2 border-accent-primary'
				: 'text-text-muted hover:text-text-primary'}"
		>
			Installed
		</button>
		<button
			onclick={() => view = 'browse'}
			class="px-3 py-1.5 text-sm rounded-t-lg transition-colors {view === 'browse'
				? 'bg-surface-hover text-text-primary border-b-2 border-accent-primary'
				: 'text-text-muted hover:text-text-primary'}"
		>
			Browse
		</button>
		<button
			onclick={() => view = 'sources'}
			class="px-3 py-1.5 text-sm rounded-t-lg transition-colors {view === 'sources'
				? 'bg-surface-hover text-text-primary border-b-2 border-accent-primary'
				: 'text-text-muted hover:text-text-primary'}"
		>
			Sources
		</button>
	</div>

	<!-- Installed Plugins -->
	{#if view === 'installed'}
		{#if isLoadingInstalled}
			<div class="flex justify-center py-8">
				<Spinner size="lg" />
			</div>
		{:else if installedPlugins.length === 0}
			<div class="text-center py-8 text-text-muted">
				<Puzzle size={32} class="mx-auto mb-2 opacity-50" />
				<p>No plugins installed</p>
				<p class="text-sm">Browse the catalog to find plugins for your community</p>
				<Button variant="ghost" size="sm" onclick={() => view = 'browse'} class="mt-3">
					Browse Plugins
				</Button>
			</div>
		{:else}
			<div class="space-y-2">
				{#each installedPlugins as cp (cp.id)}
					{@const plugin = cp.plugin}
					{@const isExpanded = expandedPluginId === cp.pluginId}
					<div class="bg-surface rounded-lg border border-border overflow-hidden">
						<!-- Plugin row -->
						<div class="flex items-center gap-3 p-3">
							<!-- Icon -->
							<div class="w-10 h-10 rounded-lg bg-surface-hover flex items-center justify-center shrink-0">
								{#if plugin?.iconUrl}
									<img src={plugin.iconUrl} alt="" class="w-10 h-10 rounded-lg object-cover" />
								{:else}
									<Puzzle size={20} class="text-text-muted" />
								{/if}
							</div>

							<!-- Info -->
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2">
									<span class="font-medium text-text-primary text-sm">{plugin?.name || 'Unknown Plugin'}</span>
									{#if plugin?.builtIn}
										<span class="text-[10px] px-1.5 py-0.5 bg-accent-primary/20 text-accent-primary rounded-full font-medium">Built-in</span>
									{/if}
									{#if plugin?.isVerified}
										<Check size={14} class="text-green-400" />
									{/if}
									<span class="text-xs text-text-muted">v{plugin?.version || '?'}</span>
								</div>
								<p class="text-xs text-text-muted truncate">{plugin?.description || ''}</p>
							</div>

							<!-- Actions -->
							<div class="flex items-center gap-1.5 shrink-0">
								{#if !plugin?.builtIn}
									<button
										onclick={() => togglePlugin(cp)}
										disabled={isTogglingId === cp.pluginId}
										class="p-1.5 rounded-lg hover:bg-surface-hover transition-colors"
										title={cp.enabled ? 'Disable' : 'Enable'}
									>
										{#if isTogglingId === cp.pluginId}
											<Spinner size="sm" />
										{:else if cp.enabled}
											<ToggleRight size={20} class="text-green-400" />
										{:else}
											<ToggleLeft size={20} class="text-text-muted" />
										{/if}
									</button>
								{/if}

								<button
									onclick={() => expandedPluginId = isExpanded ? null : cp.pluginId}
									class="p-1.5 rounded-lg hover:bg-surface-hover transition-colors"
									title="Details"
								>
									{#if isExpanded}
										<ChevronDown size={16} class="text-text-muted" />
									{:else}
										<ChevronRight size={16} class="text-text-muted" />
									{/if}
								</button>
							</div>
						</div>

						<!-- Expanded details -->
						{#if isExpanded && plugin}
							{@const perms = getPermissionList(plugin.requestedPermissions, cp.grantedPermissions)}
							<div class="border-t border-border p-3 bg-surface-hover/50 space-y-3">
								<div class="grid grid-cols-2 gap-3 text-xs">
									<div>
										<span class="text-text-muted">Author</span>
										<p class="text-text-primary">{plugin.author}</p>
									</div>
									<div>
										<span class="text-text-muted">Source</span>
										<p class="text-text-primary">{plugin.source || 'built-in'}</p>
									</div>
									<div>
										<span class="text-text-muted">Installed</span>
										<p class="text-text-primary">{formatDate(cp.installedAt)}</p>
									</div>
									{#if plugin.homepageUrl}
										<div>
											<span class="text-text-muted">Homepage</span>
											<a href={plugin.homepageUrl} target="_blank" rel="noopener noreferrer" class="flex items-center gap-1 text-accent-primary hover:underline">
												Visit <ExternalLink size={11} />
											</a>
										</div>
									{/if}
								</div>

								<!-- Permissions -->
								{#if perms.length > 0}
									<div>
										<p class="text-xs font-medium text-text-muted mb-1.5">Permissions</p>
										<div class="flex flex-wrap gap-1.5">
											{#each perms as perm}
												<span
													class="text-[11px] px-2 py-0.5 rounded-full {perm.granted
														? perm.risky ? 'bg-yellow-500/15 text-yellow-400' : 'bg-green-500/15 text-green-400'
														: 'bg-surface text-text-muted line-through'}"
													title={perm.description}
												>
													{#if perm.risky && perm.granted}
														<AlertTriangle size={10} class="inline mr-0.5" />
													{/if}
													{perm.label}
												</span>
											{/each}
										</div>
									</div>
								{/if}

								<!-- Manifest features -->
								{#if plugin.manifest}
									{@const m = plugin.manifest}
									<div class="flex flex-wrap gap-3 text-xs text-text-muted">
										{#if m.channelTypes?.length}
											<span>{m.channelTypes.length} channel type{m.channelTypes.length > 1 ? 's' : ''}</span>
										{/if}
										{#if m.commands?.length}
											<span>{m.commands.length} command{m.commands.length > 1 ? 's' : ''}</span>
										{/if}
										{#if m.hooks?.length}
											<span>{m.hooks.length} hook{m.hooks.length > 1 ? 's' : ''}</span>
										{/if}
									</div>
								{/if}

								<!-- Uninstall (only for non-built-in) -->
								{#if !plugin.builtIn}
									<div class="pt-2 border-t border-border">
										<Button
											variant="danger"
											size="sm"
											onclick={() => uninstallPlugin(cp)}
											disabled={isUninstallingId === cp.pluginId}
										>
											{#if isUninstallingId === cp.pluginId}
												<Spinner size="sm" />
												Removing...
											{:else}
												<Trash size={14} class="mr-1" />
												Uninstall
											{/if}
										</Button>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

	<!-- Browse Catalog -->
	{:else if view === 'browse'}
		<!-- Search bar -->
		<div class="flex gap-2">
			<div class="flex-1">
				<Input
					placeholder="Search plugins..."
					bind:value={searchQuery}
					onkeydown={(e) => { if (e.key === 'Enter') handleSearch(); }}
				/>
			</div>
			<Button variant="ghost" onclick={handleSearch}>
				<Search size={16} />
			</Button>
		</div>

		{#if isLoadingCatalog}
			<div class="flex justify-center py-8">
				<Spinner size="lg" />
			</div>
		{:else if filteredCatalog.length === 0}
			<div class="text-center py-8 text-text-muted">
				<Package size={32} class="mx-auto mb-2 opacity-50" />
				{#if searchQuery}
					<p>No plugins found for "{searchQuery}"</p>
				{:else}
					<p>No new plugins available</p>
				{/if}
				<p class="text-sm mt-1">Add plugin sources to discover more plugins</p>
			</div>
		{:else}
			<div class="grid gap-2">
				{#each filteredCatalog as plugin (plugin.id)}
					{@const riskyPerms = getPermissionList(plugin.requestedPermissions).filter(p => p.risky)}
					<div class="flex items-center gap-3 p-3 bg-surface rounded-lg border border-border hover:border-border-hover transition-colors">
						<div class="w-10 h-10 rounded-lg bg-surface-hover flex items-center justify-center shrink-0">
							{#if plugin.iconUrl}
								<img src={plugin.iconUrl} alt="" class="w-10 h-10 rounded-lg object-cover" />
							{:else}
								<Puzzle size={20} class="text-text-muted" />
							{/if}
						</div>

						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<span class="font-medium text-text-primary text-sm">{plugin.name}</span>
								{#if plugin.isVerified}
									<Check size={14} class="text-green-400" />
								{/if}
								<span class="text-xs text-text-muted">by {plugin.author}</span>
							</div>
							<p class="text-xs text-text-muted truncate">{plugin.description}</p>
							{#if riskyPerms.length > 0}
								<div class="flex items-center gap-1 mt-1">
									<AlertTriangle size={11} class="text-yellow-400" />
									<span class="text-[11px] text-yellow-400">
										Requests elevated permissions: {riskyPerms.map(p => p.label).join(', ')}
									</span>
								</div>
							{/if}
						</div>

						<Button
							variant="primary"
							size="sm"
							onclick={() => startInstall(plugin)}
							disabled={isInstallingId === plugin.id}
						>
							{#if isInstallingId === plugin.id}
								<Spinner size="sm" />
							{:else}
								<Download size={14} class="mr-1" />
								Install
							{/if}
						</Button>
					</div>
				{/each}
			</div>
		{/if}

	<!-- Sources -->
	{:else if view === 'sources'}
		<div class="space-y-3">
			<div class="flex items-center justify-between">
				<p class="text-sm text-text-muted">
					Plugin sources are repositories where Zentra looks for available plugins, similar to package managers like apt or brew.
				</p>
				<Button variant="ghost" size="sm" onclick={() => showAddSource = !showAddSource}>
					<Plus size={14} class="mr-1" />
					Add Source
				</Button>
			</div>

			{#if showAddSource}
				<div class="p-3 bg-surface rounded-lg border border-border space-y-2">
					<Input placeholder="Source name (e.g. Official)" bind:value={newSourceName} />
					<Input placeholder="Source URL (e.g. https://plugins.zentra.chat)" bind:value={newSourceUrl} />
					<div class="flex justify-end gap-2">
						<Button variant="ghost" size="sm" onclick={() => { showAddSource = false; newSourceName = ''; newSourceUrl = ''; }}>
							Cancel
						</Button>
						<Button
							variant="primary"
							size="sm"
							onclick={addSource}
							disabled={isAddingSource || !newSourceName.trim() || !newSourceUrl.trim()}
						>
							{#if isAddingSource}
								<Spinner size="sm" />
							{:else}
								Add
							{/if}
						</Button>
					</div>
				</div>
			{/if}

			{#if isLoadingSources}
				<div class="flex justify-center py-8">
					<Spinner size="lg" />
				</div>
			{:else if sources.length === 0}
				<div class="text-center py-6 text-text-muted">
					<Globe size={32} class="mx-auto mb-2 opacity-50" />
					<p>No plugin sources configured</p>
					<p class="text-sm">Add a source to discover community plugins</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each sources as source (source.id)}
						<div class="flex items-center gap-3 p-3 bg-surface rounded-lg border border-border">
							<Globe size={18} class="text-text-muted shrink-0" />
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium text-text-primary">{source.name}</p>
								<p class="text-xs text-text-muted truncate">{source.url}</p>
							</div>
							<div class="flex items-center gap-1 shrink-0">
								<button
									onclick={() => syncSource(source.id)}
									disabled={isSyncingSourceId === source.id}
									class="p-1.5 rounded-lg hover:bg-surface-hover transition-colors"
									title="Sync plugins from this source"
								>
									{#if isSyncingSourceId === source.id}
										<Spinner size="sm" />
									{:else}
										<RefreshCw size={14} class="text-text-muted" />
									{/if}
								</button>
								<button
									onclick={() => removeSource(source.id)}
									class="p-1.5 rounded-lg hover:bg-surface-hover transition-colors"
									title="Remove source"
								>
									<Trash size={14} class="text-red-400" />
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Permission review modal -->
{#if showPermissionModal && permissionModalPlugin}
	{@const perms = getPermissionList(permissionModalPlugin.requestedPermissions)}
	{@const riskyCount = perms.filter(p => p.risky && (pendingPermissions & p.bit) !== 0).length}
	<div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" role="dialog">
		<div class="bg-surface rounded-xl p-5 w-full max-w-md shadow-xl border border-border">
			<div class="flex items-center gap-3 mb-4">
				<div class="w-10 h-10 rounded-lg bg-surface-hover flex items-center justify-center">
					{#if permissionModalPlugin.iconUrl}
						<img src={permissionModalPlugin.iconUrl} alt="" class="w-10 h-10 rounded-lg object-cover" />
					{:else}
						<Puzzle size={20} class="text-text-muted" />
					{/if}
				</div>
				<div>
					<h3 class="text-base font-semibold text-text-primary">Install {permissionModalPlugin.name}?</h3>
					<p class="text-xs text-text-muted">by {permissionModalPlugin.author} - v{permissionModalPlugin.version}</p>
				</div>
			</div>

			<p class="text-sm text-text-muted mb-3">This plugin is requesting the following permissions:</p>

			<div class="space-y-2 max-h-64 overflow-y-auto">
				{#each perms as perm}
					<label class="flex items-start gap-2.5 p-2 rounded-lg hover:bg-surface-hover cursor-pointer">
						<input
							type="checkbox"
							checked={(pendingPermissions & perm.bit) !== 0}
							onchange={() => togglePendingPermission(perm.bit)}
							class="mt-0.5 rounded border-border"
						/>
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-1.5">
								{#if perm.risky}
									<ShieldAlert size={13} class="text-yellow-400" />
								{:else}
									<Shield size={13} class="text-green-400" />
								{/if}
								<span class="text-sm font-medium text-text-primary">{perm.label}</span>
							</div>
							<p class="text-xs text-text-muted">{perm.description}</p>
						</div>
					</label>
				{/each}
			</div>

			{#if riskyCount > 0}
				<div class="mt-3 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
					<p class="text-xs text-yellow-400 flex items-center gap-1.5">
						<AlertTriangle size={13} />
						You're granting {riskyCount} elevated permission{riskyCount > 1 ? 's' : ''}. Only install plugins you trust.
					</p>
				</div>
			{/if}

			<div class="flex justify-end gap-2 mt-4">
				<Button variant="ghost" onclick={() => { showPermissionModal = false; permissionModalPlugin = null; }}>
					Cancel
				</Button>
				<Button variant="primary" onclick={confirmInstall}>
					<Download size={14} class="mr-1" />
					Install
				</Button>
			</div>
		</div>
	</div>
{/if}
