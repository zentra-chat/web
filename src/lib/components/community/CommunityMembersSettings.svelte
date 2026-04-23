<script lang="ts">
	import { Textarea, Button, Spinner } from '$lib/components/ui';
	import { Gavel, UserX } from 'lucide-svelte';
	import { api } from '$lib/api';
	import { addToast } from '$lib/stores/ui';
	import {
		activeCommunity,
		activeCommunityMembers,
		setMembers,
		updateMemberRoles,
		Permission,
		memberHasPermission
	} from '$lib/stores/community';
	import { currentUserId } from '$lib/stores/instance';
	import { getErrorMessage } from '$lib/utils/apiError';
	import type { CommunityMember, Role } from '$lib/types';

	interface Props {
		communityId: string;
	}

	let { communityId }: Props = $props();

	let roles = $state<Role[]>([]);
	let isLoadingRoles = $state(false);
	let isLoadingMembers = $state(false);
	let selectedMemberId = $state<string | null>(null);
	let selectedMemberRoleIds = $state<string[]>([]);
	let isUpdatingMemberRoles = $state(false);
	let loadedForCommunityId = $state<string | null>(null);

	let banReasonInput = $state('');
	let banTargetId = $state<string | null>(null);
	let showBanModal = $state(false);
	let isProcessingBan = $state(false);

	let isOwner = $derived($activeCommunity?.ownerId === $currentUserId);
	let currentMember = $derived($activeCommunityMembers.find((member) => member.userId === $currentUserId) || null);
	let canKickMembers = $derived(isOwner || memberHasPermission(currentMember, Permission.KickMembers));
	let canBanMembers = $derived(isOwner || memberHasPermission(currentMember, Permission.BanMembers));

	$effect(() => {
		if (!communityId || loadedForCommunityId === communityId) return;

		loadedForCommunityId = communityId;
		roles = [];
		selectedMemberId = null;
		selectedMemberRoleIds = [];
		banReasonInput = '';
		banTargetId = null;
		showBanModal = false;
		void loadMembers();
		void loadRoles();
	});

	async function loadRoles() {
		if (!communityId || isLoadingRoles) return;
		isLoadingRoles = true;
		try {
			roles = await api.getRoles(communityId);
		} catch (err) {
			console.error('Failed to load roles:', err);
			addToast({ type: 'error', message: 'Failed to load roles' });
		} finally {
			isLoadingRoles = false;
		}
	}

	async function loadMembers() {
		if (!communityId || isLoadingMembers) return;
		isLoadingMembers = true;
		try {
			const members = await api.getCommunityMembers(communityId);
			setMembers(communityId, members);
			if (!selectedMemberId && members.length > 0) {
				selectMember(members[0]);
			} else if (selectedMemberId && !members.some((member) => member.userId === selectedMemberId)) {
				const firstMember = members[0] || null;
				if (firstMember) {
					selectMember(firstMember);
				} else {
					selectedMemberId = null;
					selectedMemberRoleIds = [];
				}
			}
		} catch (err) {
			console.error('Failed to load members:', err);
			addToast({ type: 'error', message: 'Failed to load members' });
		} finally {
			isLoadingMembers = false;
		}
	}

	function selectMember(member: CommunityMember) {
		selectedMemberId = member.userId;
		selectedMemberRoleIds = (member.roles || []).filter((role) => !role.isDefault).map((role) => role.id);
	}

	function toggleRole(roleId: string, checked: boolean) {
		selectedMemberRoleIds = checked
			? [...selectedMemberRoleIds, roleId]
			: selectedMemberRoleIds.filter((id) => id !== roleId);
	}

	async function saveMemberRoles() {
		if (!communityId || !selectedMemberId || isUpdatingMemberRoles) return;

		isUpdatingMemberRoles = true;
		try {
			await api.setMemberRoles(communityId, selectedMemberId, selectedMemberRoleIds);
			const member = $activeCommunityMembers.find((item) => item.userId === selectedMemberId) || null;
			const roleMap = new Map(roles.map((role) => [role.id, role]));
			const updatedRoles = selectedMemberRoleIds
				.map((id) => roleMap.get(id))
				.filter((role): role is Role => !!role);
			if (member) {
				const defaultRole = roles.find((role) => role.isDefault) || null;
				updateMemberRoles(communityId, selectedMemberId, defaultRole ? [defaultRole, ...updatedRoles] : updatedRoles);
			}
			addToast({ type: 'success', message: 'Member roles updated' });
		} catch (err) {
			console.error('Failed to update member roles:', err);
			addToast({ type: 'error', message: 'Failed to update member roles' });
		} finally {
			isUpdatingMemberRoles = false;
		}
	}

	async function handleKick(userId: string, displayName: string) {
		if (!communityId) return;
		if (!confirm(`Kick ${displayName} from the community?`)) return;
		try {
			await api.kickMember(communityId, userId);
			addToast({ type: 'success', message: `${displayName} has been kicked` });
			await loadMembers();
		} catch (err) {
			addToast({ type: 'error', message: getErrorMessage(err, 'Failed to kick member') });
		}
	}

	function openBanModal(userId: string) {
		banTargetId = userId;
		banReasonInput = '';
		showBanModal = true;
	}

	function closeBanModal() {
		showBanModal = false;
		banTargetId = null;
		banReasonInput = '';
	}

	async function confirmBan() {
		if (!communityId || !banTargetId || isProcessingBan) return;
		isProcessingBan = true;
		try {
			await api.banMember(communityId, banTargetId, banReasonInput.trim() || undefined);
			addToast({ type: 'success', message: 'Member banned' });
			closeBanModal();
			await loadMembers();
		} catch (err) {
			addToast({ type: 'error', message: getErrorMessage(err, 'Failed to ban member') });
		} finally {
			isProcessingBan = false;
		}
	}

	function getMemberLabel(member: CommunityMember): string {
		return member.nickname || member.user?.displayName || member.user?.username || 'Unknown';
	}
</script>

<div class="space-y-4">
	<div>
		<h3 class="text-lg font-semibold text-text-primary">Members</h3>
		<p class="text-sm text-text-muted">Assign roles to members in this community</p>
	</div>

	{#if isLoadingMembers}
		<div class="flex justify-center py-8">
			<Spinner size="lg" />
		</div>
	{:else}
		<div class="grid grid-cols-[220px_1fr] gap-4">
			<div class="bg-surface-hover rounded-lg border border-border overflow-hidden">
				<div class="px-3 py-2 text-xs uppercase tracking-wide text-text-muted border-b border-border">
					Members
				</div>
				<div class="max-h-96 overflow-y-auto">
					{#if $activeCommunityMembers.length === 0}
						<p class="text-sm text-text-muted px-3 py-4">No members found</p>
					{:else}
						{#each $activeCommunityMembers as member (member.userId)}
							<button
								class="w-full text-left px-3 py-2 text-sm transition-colors {selectedMemberId === member.userId ? 'bg-surface text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
								onclick={() => selectMember(member)}
							>
								<span class="truncate">{getMemberLabel(member)}</span>
							</button>
						{/each}
					{/if}
				</div>
			</div>

			<div class="bg-surface-hover rounded-lg border border-border p-4">
				{#if !selectedMemberId}
					<p class="text-sm text-text-muted">Select a member to edit roles.</p>
				{:else}
					{@const selectedMember = $activeCommunityMembers.find((member) => member.userId === selectedMemberId) || null}
					{@const memberDisplayName = selectedMember ? getMemberLabel(selectedMember) : 'Unknown'}
					{@const isTargetOwner = $activeCommunity?.ownerId === selectedMemberId}
					{@const isSelf = selectedMemberId === ($currentUserId || '')}

					<div class="flex items-center justify-between mb-3">
						<div>
							<p class="text-sm font-semibold text-text-primary">Roles</p>
							<p class="text-xs text-text-muted">Changes apply immediately</p>
						</div>
						<Button size="sm" onclick={saveMemberRoles} disabled={isUpdatingMemberRoles}>
							{#if isUpdatingMemberRoles}
								<Spinner size="sm" />
								Saving...
							{:else}
								Save Roles
							{/if}
						</Button>
					</div>

					<div class="space-y-2">
						{#each roles as role (role.id)}
							{#if !role.isDefault}
								<label class="flex items-center gap-2 text-sm text-text-primary">
									<input
										type="checkbox"
										value={role.id}
										checked={selectedMemberRoleIds.includes(role.id)}
										onchange={(event) => toggleRole(role.id, (event.target as HTMLInputElement).checked)}
									/>
									<span
										class="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs"
										style={role.color ? `background: ${role.color}1a; color: ${role.color}` : undefined}
									>
										<span
											class="h-2 w-2 rounded-full"
											style={role.color ? `background: ${role.color}` : 'background: var(--text-muted)'}
										></span>
										{role.name}
									</span>
								</label>
							{/if}
						{/each}
					</div>

					{#if !isTargetOwner && !isSelf && (canKickMembers || canBanMembers)}
						<div class="mt-4 pt-4 border-t border-border space-y-2">
							<p class="text-xs uppercase tracking-wide text-text-muted mb-2">Moderation</p>
							<div class="flex gap-2">
								{#if canKickMembers}
									<Button variant="ghost" size="sm" onclick={() => handleKick(selectedMemberId!, memberDisplayName)}>
										<UserX size={14} />
										Kick
									</Button>
								{/if}
								{#if canBanMembers}
									<Button variant="danger" size="sm" onclick={() => openBanModal(selectedMemberId!)}>
										<Gavel size={14} />
										Ban
									</Button>
								{/if}
							</div>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	{/if}
</div>

{#if showBanModal}
	<div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" role="dialog">
		<div class="bg-surface rounded-xl p-6 w-full max-w-md shadow-xl border border-border">
			<h3 class="text-lg font-semibold text-text-primary mb-2">Ban Member</h3>
			<p class="text-sm text-text-muted mb-4">This will remove the user from the community and prevent them from rejoining.</p>

			<div class="mb-4">
				<label for="ban-reason" class="block text-sm text-text-muted mb-1">Reason (optional)</label>
				<Textarea
					id="ban-reason"
					bind:value={banReasonInput}
					placeholder="Why is this user being banned?"
					rows={3}
					maxlength={512}
				/>
			</div>

			<div class="flex justify-end gap-2">
				<Button variant="ghost" onclick={closeBanModal}>Cancel</Button>
				<Button variant="danger" onclick={confirmBan} disabled={isProcessingBan}>
					{#if isProcessingBan}
						<Spinner size="sm" />
						Banning...
					{:else}
						Ban Member
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/if}
