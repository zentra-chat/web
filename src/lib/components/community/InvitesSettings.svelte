<script lang="ts">
	import { Button, Spinner } from '$lib/components/ui';
	import { Clock, Copy, Link, Plus, Trash, Users } from 'lucide-svelte';
	import { api } from '$lib/api';
	import { addToast } from '$lib/stores/ui';
	import type { CommunityInvite } from '$lib/types';

	interface Props {
		communityId: string;
	}

	let { communityId }: Props = $props();

	let invites = $state<CommunityInvite[]>([]);
	let isLoadingInvites = $state(false);
	let isGeneratingInvite = $state(false);
	let showCreateInviteForm = $state(false);
	let newInviteMaxUses = $state<number | null>(null);
	let newInviteExpiry = $state<string>('never');
	let loadedForCommunityId = $state<string | null>(null);

	$effect(() => {
		if (!communityId || loadedForCommunityId === communityId) return;
		loadedForCommunityId = communityId;
		invites = [];
		showCreateInviteForm = false;
		newInviteMaxUses = null;
		newInviteExpiry = 'never';
		void loadInvites();
	});

	async function loadInvites() {
		if (!communityId || isLoadingInvites) return;
		isLoadingInvites = true;
		try {
			invites = await api.getInvites(communityId);
		} catch (err) {
			console.error('Failed to load invites:', err);
			addToast({ type: 'error', message: 'Failed to load invites' });
		} finally {
			isLoadingInvites = false;
		}
	}

	async function generateInvite() {
		if (!communityId || isGeneratingInvite) return;
		isGeneratingInvite = true;
		try {
			let expiresIn: number | undefined;
			switch (newInviteExpiry) {
				case '30m':
					expiresIn = 30 * 60;
					break;
				case '1h':
					expiresIn = 60 * 60;
					break;
				case '6h':
					expiresIn = 6 * 60 * 60;
					break;
				case '12h':
					expiresIn = 12 * 60 * 60;
					break;
				case '1d':
					expiresIn = 24 * 60 * 60;
					break;
				case '7d':
					expiresIn = 7 * 24 * 60 * 60;
					break;
				default:
					expiresIn = undefined;
			}

			const invite = await api.createInvite(communityId, {
				maxUses: newInviteMaxUses || undefined,
				expiresIn
			});

			invites = [invite, ...invites];
			showCreateInviteForm = false;
			newInviteMaxUses = null;
			newInviteExpiry = 'never';

			copyInviteLink(invite.code);
			addToast({ type: 'success', message: 'Invite created and copied to clipboard!' });
		} catch (err) {
			console.error('Failed to generate invite:', err);
			addToast({ type: 'error', message: 'Failed to generate invite' });
		} finally {
			isGeneratingInvite = false;
		}
	}

	function copyInviteLink(code: string) {
		navigator.clipboard.writeText(`${window.location.origin}/invite/${code}`);
		addToast({ type: 'success', message: 'Invite link copied!' });
	}

	async function deleteInvite(inviteId: string) {
		if (!communityId) return;
		try {
			await api.deleteInvite(communityId, inviteId);
			invites = invites.filter((invite) => invite.id !== inviteId);
			addToast({ type: 'success', message: 'Invite deleted' });
		} catch (err) {
			console.error('Failed to delete invite:', err);
			addToast({ type: 'error', message: 'Failed to delete invite' });
		}
	}

	function formatExpiryTime(expiresAt: string | null): string {
		if (!expiresAt) return 'Never';
		const date = new Date(expiresAt);
		const now = new Date();
		const diffMs = date.getTime() - now.getTime();

		if (diffMs <= 0) return 'Expired';

		const diffMins = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays > 0) return `${diffDays}d`;
		if (diffHours > 0) return `${diffHours}h`;
		if (diffMins > 0) return `${diffMins}m`;
		return 'Soon';
	}

	function isExpired(invite: CommunityInvite): boolean {
		if (!invite.expiresAt) return false;
		return new Date(invite.expiresAt).getTime() < Date.now();
	}

	function isMaxedOut(invite: CommunityInvite): boolean {
		if (!invite.maxUses) return false;
		return invite.useCount >= invite.maxUses;
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div>
			<h3 class="text-lg font-semibold text-text-primary">Invite Links</h3>
			<p class="text-sm text-text-muted">Create and manage invite links for your community</p>
		</div>
		{#if !showCreateInviteForm}
			<Button onclick={() => (showCreateInviteForm = true)} size="sm">
				<Plus size={16} />
				Create Invite
			</Button>
		{/if}
	</div>

	{#if showCreateInviteForm}
		<div class="bg-surface-hover rounded-lg p-4 space-y-4">
			<h4 class="font-medium text-text-primary">New Invite Link</h4>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="invite-expiry" class="block text-sm text-text-muted mb-1">Expire After</label>
					<select
						id="invite-expiry"
						bind:value={newInviteExpiry}
						class="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary"
					>
						<option value="30m">30 minutes</option>
						<option value="1h">1 hour</option>
						<option value="6h">6 hours</option>
						<option value="12h">12 hours</option>
						<option value="1d">1 day</option>
						<option value="7d">7 days</option>
						<option value="never">Never</option>
					</select>
				</div>

				<div>
					<label for="invite-max-uses" class="block text-sm text-text-muted mb-1">Max Uses</label>
					<select
						id="invite-max-uses"
						bind:value={newInviteMaxUses}
						class="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary"
					>
						<option value={null}>No limit</option>
						<option value={1}>1 use</option>
						<option value={5}>5 uses</option>
						<option value={10}>10 uses</option>
						<option value={25}>25 uses</option>
						<option value={50}>50 uses</option>
						<option value={100}>100 uses</option>
					</select>
				</div>
			</div>

			<div class="flex justify-end gap-2">
				<Button variant="ghost" onclick={() => (showCreateInviteForm = false)}>Cancel</Button>
				<Button onclick={generateInvite} disabled={isGeneratingInvite}>
					{#if isGeneratingInvite}
						<Spinner size="sm" />
						Creating...
					{:else}
						Generate Link
					{/if}
				</Button>
			</div>
		</div>
	{/if}

	{#if isLoadingInvites}
		<div class="flex justify-center py-8">
			<Spinner size="lg" />
		</div>
	{:else if !invites || invites.length === 0}
		<div class="text-center py-8 text-text-muted">
			<Link size={32} class="mx-auto mb-2 opacity-50" />
			<p>No invite links yet</p>
			<p class="text-sm">Create an invite link to share with others</p>
		</div>
	{:else}
		<div class="space-y-2">
			{#each invites as invite (invite.id)}
				{@const expired = isExpired(invite)}
				{@const maxedOut = isMaxedOut(invite)}
				{@const invalid = expired || maxedOut}
				<div class="flex items-center justify-between p-3 bg-surface-hover rounded-lg {invalid ? 'opacity-50' : ''}">
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2">
							<code class="text-sm font-mono text-text-primary">{invite.code}</code>
							{#if expired}
								<span class="text-xs px-2 py-0.5 rounded bg-error/10 text-danger">Expired</span>
							{:else if maxedOut}
								<span class="text-xs px-2 py-0.5 rounded bg-warning/10 text-warning">Max uses reached</span>
							{/if}
						</div>
						<div class="flex items-center gap-3 text-xs text-text-muted mt-1">
							<span class="flex items-center gap-1">
								<Users size={12} />
								{invite.useCount}{invite.maxUses ? ` / ${invite.maxUses}` : ''} uses
							</span>
							<span class="flex items-center gap-1">
								<Clock size={12} />
								{formatExpiryTime(invite.expiresAt)}
							</span>
						</div>
					</div>
					<div class="flex items-center gap-1 ml-2">
						<Button variant="ghost" size="sm" onclick={() => copyInviteLink(invite.code)} disabled={invalid}>
							<Copy size={16} />
						</Button>
						<Button variant="ghost" size="sm" onclick={() => deleteInvite(invite.id)}>
							<Trash size={16} class="text-danger" />
						</Button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
