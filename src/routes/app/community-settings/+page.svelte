<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui';
	import {
		Users,
		Settings as SettingsIcon,
		Link,
		Crown,
		Smile,
		ScrollText,
		Gavel,
		Puzzle
	} from 'lucide-svelte';
	import OverviewSettings from '$lib/components/community/OverviewSettings.svelte';
	import MembersSettings from '$lib/components/community/MembersSettings.svelte';
	import RolesSettings from '$lib/components/community/RolesSettings.svelte';
	import InvitesSettings from '$lib/components/community/InvitesSettings.svelte';
	import EmojiSettings from '$lib/components/community/EmojiSettings.svelte';
	import BansSettings from '$lib/components/community/BansSettings.svelte';
	import AuditLogSettings from '$lib/components/community/AuditLogSettings.svelte';
	import PluginSettings from '$lib/components/community/PluginSettings.svelte';
	import WebhookSettings from '$lib/components/community/WebhookSettings.svelte';
	import { activeCommunity, activeCommunityMembers, Permission, memberHasPermission } from '$lib/stores/community';
	import { currentUserId } from '$lib/stores/instance';

	let activeTab = $state<
		'overview' | 'members' | 'roles' | 'invites' | 'emojis' | 'plugins' | 'webhooks' | 'bans' | 'audit-log'
	>('overview');

	let isOwner = $derived($activeCommunity?.ownerId === $currentUserId);
	let currentMember = $derived($activeCommunityMembers.find((member) => member.userId === $currentUserId) || null);
	let canModerate = $derived(
		isOwner ||
		memberHasPermission(currentMember, Permission.BanMembers) ||
		memberHasPermission(currentMember, Permission.KickMembers) ||
		memberHasPermission(currentMember, Permission.ViewAuditLog)
	);
	let canManageWebhooks = $derived(isOwner || memberHasPermission(currentMember, Permission.ManageWebhooks));

	$effect(() => {
		if (!$activeCommunity) {
			goto(resolve('/app'));
		}
	});

	$effect(() => {
		if (activeTab === 'webhooks' && !canManageWebhooks) {
			activeTab = 'overview';
		}
	});

	function handleClose() {
		goto(resolve('/app'));
	}
</script>

<div class="flex-1 min-h-0 overflow-y-auto bg-background">
	<div class="max-w-7xl mx-auto px-6 py-6 md:px-8 md:py-8">
		<div class="flex items-center justify-between mb-6">
			<h1 class="text-2xl font-bold text-text-primary">Community Settings</h1>
			<Button variant="ghost" onclick={handleClose}>Back</Button>
		</div>
		<div class="flex gap-6">
			<!-- Tabs -->
			<div class="w-40 space-y-1">
				<button
					onclick={() => (activeTab = 'overview')}
					class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'overview' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
				>
					<SettingsIcon size={16} class="inline-block mr-2" />
					Overview
				</button>
				<button
					onclick={() => (activeTab = 'members')}
					class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'members' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
				>
					<Users size={16} class="inline-block mr-2" />
					Members
				</button>
				<button
					onclick={() => (activeTab = 'roles')}
					class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'roles' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
				>
					<Crown size={16} class="inline-block mr-2" />
					Roles
				</button>
				<button
					onclick={() => (activeTab = 'invites')}
					class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'invites' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
				>
					<Users size={16} class="inline-block mr-2" />
					Invites
				</button>
				<button
					onclick={() => (activeTab = 'emojis')}
					class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'emojis' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
				>
					<Smile size={16} class="inline-block mr-2" />
					Emojis
				</button>
				<button
					onclick={() => (activeTab = 'plugins')}
					class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'plugins' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
				>
					<Puzzle size={16} class="inline-block mr-2" />
					Plugins
				</button>
				{#if canManageWebhooks}
					<button
						onclick={() => (activeTab = 'webhooks')}
						class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'webhooks' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
					>
						<Link size={16} class="inline-block mr-2" />
						Webhooks
					</button>
				{/if}
				{#if canModerate}
					<div class="pt-3 mt-3 border-t border-border">
						<p class="px-3 pb-1.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Moderation</p>
						<button
							onclick={() => (activeTab = 'bans')}
							class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'bans' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
						>
							<Gavel size={16} class="inline-block mr-2" />
							Bans
						</button>
						<button
							onclick={() => (activeTab = 'audit-log')}
							class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'audit-log' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
						>
							<ScrollText size={16} class="inline-block mr-2" />
							Audit Log
						</button>
					</div>
				{/if}
			</div>

			<!-- Content -->
			<div class="flex-1">
				{#if $activeCommunity}
					{#if activeTab === 'overview'}
						<OverviewSettings communityId={$activeCommunity.id} />
					{:else if activeTab === 'members'}
						<MembersSettings communityId={$activeCommunity.id} />
					{:else if activeTab === 'roles'}
						<RolesSettings communityId={$activeCommunity.id} />
					{:else if activeTab === 'invites'}
						<InvitesSettings communityId={$activeCommunity.id} />
					{:else if activeTab === 'emojis'}
						<EmojiSettings communityId={$activeCommunity.id} />
					{:else if activeTab === 'plugins'}
						<PluginSettings communityId={$activeCommunity.id} />
					{:else if activeTab === 'webhooks'}
						<WebhookSettings communityId={$activeCommunity.id} />
					{:else if activeTab === 'bans'}
						<BansSettings communityId={$activeCommunity.id} />
					{:else if activeTab === 'audit-log'}
						<AuditLogSettings communityId={$activeCommunity.id} />
					{/if}
				{/if}
			</div>
		</div>
	</div>
</div>
