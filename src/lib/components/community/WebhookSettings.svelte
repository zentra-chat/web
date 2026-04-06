<script lang="ts">
	import { untrack } from 'svelte';
	import { Button, Input, Spinner } from '$lib/components/ui';
	import { Plus, RefreshCw, Trash, Copy, Link, Check, AlertTriangle, Eye, EyeOff } from 'lucide-svelte';
	import { api } from '$lib/api';
	import { addToast } from '$lib/stores/ui';
	import type { Channel, Webhook } from '$lib/types';

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

	let webhookName = $state('Incoming Webhook');
	let webhookAvatarUrl = $state('');
	let providerMode = $state<ProviderMode>('github');
	let customProviderHint = $state('');

	let latestSecret = $state<WebhookSecret | null>(null);
	let revealSecret = $state(false);
	let loadedChannelsForCommunityId = $state<string | null>(null);

	$effect(() => {
		if (!communityId) return;
		if (loadedChannelsForCommunityId === communityId) return;

		loadedChannelsForCommunityId = communityId;
		channels = [];
		selectedChannelId = '';
		webhooks = [];

		void untrack(() => loadChannels(communityId));
	});

	$effect(() => {
		const channelId = selectedChannelId;
		if (!channelId) {
			webhooks = [];
			return;
		}

		void untrack(() => loadWebhooks(channelId));
	});

	async function loadChannels(targetCommunityId: string) {
		if (!targetCommunityId || isLoadingChannels) return;

		isLoadingChannels = true;
		try {
			const channelList = await api.getChannels(targetCommunityId);

			// Ignore stale responses from previous community loads.
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
		} catch (err) {
			console.error('Failed to load channels for webhook settings:', err);
			addToast({ type: 'error', message: 'Failed to load channels' });
		} finally {
			isLoadingChannels = false;
		}
	}

	async function loadWebhooks(channelId: string) {
		if (!channelId || isLoadingWebhooks) return;

		isLoadingWebhooks = true;
		try {
			webhooks = await api.getChannelWebhooks(channelId);
		} catch (err) {
			console.error('Failed to load webhooks:', err);
			addToast({ type: 'error', message: 'Failed to load webhooks for this channel' });
		} finally {
			isLoadingWebhooks = false;
		}
	}

	function resolvedProviderHint(): string | undefined {
		switch (providerMode) {
			case 'github':
				return 'github';
			case 'gitlab':
				return 'gitlab';
			case 'stripe':
				return 'stripe';
			case 'generic':
				return undefined;
			case 'custom':
				return customProviderHint.trim() || undefined;
			default:
				return undefined;
		}
	}

	async function createWebhook() {
		if (!selectedChannelId || !webhookName.trim() || isCreatingWebhook) return;

		isCreatingWebhook = true;
		try {
			const created = await api.createWebhook(selectedChannelId, {
				name: webhookName.trim(),
				avatarUrl: webhookAvatarUrl.trim() || undefined,
				providerHint: resolvedProviderHint()
			});

			latestSecret = {
				webhookId: created.webhook.id,
				webhookName: created.webhook.name,
				token: created.token,
				url: created.url
			};
			revealSecret = true;

			addToast({ type: 'success', message: 'Webhook created' });
			await loadWebhooks(selectedChannelId);
		} catch (err) {
			console.error('Failed to create webhook:', err);
			addToast({ type: 'error', message: 'Failed to create webhook' });
		} finally {
			isCreatingWebhook = false;
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
			await loadWebhooks(selectedChannelId);
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
			<label for="webhook-channel" class="text-sm text-text-muted">Target Channel</label>
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
			<select
				id="webhook-channel"
				bind:value={selectedChannelId}
				class="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary"
			>
				{#each channels as channel (channel.id)}
					<option value={channel.id}>#{channel.name}</option>
				{/each}
			</select>
		{/if}
	</div>

	{#if selectedChannelId}
		<div class="bg-surface-hover rounded-lg border border-border p-4 space-y-3">
			<h4 class="text-sm font-semibold text-text-primary">Create Incoming Webhook</h4>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
				<Input label="Name" bind:value={webhookName} placeholder="GitHub" maxlength={80} />
				<Input
					label="Avatar URL (optional)"
					bind:value={webhookAvatarUrl}
					placeholder="https://..."
					type="url"
				/>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
				<div>
					<label for="provider-mode" class="block text-sm text-text-muted mb-1">Provider</label>
					<select
						id="provider-mode"
						bind:value={providerMode}
						class="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary"
					>
						<option value="github">GitHub</option>
						<option value="gitlab">GitLab</option>
						<option value="stripe">Stripe</option>
						<option value="generic">Generic</option>
						<option value="custom">Custom</option>
					</select>
				</div>

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
					disabled={isCreatingWebhook || !webhookName.trim() || (providerMode === 'custom' && !customProviderHint.trim())}
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
		</div>
	{/if}

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
			<h4 class="text-sm font-semibold text-text-primary">Channel Webhooks</h4>
			{#if selectedChannelId}
				<Button
					variant="ghost"
					size="sm"
					onclick={() => loadWebhooks(selectedChannelId)}
					disabled={isLoadingWebhooks}
				>
					<RefreshCw size={14} class={isLoadingWebhooks ? 'animate-spin' : ''} />
					Refresh
				</Button>
			{/if}
		</div>

		{#if !selectedChannelId}
			<p class="text-sm text-text-muted">Select a channel to manage webhooks.</p>
		{:else if isLoadingWebhooks}
			<div class="flex items-center gap-2 py-4 text-sm text-text-muted">
				<Spinner size="sm" />
				Loading webhooks...
			</div>
		{:else if webhooks.length === 0}
			<div class="text-center py-8 text-text-muted">
				<Link size={32} class="mx-auto mb-2 opacity-50" />
				<p>No webhooks for this channel</p>
				<p class="text-sm">Create one above to start receiving external events.</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each webhooks as webhook (webhook.id)}
					<div class="rounded-lg border border-border bg-surface p-3">
						<div class="flex items-center justify-between gap-3">
							<div class="min-w-0">
								<p class="font-medium text-text-primary truncate">{webhook.name}</p>
								<div class="flex items-center gap-2 mt-1 text-xs text-text-muted">
									<span class="font-mono">id: {webhook.id}</span>
									<span>&middot;</span>
									<span class="font-mono">token: {webhook.tokenPreview}...</span>
									{#if webhook.providerHint}
										<span>&middot;</span>
										<span>{webhook.providerHint}</span>
									{/if}
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
								onclick={() => toggleWebhookStatus(webhook)}
								disabled={isTogglingWebhookId === webhook.id}
							>
								{webhook.isActive ? 'Pause' : 'Enable'}
							</Button>
							<Button
								size="sm"
								variant="secondary"
								onclick={() => rotateWebhookToken(webhook)}
								disabled={isRotatingWebhookId === webhook.id}
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
								disabled={isDeletingWebhookId === webhook.id}
							>
								<Trash size={14} />
								Delete
							</Button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>