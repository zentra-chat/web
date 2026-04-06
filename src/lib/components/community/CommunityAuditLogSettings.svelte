<script lang="ts">
	import { Button, Spinner } from '$lib/components/ui';
	import { ScrollText, Users } from 'lucide-svelte';
	import { api } from '$lib/api';
	import { addToast } from '$lib/stores/ui';
	import type { AuditLogEntry } from '$lib/types';

	interface Props {
		communityId: string;
	}

	let { communityId }: Props = $props();

	let auditLogs = $state<AuditLogEntry[]>([]);
	let auditLogTotal = $state(0);
	let auditLogPage = $state(1);
	let isLoadingAuditLog = $state(false);
	let loadedForCommunityId = $state<string | null>(null);

	$effect(() => {
		if (!communityId || loadedForCommunityId === communityId) return;
		loadedForCommunityId = communityId;
		auditLogs = [];
		auditLogTotal = 0;
		auditLogPage = 1;
		void loadAuditLog(1);
	});

	async function loadAuditLog(page = 1) {
		if (!communityId || isLoadingAuditLog) return;
		isLoadingAuditLog = true;
		try {
			const result = await api.getAuditLog(communityId, page);
			auditLogs = result.data;
			auditLogTotal = result.total;
			auditLogPage = page;
		} catch (err) {
			console.error('Failed to load audit log:', err);
			addToast({ type: 'error', message: 'Failed to load audit log' });
		} finally {
			isLoadingAuditLog = false;
		}
	}

	function formatAuditAction(action: string): string {
		const labels: Record<string, string> = {
			'community.create': 'created the community',
			'community.update': 'updated community settings',
			'community.delete': 'deleted the community',
			'community.icon.update': 'changed the community icon',
			'community.icon.remove': 'removed the community icon',
			'channel.create': 'created a channel',
			'channel.update': 'updated a channel',
			'channel.delete': 'deleted a channel',
			'member.join': 'joined the community',
			'member.leave': 'left the community',
			'member.kick': 'kicked a member',
			'member.ban': 'banned a member',
			'member.unban': 'unbanned a member',
			'role.create': 'created a role',
			'role.update': 'updated a role',
			'role.delete': 'deleted a role',
			'invite.create': 'created an invite',
			'invite.delete': 'deleted an invite',
			'message.delete': 'deleted a message',
			'message.pin': 'pinned a message',
			'message.unpin': 'unpinned a message'
		};
		return labels[action] || action;
	}

	function parseDetails(details: unknown): Record<string, unknown> | null {
		if (!details) return null;
		if (typeof details === 'object') return details as Record<string, unknown>;
		if (typeof details === 'string') {
			try {
				return JSON.parse(details);
			} catch {
				return null;
			}
		}
		return null;
	}

	function formatRelativeTime(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffSec = Math.floor(diffMs / 1000);
		const diffMin = Math.floor(diffSec / 60);
		const diffHr = Math.floor(diffMin / 60);
		const diffDay = Math.floor(diffHr / 24);

		if (diffDay > 30) return date.toLocaleDateString();
		if (diffDay > 0) return `${diffDay}d ago`;
		if (diffHr > 0) return `${diffHr}h ago`;
		if (diffMin > 0) return `${diffMin}m ago`;
		return 'just now';
	}
</script>

<div class="space-y-4">
	<div>
		<h3 class="text-lg font-semibold text-text-primary">Audit Log</h3>
		<p class="text-sm text-text-muted">Review all actions taken in this community</p>
	</div>

	{#if isLoadingAuditLog}
		<div class="flex justify-center py-8">
			<Spinner size="lg" />
		</div>
	{:else if auditLogs.length === 0}
		<div class="text-center py-8 text-text-muted">
			<ScrollText size={32} class="mx-auto mb-2 opacity-50" />
			<p>No audit log entries</p>
			<p class="text-sm">Actions taken in this community will appear here</p>
		</div>
	{:else}
		<div class="space-y-1">
			{#each auditLogs as entry (entry.id)}
				<div class="flex items-start gap-3 p-3 bg-surface-hover rounded-lg">
					{#if entry.actor?.avatarUrl}
						<img src={entry.actor.avatarUrl} alt="" class="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5" />
					{:else}
						<div class="w-8 h-8 rounded-full bg-surface flex items-center justify-center shrink-0 mt-0.5">
							<Users size={14} class="text-text-muted" />
						</div>
					{/if}
					<div class="min-w-0 flex-1">
						<p class="text-sm text-text-primary">
							<span class="font-medium">{entry.actor?.displayName || entry.actor?.username || 'Unknown'}</span>
							<span class="text-text-muted ml-1">{formatAuditAction(entry.action)}</span>
						</p>
						{#if entry.details}
							{@const parsed = parseDetails(entry.details)}
							{#if parsed}
								<p class="text-xs text-text-muted mt-0.5">
									{#if parsed.reason}
										Reason: {parsed.reason}
									{:else if parsed.name}
										{parsed.name}
									{:else if parsed.field}
										{parsed.field}{parsed.action ? ` (${parsed.action})` : ''}
									{/if}
								</p>
							{/if}
						{/if}
					</div>
					<span class="text-xs text-text-muted shrink-0">{formatRelativeTime(entry.createdAt)}</span>
				</div>
			{/each}
		</div>

		{#if auditLogTotal > 50}
			<div class="flex justify-center gap-2 pt-4">
				<Button variant="ghost" size="sm" disabled={auditLogPage <= 1} onclick={() => loadAuditLog(auditLogPage - 1)}>
					Previous
				</Button>
				<span class="text-sm text-text-muted py-1.5 px-2">Page {auditLogPage} of {Math.ceil(auditLogTotal / 50)}</span>
				<Button
					variant="ghost"
					size="sm"
					disabled={auditLogPage >= Math.ceil(auditLogTotal / 50)}
					onclick={() => loadAuditLog(auditLogPage + 1)}
				>
					Next
				</Button>
			</div>
		{/if}
	{/if}
</div>
