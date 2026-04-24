<script lang="ts">
	import { untrack } from 'svelte';
	import { Button, Input, Select, Spinner } from '$lib/components/ui';
	import {
		Plus,
		RefreshCw,
		Trash,
		Copy,
		Link,
		Check,
		AlertTriangle,
		Eye,
		EyeOff,
		Pencil,
		Image,
		X
	} from 'lucide-svelte';
	import { api } from '$lib/api';
	import { addToast } from '$lib/stores/ui';
	import type { Channel, UpdateWebhookRequest, Webhook } from '$lib/types';

	interface Props {
		communityId: string;
	}

	type ProviderMode = 'github' | 'gitlab' | 'stripe' | 'generic' | 'custom';

	type WebhookSecret = {
		webhookId: string;
		webhookName: string;
		token: string;
		url: string;
	};

	let { communityId }: Props = $props();

	let channels = $state<Channel[]>([]);
	let selectedChannelId = $state('');
	let webhooks = $state<Webhook[]>([]);

	let isLoadingChannels = $state(false);
	let isLoadingWebhooks = $state(false);
	let isCreatingWebhook = $state(false);
	let isDeletingWebhookId = $state<string | null>(null);
	let isRotatingWebhookId = $state<string | null>(null);
	let isTogglingWebhookId = $state<string | null>(null);
	let isSavingWebhookId = $state<string | null>(null);

	let webhookName = $state('Incoming Webhook');
	let createAvatarFile = $state<File | null>(null);
	let createAvatarPreview = $state<string | null>(null);
	let createAvatarInputRef = $state<HTMLInputElement | null>(null);
	let providerMode = $state<ProviderMode>('github');
	let customProviderHint = $state('');

	let editingWebhookId = $state<string | null>(null);
	let editingWebhookName = $state('');
	let editingWebhookChannelId = $state('');
	let editingProviderMode = $state<ProviderMode>('generic');
	let editingCustomProviderHint = $state('');
	let editingAvatarFile = $state<File | null>(null);
	let editingAvatarPreview = $state<string | null>(null);
	let editingRemoveAvatar = $state(false);
	let editAvatarInputRef = $state<HTMLInputElement | null>(null);

	let latestSecret = $state<WebhookSecret | null>(null);
	let revealSecret = $state(false);
	let loadedChannelsForCommunityId = $state<string | null>(null);
	let loadedWebhooksForCommunityId = $state<string | null>(null);

	const channelNameById = $derived(new Map(channels.map((channel) => [channel.id, channel.name])));

	$effect(() => {
		if (!communityId) return;
		if (loadedChannelsForCommunityId === communityId) return;

		loadedChannelsForCommunityId = communityId;
		channels = [];
		selectedChannelId = '';
		webhooks = [];
		loadedWebhooksForCommunityId = null;
		clearCreateAvatar();
		cancelWebhookEdit();

		void untrack(() => loadChannels(communityId));
	});

	$effect(() => {
		if (!communityId) {
			webhooks = [];
			loadedWebhooksForCommunityId = null;
			cancelWebhookEdit();
			return;
		}

		if (loadedWebhooksForCommunityId === communityId) {
			return;
		}

		loadedWebhooksForCommunityId = communityId;
		cancelWebhookEdit();
		void untrack(() => loadWebhooksForCommunity());
	});

	async function loadChannels(targetCommunityId: string) {
		if (!targetCommunityId || isLoadingChannels) return;

		isLoadingChannels = true;
		try {
			const channelList = await api.getChannels(targetCommunityId);

			if (targetCommunityId !== communityId) {
				return;
			}

			channels = [...channelList].sort((a, b) => {
				if (a.position !== b.position) return a.position - b.position;
				return a.name.localeCompare(b.name);
			});

			if (channels.length === 0) {
				selectedChannelId = '';
				return;
			}

			const selectedStillExists = channels.some((channel) => channel.id === selectedChannelId);
			if (!selectedStillExists) {
				selectedChannelId = channels[0].id;
			}

			loadedWebhooksForCommunityId = null;
			await loadWebhooksForCommunity();
		} catch (err) {
			console.error('Failed to load channels for webhook settings:', err);
			addToast({ type: 'error', message: 'Failed to load channels' });
		} finally {
			isLoadingChannels = false;
		}
	}

	async function loadWebhooksForCommunity() {
		if (!communityId || isLoadingWebhooks) return;

		isLoadingWebhooks = true;
		try {
			const webhookGroups = await Promise.all(
				channels.map(async (channel) => {
					const channelWebhooks = await api.getChannelWebhooks(channel.id);
					return channelWebhooks;
				})
			);

			webhooks = webhookGroups
				.flat()
				.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
		} catch (err) {
			console.error('Failed to load webhooks:', err);
			addToast({ type: 'error', message: 'Failed to load webhooks' });
		} finally {
			isLoadingWebhooks = false;
		}
	}

	function revokePreview(url: string | null) {
		if (url && url.startsWith('blob:')) {
			URL.revokeObjectURL(url);
		}
	}

	function clearCreateAvatar() {
		revokePreview(createAvatarPreview);
		createAvatarFile = null;
		createAvatarPreview = null;
		if (createAvatarInputRef) {
			createAvatarInputRef.value = '';
		}
	}

	function clearEditAvatarSelection() {
		revokePreview(editingAvatarPreview);
		editingAvatarFile = null;
		editingAvatarPreview = null;
		if (editAvatarInputRef) {
			editAvatarInputRef.value = '';
		}
	}

	function validateAvatarFile(file: File): string | null {
		if (!file.type.startsWith('image/')) {
			return 'Please select an image file';
		}

		if (file.size > 5 * 1024 * 1024) {
			return 'Image must be less than 5MB';
		}

		return null;
	}

	function handleCreateAvatarSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const validationError = validateAvatarFile(file);
		if (validationError) {
			addToast({ type: 'error', message: validationError });
			if (createAvatarInputRef) {
				createAvatarInputRef.value = '';
			}
			return;
		}

		revokePreview(createAvatarPreview);
		createAvatarFile = file;
		createAvatarPreview = URL.createObjectURL(file);
	}

	function providerModeFromHint(providerHint?: string): ProviderMode {
		const normalized = providerHint?.trim().toLowerCase();
		if (!normalized) return 'generic';
		if (normalized === 'github' || normalized === 'gitlab' || normalized === 'stripe') {
			return normalized;
		}
		return 'custom';
	}

	function customProviderHintFrom(providerHint?: string): string {
		if (!providerHint) return '';
		const normalized = providerHint.trim().toLowerCase();
		if (normalized === 'github' || normalized === 'gitlab' || normalized === 'stripe') {
			return '';
		}
		return providerHint.trim();
	}

	function resolveProviderHint(mode: ProviderMode, customHint: string): string | undefined {
		switch (mode) {
			case 'github':
				return 'github';
			case 'gitlab':
				return 'gitlab';
			case 'stripe':
				return 'stripe';
			case 'generic':
				return undefined;
			case 'custom':
				return customHint.trim() || undefined;
			default:
				return undefined;
		}
	}

	function startEditingWebhook(webhook: Webhook) {
		cancelWebhookEdit();
		editingWebhookId = webhook.id;
		editingWebhookName = webhook.name;
		editingWebhookChannelId = webhook.channelId;
		editingProviderMode = providerModeFromHint(webhook.providerHint);
		editingCustomProviderHint = customProviderHintFrom(webhook.providerHint);
		editingRemoveAvatar = false;
	}

	function handleEditAvatarSelect(event: Event) {
		if (!editingWebhookId) return;

		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const validationError = validateAvatarFile(file);
		if (validationError) {
			addToast({ type: 'error', message: validationError });
			if (editAvatarInputRef) {
				editAvatarInputRef.value = '';
			}
			return;
		}

		clearEditAvatarSelection();
		editingAvatarFile = file;
		editingAvatarPreview = URL.createObjectURL(file);
		editingRemoveAvatar = false;
	}

	function removeEditingAvatar() {
		clearEditAvatarSelection();
		editingRemoveAvatar = true;
	}

	function cancelWebhookEdit() {
		clearEditAvatarSelection();
		editingWebhookId = null;
		editingWebhookName = '';
		editingWebhookChannelId = '';
		editingProviderMode = 'generic';
		editingCustomProviderHint = '';
		editingRemoveAvatar = false;
	}

	async function createWebhook() {
		if (!selectedChannelId || !webhookName.trim() || isCreatingWebhook) return;
		if (providerMode === 'custom' && !customProviderHint.trim()) return;

		isCreatingWebhook = true;
		try {
			let avatarUrl: string | undefined;
			if (createAvatarFile) {
				avatarUrl = await api.uploadWebhookAvatar(selectedChannelId, createAvatarFile);
			}

			const created = await api.createWebhook(selectedChannelId, {
				name: webhookName.trim(),
				avatarUrl,
				providerHint: resolveProviderHint(providerMode, customProviderHint)
			});

			latestSecret = {
				webhookId: created.webhook.id,
				webhookName: created.webhook.name,
				token: created.token,
				url: created.url
			};
			revealSecret = true;

			clearCreateAvatar();
			addToast({ type: 'success', message: 'Webhook created' });
			await loadWebhooksForCommunity();
		} catch (err) {
			console.error('Failed to create webhook:', err);
			addToast({ type: 'error', message: 'Failed to create webhook' });
		} finally {
			isCreatingWebhook = false;
		}
	}

	async function saveWebhookEdits(webhook: Webhook) {
		if (editingWebhookId !== webhook.id || isSavingWebhookId) return;
		if (!editingWebhookName.trim()) return;
		if (!editingWebhookChannelId) return;
		if (editingProviderMode === 'custom' && !editingCustomProviderHint.trim()) return;

		isSavingWebhookId = webhook.id;
		try {
			let avatarUrl: string | undefined;
			if (editingAvatarFile) {
				avatarUrl = await api.uploadWebhookAvatar(editingWebhookChannelId || webhook.channelId, editingAvatarFile);
			}

			const updatePayload: UpdateWebhookRequest = {
				name: editingWebhookName.trim()
			};

			if (editingWebhookChannelId !== webhook.channelId) {
				updatePayload.channelId = editingWebhookChannelId;
			}

			if (editingProviderMode === 'generic') {
				updatePayload.providerHint = '';
			} else {
				updatePayload.providerHint = resolveProviderHint(editingProviderMode, editingCustomProviderHint);
			}

			if (editingRemoveAvatar) {
				updatePayload.avatarUrl = '';
			} else if (avatarUrl) {
				updatePayload.avatarUrl = avatarUrl;
			}

			const updated = await api.updateWebhook(webhook.id, updatePayload);
			webhooks = webhooks.map((item) => (item.id === updated.id ? updated : item));
			cancelWebhookEdit();
			addToast({ type: 'success', message: 'Webhook updated' });
		} catch (err) {
			console.error('Failed to update webhook:', err);
			addToast({ type: 'error', message: 'Failed to update webhook' });
		} finally {
			isSavingWebhookId = null;
		}
	}

	async function rotateWebhookToken(webhook: Webhook) {
		if (isRotatingWebhookId) return;

		isRotatingWebhookId = webhook.id;
		try {
			const rotated = await api.rotateWebhookToken(webhook.id);
			latestSecret = {
				webhookId: rotated.webhook.id,
				webhookName: rotated.webhook.name,
				token: rotated.token,
				url: rotated.url
			};
			revealSecret = true;
			addToast({ type: 'success', message: `Rotated token for ${webhook.name}` });
			await loadWebhooksForCommunity();
		} catch (err) {
			console.error('Failed to rotate webhook token:', err);
			addToast({ type: 'error', message: 'Failed to rotate webhook token' });
		} finally {
			isRotatingWebhookId = null;
		}
	}

	async function toggleWebhookStatus(webhook: Webhook) {
		if (isTogglingWebhookId) return;

		isTogglingWebhookId = webhook.id;
		try {
			const updated = await api.updateWebhook(webhook.id, {
				isActive: !webhook.isActive
			});

			webhooks = webhooks.map((item) => (item.id === updated.id ? updated : item));
			addToast({
				type: 'success',
				message: updated.isActive ? 'Webhook enabled' : 'Webhook paused'
			});
		} catch (err) {
			console.error('Failed to update webhook status:', err);
			addToast({ type: 'error', message: 'Failed to update webhook status' });
		} finally {
			isTogglingWebhookId = null;
		}
	}

	async function deleteWebhook(webhook: Webhook) {
		if (isDeletingWebhookId) return;
		if (!confirm(`Delete webhook "${webhook.name}"?`)) return;

		isDeletingWebhookId = webhook.id;
		try {
			await api.deleteWebhook(webhook.id);
			webhooks = webhooks.filter((item) => item.id !== webhook.id);
			if (editingWebhookId === webhook.id) {
				cancelWebhookEdit();
			}
			if (latestSecret?.webhookId === webhook.id) {
				latestSecret = null;
			}
			addToast({ type: 'success', message: 'Webhook deleted' });
		} catch (err) {
			console.error('Failed to delete webhook:', err);
			addToast({ type: 'error', message: 'Failed to delete webhook' });
		} finally {
			isDeletingWebhookId = null;
		}
	}

	async function copyToClipboard(value: string, label: string) {
		try {
			await navigator.clipboard.writeText(value);
			addToast({ type: 'success', message: `${label} copied` });
		} catch (err) {
			console.error('Clipboard copy failed:', err);
			addToast({ type: 'error', message: `Failed to copy ${label.toLowerCase()}` });
		}
	}

	function formatDateTime(value?: string): string {
		if (!value) return 'Never used';
		return new Date(value).toLocaleString();
	}
</script>

<div class="space-y-4">
	<div>
		<h3 class="text-lg font-semibold text-text-primary">Webhooks</h3>
		<p class="text-sm text-text-muted">Create channel webhooks for GitHub and other external services.</p>
	</div>

	<div class="bg-surface-hover rounded-lg border border-border p-4 space-y-3">
		<div class="flex items-center justify-between gap-3">
			<h4 class="text-sm font-semibold text-text-primary">Create Incoming Webhook</h4>
			<Button
				variant="ghost"
				size="sm"
				onclick={() => communityId && loadChannels(communityId)}
				disabled={isLoadingChannels}
			>
				<RefreshCw size={14} class={isLoadingChannels ? 'animate-spin' : ''} />
				Refresh
			</Button>
		</div>

		{#if isLoadingChannels}
			<div class="py-3 flex items-center gap-2 text-sm text-text-muted">
				<Spinner size="sm" />
				Loading channels...
			</div>
		{:else if channels.length === 0}
			<div class="py-3 text-sm text-text-muted">No channels found in this community.</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
				<Input label="Name" bind:value={webhookName} placeholder="GitHub" maxlength={80} />
				<div class="space-y-2">
					<p class="text-sm text-text-muted">Avatar (optional)</p>
					<input
						bind:this={createAvatarInputRef}
						type="file"
						accept="image/*"
						onchange={handleCreateAvatarSelect}
						class="hidden"
					/>
					<div class="flex items-center gap-3">
						{#if createAvatarPreview}
							<div class="relative">
								<img src={createAvatarPreview} alt="Webhook avatar preview" class="w-12 h-12 rounded-lg object-cover" />
								<Button
									type="button"
									onclick={clearCreateAvatar}
									variant="danger"
									size="sm"
									class="absolute -top-1 -right-1 w-5 h-5 p-0 min-w-0"
								>
									<X size={12} />
								</Button>
							</div>
						{:else}
							<Button
								type="button"
								onclick={() => createAvatarInputRef?.click()}
								variant="ghost"
								size="sm"
								class="w-12 h-12 p-0 border-2 border-dashed border-border hover:border-primary"
							>
								<Image size={18} class="text-text-muted" />
							</Button>
						{/if}

						<div>
							<p class="text-xs text-text-muted">PNG, JPG, GIF, or WebP</p>
							<p class="text-xs text-text-muted">Max file size: 5MB</p>
						</div>
					</div>
				</div>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
				<Select id="webhook-channel" label="Channel" bind:value={selectedChannelId}>
					{#each channels as channel (channel.id)}
						<option value={channel.id}>#{channel.name}</option>
					{/each}
				</Select>

				<Select id="provider-mode" label="Provider" bind:value={providerMode}>
					<option value="github">GitHub</option>
					<option value="gitlab">GitLab</option>
					<option value="stripe">Stripe</option>
					<option value="generic">Generic</option>
					<option value="custom">Custom</option>
				</Select>

				{#if providerMode === 'custom'}
					<Input
						label="Custom Provider Hint"
						bind:value={customProviderHint}
						placeholder="ci-system"
						maxlength={32}
					/>
				{/if}
			</div>

			<div class="flex justify-end">
				<Button
					onclick={createWebhook}
					disabled={
						isCreatingWebhook ||
						!selectedChannelId ||
						!webhookName.trim() ||
						(providerMode === 'custom' && !customProviderHint.trim())
					}
				>
					{#if isCreatingWebhook}
						<Spinner size="sm" />
						Creating...
					{:else}
						<Plus size={16} />
						Create Webhook
					{/if}
				</Button>
			</div>
		{/if}
	</div>

	{#if latestSecret}
		{@const secret = latestSecret}
		<div class="bg-primary/10 border border-primary/30 rounded-lg p-4 space-y-3">
			<div class="flex items-start gap-2 text-sm text-text-primary">
				<AlertTriangle size={16} class="mt-0.5 text-warning" />
				<div>
					<p class="font-semibold">Save this webhook secret now</p>
					<p class="text-text-muted">Tokens are only shown once when created or rotated.</p>
				</div>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center">
				<div class="bg-surface rounded-lg border border-border px-3 py-2 min-w-0">
					<p class="text-xs text-text-muted">Webhook URL for {secret.webhookName}</p>
					<p class="text-sm text-text-primary truncate">{secret.url}</p>
				</div>
				<Button size="sm" variant="secondary" onclick={() => copyToClipboard(secret.url, 'Webhook URL')}>
					<Copy size={14} />
					Copy URL
				</Button>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center">
				<div class="bg-surface rounded-lg border border-border px-3 py-2 min-w-0">
					<p class="text-xs text-text-muted">Webhook Token</p>
					<p class="text-sm text-text-primary font-mono break-all">
						{revealSecret ? secret.token : '••••••••••••••••••••'}
					</p>
				</div>
				<div class="flex gap-2">
					<Button size="sm" variant="ghost" onclick={() => revealSecret = !revealSecret}>
						{#if revealSecret}
							<EyeOff size={14} />
							Hide
						{:else}
							<Eye size={14} />
							Show
						{/if}
					</Button>
					<Button size="sm" variant="secondary" onclick={() => copyToClipboard(secret.token, 'Webhook token')}>
						<Copy size={14} />
						Copy
					</Button>
				</div>
			</div>
		</div>
	{/if}

	<div class="bg-surface-hover rounded-lg border border-border p-4 space-y-3">
		<div class="flex items-center justify-between">
			<h4 class="text-sm font-semibold text-text-primary">All Webhooks</h4>
			<Button variant="ghost" size="sm" onclick={() => loadWebhooksForCommunity()} disabled={isLoadingWebhooks}>
				<RefreshCw size={14} class={isLoadingWebhooks ? 'animate-spin' : ''} />
				Refresh
			</Button>
		</div>

		{#if isLoadingWebhooks}
			<div class="flex items-center gap-2 py-4 text-sm text-text-muted">
				<Spinner size="sm" />
				Loading webhooks...
			</div>
		{:else if webhooks.length === 0}
			<div class="text-center py-8 text-text-muted">
				<Link size={32} class="mx-auto mb-2 opacity-50" />
				<p>No webhooks in this community</p>
				<p class="text-sm">Create one above to start receiving external events.</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each webhooks as webhook (webhook.id)}
					<div class="rounded-lg border border-border bg-surface p-3">
						<div class="flex items-center justify-between gap-3">
							<div class="min-w-0 flex items-center gap-3">
								{#if webhook.avatarUrl}
									<img
										src={webhook.avatarUrl}
										alt={`${webhook.name} avatar`}
										class="w-10 h-10 rounded-lg object-cover shrink-0"
									/>
								{:else}
									<div
										class="w-10 h-10 rounded-lg border border-border bg-surface-hover flex items-center justify-center shrink-0"
									>
										<Link size={16} class="text-text-muted" />
									</div>
								{/if}

								<div class="min-w-0">
									<p class="font-medium text-text-primary truncate">{webhook.name}</p>
									<div class="flex items-center gap-2 mt-1 text-xs text-text-muted">
										<span>#{channelNameById.get(webhook.channelId) ?? 'Unknown channel'}</span>
										<span>&middot;</span>
										<span class="font-mono">id: {webhook.id}</span>
										<span>&middot;</span>
										<span class="font-mono">token: {webhook.tokenPreview}...</span>
										{#if webhook.providerHint}
											<span>&middot;</span>
											<span>{webhook.providerHint}</span>
										{/if}
									</div>
								</div>
							</div>

							<div class="flex items-center gap-2 shrink-0">
								{#if webhook.isActive}
									<span class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-success/10 text-success">
										<Check size={12} />
										Active
									</span>
								{:else}
									<span class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-warning/10 text-warning">
										Paused
									</span>
								{/if}
							</div>
						</div>

						<p class="text-xs text-text-muted mt-2">Last used: {formatDateTime(webhook.lastUsedAt)}</p>

						<div class="flex flex-wrap gap-2 mt-3">
							<Button
								size="sm"
								variant="ghost"
								onclick={() => editingWebhookId === webhook.id ? cancelWebhookEdit() : startEditingWebhook(webhook)}
								disabled={isSavingWebhookId === webhook.id}
							>
								{#if editingWebhookId === webhook.id}
									<X size={14} />
									Cancel Edit
								{:else}
									<Pencil size={14} />
									Edit
								{/if}
							</Button>
							<Button
								size="sm"
								variant="ghost"
								onclick={() => toggleWebhookStatus(webhook)}
								disabled={isTogglingWebhookId === webhook.id || isSavingWebhookId === webhook.id}
							>
								{webhook.isActive ? 'Pause' : 'Enable'}
							</Button>
							<Button
								size="sm"
								variant="secondary"
								onclick={() => rotateWebhookToken(webhook)}
								disabled={isRotatingWebhookId === webhook.id || isSavingWebhookId === webhook.id}
							>
								{#if isRotatingWebhookId === webhook.id}
									<Spinner size="sm" />
									Rotating...
								{:else}
									<RefreshCw size={14} />
									Rotate Token
								{/if}
							</Button>
							<Button
								size="sm"
								variant="danger"
								onclick={() => deleteWebhook(webhook)}
								disabled={isDeletingWebhookId === webhook.id || isSavingWebhookId === webhook.id}
							>
								<Trash size={14} />
								Delete
							</Button>
						</div>

						{#if editingWebhookId === webhook.id}
							<div class="mt-4 pt-3 border-t border-border space-y-3">
								<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
									<Input label="Name" bind:value={editingWebhookName} placeholder="GitHub" maxlength={80} />

									<div class="space-y-2">
										<p class="text-sm text-text-muted">Avatar</p>
										<input
											bind:this={editAvatarInputRef}
											type="file"
											accept="image/*"
											onchange={handleEditAvatarSelect}
											class="hidden"
										/>
										<div class="flex items-center gap-3">
											{#if editingAvatarPreview}
												<img
													src={editingAvatarPreview}
													alt="Webhook avatar preview"
													class="w-12 h-12 rounded-lg object-cover"
												/>
											{:else if !editingRemoveAvatar && webhook.avatarUrl}
												<img src={webhook.avatarUrl} alt={`${webhook.name} avatar`} class="w-12 h-12 rounded-lg object-cover" />
											{:else}
												<div
													class="w-12 h-12 rounded-lg border border-border bg-surface-hover flex items-center justify-center"
												>
													<Image size={18} class="text-text-muted" />
												</div>
											{/if}

											<div class="flex flex-wrap gap-2">
												<Button size="sm" variant="ghost" onclick={() => editAvatarInputRef?.click()}>
													Upload
												</Button>
												{#if editingAvatarPreview || (!editingRemoveAvatar && webhook.avatarUrl)}
													<Button size="sm" variant="ghost" onclick={removeEditingAvatar}>Remove</Button>
												{/if}
											</div>
										</div>
										<p class="text-xs text-text-muted">PNG, JPG, GIF, or WebP up to 5MB</p>
									</div>
								</div>

								<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
									<Select id={`edit-channel-${webhook.id}`} label="Channel" bind:value={editingWebhookChannelId}>
										{#each channels as channel (channel.id)}
											<option value={channel.id}>#{channel.name}</option>
										{/each}
									</Select>

									<Select
										id={`edit-provider-mode-${webhook.id}`}
										label="Provider"
										bind:value={editingProviderMode}
									>
										<option value="github">GitHub</option>
										<option value="gitlab">GitLab</option>
										<option value="stripe">Stripe</option>
										<option value="generic">Generic</option>
										<option value="custom">Custom</option>
									</Select>

									{#if editingProviderMode === 'custom'}
										<Input
											label="Custom Provider Hint"
											bind:value={editingCustomProviderHint}
											placeholder="ci-system"
											maxlength={32}
										/>
									{/if}
								</div>

								<div class="flex justify-end gap-2">
									<Button size="sm" variant="ghost" onclick={cancelWebhookEdit} disabled={isSavingWebhookId === webhook.id}>
										Cancel
									</Button>
									<Button
										size="sm"
										onclick={() => saveWebhookEdits(webhook)}
										disabled={
											isSavingWebhookId === webhook.id ||
											!editingWebhookName.trim() ||
											!editingWebhookChannelId ||
											(editingProviderMode === 'custom' && !editingCustomProviderHint.trim())
										}
									>
										{#if isSavingWebhookId === webhook.id}
											<Spinner size="sm" />
											Saving...
										{:else}
											Save Changes
										{/if}
									</Button>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>