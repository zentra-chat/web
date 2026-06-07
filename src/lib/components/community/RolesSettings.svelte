<script lang="ts">
	import { Button, Input, Spinner } from '$lib/components/ui';
	import { X, Search } from 'lucide-svelte';
	import { api } from '$lib/api';
	import { addToast, openProfileCard } from '$lib/stores/ui';
	import { setMembers, updateMemberRoles } from '$lib/stores/community';
	import { getErrorMessage } from '$lib/utils/apiError';
	import type { Role, CommunityMember } from '$lib/types';

	interface Props {
		communityId: string;
	}

	interface PermissionOption {
		label: string;
		value: number;
	}

	interface RoleDraft {
		name: string;
		color: string;
		permissions: number;
	}

	let { communityId }: Props = $props();

	let roles = $state<Role[]>([]);
	let members = $state<CommunityMember[]>([]);
	let isLoadingRoles = $state(false);
	let isLoadingMembers = $state(false);
	let selectedRoleId = $state<string | null>(null);
	let roleDraft = $state<RoleDraft>({
		name: '',
		color: '#99a3b0',
		permissions: 0
	});
	let isSavingRole = $state(false);
	let isCreatingRole = $state(false);
	let isDeletingRole = $state(false);
	let newRoleName = $state('');
	let newRoleColor = $state('#6b7280');
	let loadedForCommunityId = $state<string | null>(null);
	let updatingMembers = $state<Set<string>>(new Set());
	let addSearchQuery = $state('');

	const permissionOptions: PermissionOption[] = [
		{ label: 'View Channels', value: 1 << 0 },
		{ label: 'Send Messages', value: 1 << 1 },
		{ label: 'Manage Messages', value: 1 << 2 },
		{ label: 'Manage Channels', value: 1 << 3 },
		{ label: 'Manage Community', value: 1 << 4 },
		{ label: 'Manage Roles', value: 1 << 5 },
		{ label: 'Kick Members', value: 1 << 6 },
		{ label: 'Ban Members', value: 1 << 7 },
		{ label: 'Create Invites', value: 1 << 8 },
		{ label: 'Attach Files', value: 1 << 9 },
		{ label: 'Add Reactions', value: 1 << 10 },
		{ label: 'Mention Everyone', value: 1 << 11 },
		{ label: 'Pin Messages', value: 1 << 12 },
		{ label: 'Manage Webhooks', value: 1 << 13 },
		{ label: 'View Audit Log', value: 1 << 14 },
		{ label: 'Administrator', value: 1 << 15 },
		{ label: 'Manage Emojis', value: 1 << 20 }
	];

	let roleMembers = $derived(
		selectedRoleId ? members.filter((m) => memberHasRole(m, selectedRoleId!)) : []
	);

	let searchResults = $derived.by(() => {
		if (!addSearchQuery.trim() || !selectedRoleId) return [];
		const q = addSearchQuery.toLowerCase();
		return members.filter(
			(m) =>
				!memberHasRole(m, selectedRoleId!) &&
				getMemberLabel(m).toLowerCase().includes(q)
		);
	});

	$effect(() => {
		if (!communityId || loadedForCommunityId === communityId) return;
		loadedForCommunityId = communityId;
		roles = [];
		members = [];
		selectedRoleId = null;
		roleDraft = { name: '', color: '#99a3b0', permissions: 0 };
		newRoleName = '';
		newRoleColor = '#6b7280';
		addSearchQuery = '';
		void loadRoles();
		void loadMembers();
	});

	async function loadRoles() {
		if (!communityId || isLoadingRoles) return;

		isLoadingRoles = true;
		try {
			roles = await api.getRoles(communityId);
			if (!selectedRoleId && roles.length > 0) {
				selectRole(roles[0]);
			}
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
			const data = await api.getCommunityMembers(communityId);
			members = data;
			setMembers(communityId, data);
		} catch (err) {
			console.error('Failed to load members:', err);
			addToast({ type: 'error', message: 'Failed to load members' });
		} finally {
			isLoadingMembers = false;
		}
	}

	function selectRole(role: Role) {
		selectedRoleId = role.id;
		roleDraft = {
			name: role.name,
			color: role.color || '#6b7280',
			permissions: role.permissions
		};
		addSearchQuery = '';
	}

	function getMemberLabel(member: CommunityMember): string {
		return member.nickname || member.user?.displayName || member.user?.username || 'Unknown';
	}

	function memberHasRole(member: CommunityMember, roleId: string): boolean {
		return (member.roles || []).some((r) => r.id === roleId);
	}

	function togglePermission(bit: number) {
		roleDraft = {
			...roleDraft,
			permissions: roleDraft.permissions ^ bit
		};
	}

	async function saveRole() {
		if (!communityId || !selectedRoleId || isSavingRole) return;

		isSavingRole = true;
		try {
			const updated = await api.updateRole(communityId, selectedRoleId, {
				name: roleDraft.name.trim(),
				color: roleDraft.color || null,
				permissions: roleDraft.permissions
			});
			roles = roles.map((role) => (role.id === updated.id ? updated : role));
			addToast({ type: 'success', message: 'Role updated' });
		} catch (err) {
			console.error('Failed to update role:', err);
			addToast({ type: 'error', message: 'Failed to update role' });
		} finally {
			isSavingRole = false;
		}
	}

	async function createRole() {
		if (!communityId || !newRoleName.trim() || isCreatingRole) return;

		isCreatingRole = true;
		try {
			const created = await api.createRole(communityId, {
				name: newRoleName.trim(),
				color: newRoleColor || null,
				permissions: 0
			});
			roles = [created, ...roles];
			newRoleName = '';
			newRoleColor = '#6b7280';
			selectRole(created);
			addToast({ type: 'success', message: 'Role created' });
		} catch (err) {
			console.error('Failed to create role:', err);
			addToast({ type: 'error', message: 'Failed to create role' });
		} finally {
			isCreatingRole = false;
		}
	}

	async function deleteRole(role: Role) {
		if (!communityId || role.isDefault || isDeletingRole) return;
		if (!confirm(`Delete role "${role.name}"?`)) return;

		isDeletingRole = true;
		try {
			await api.deleteRole(communityId, role.id);
			const remainingRoles = roles.filter((item) => item.id !== role.id);
			roles = remainingRoles;
			if (selectedRoleId === role.id) {
				selectedRoleId = null;
				if (remainingRoles.length > 0) {
					selectRole(remainingRoles[0]);
				}
			}
			addToast({ type: 'success', message: 'Role deleted' });
		} catch (err) {
			console.error('Failed to delete role:', err);
			addToast({ type: 'error', message: 'Failed to delete role' });
		} finally {
			isDeletingRole = false;
		}
	}

	function buildUpdatedRoles(roleIds: string[]): Role[] {
		const roleMap = new Map(roles.map((r) => [r.id, r]));
		const updatedRoles = roleIds
			.map((id) => roleMap.get(id))
			.filter((r): r is Role => !!r);
		const defaultRole = roles.find((r) => r.isDefault) || null;
		return defaultRole ? [defaultRole, ...updatedRoles] : updatedRoles;
	}

	async function addRoleToMember(member: CommunityMember) {
		if (!communityId || !selectedRoleId) return;
		if (updatingMembers.has(member.userId)) return;

		updatingMembers = new Set(updatingMembers).add(member.userId);

		const currentRoleIds = (member.roles || [])
			.filter((r) => !r.isDefault)
			.map((r) => r.id);

		const newRoleIds = [...currentRoleIds, selectedRoleId];

		try {
			await api.setMemberRoles(communityId, member.userId, newRoleIds);

			const updatedRoles = buildUpdatedRoles(newRoleIds);

			members = members.map((m) =>
				m.userId === member.userId ? { ...m, roles: updatedRoles } : m
			);

			updateMemberRoles(communityId, member.userId, updatedRoles);
			addSearchQuery = '';
		} catch (err) {
			addToast({ type: 'error', message: getErrorMessage(err, 'Failed to add role') });
		} finally {
			const next = new Set(updatingMembers);
			next.delete(member.userId);
			updatingMembers = next;
		}
	}

	async function removeRoleFromMember(member: CommunityMember) {
		if (!communityId || !selectedRoleId) return;
		if (updatingMembers.has(member.userId)) return;

		updatingMembers = new Set(updatingMembers).add(member.userId);

		const currentRoleIds = (member.roles || [])
			.filter((r) => !r.isDefault)
			.map((r) => r.id);

		const newRoleIds = currentRoleIds.filter((id) => id !== selectedRoleId);

		try {
			await api.setMemberRoles(communityId, member.userId, newRoleIds);

			const updatedRoles = buildUpdatedRoles(newRoleIds);

			members = members.map((m) =>
				m.userId === member.userId ? { ...m, roles: updatedRoles } : m
			);

			updateMemberRoles(communityId, member.userId, updatedRoles);
		} catch (err) {
			addToast({ type: 'error', message: getErrorMessage(err, 'Failed to remove role') });
		} finally {
			const next = new Set(updatingMembers);
			next.delete(member.userId);
			updatingMembers = next;
		}
	}

	function handleMemberClick(member: CommunityMember, event: MouseEvent) {
		if (member.user) {
			openProfileCard(member.user, event);
		}
	}
</script>

<div class="space-y-4">
	<div>
		<h3 class="text-lg font-semibold text-text-primary">Roles</h3>
		<p class="text-sm text-text-muted">Create roles, edit permissions, and manage member assignments</p>
	</div>

	<div class="grid grid-cols-[240px_1fr] gap-4">
		<div class="bg-surface-hover rounded-lg border border-border overflow-hidden">
			<div class="px-3 py-2 text-xs uppercase tracking-wide text-text-muted border-b border-border">
				Roles
			</div>
			<div class="max-h-96 overflow-y-auto">
				{#if isLoadingRoles}
					<div class="flex justify-center py-6">
						<Spinner size="sm" />
					</div>
				{:else if roles.length === 0}
					<p class="text-sm text-text-muted px-3 py-4">No roles yet</p>
				{:else}
					{#each roles as role (role.id)}
						<button
							class="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors {selectedRoleId === role.id ? 'bg-surface text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
							onclick={() => selectRole(role)}
						>
							<span
								class="h-2.5 w-2.5 rounded-full"
								style={role.color ? `background: ${role.color}` : 'background: var(--text-muted)'}
							></span>
							<span class="truncate">{role.name}</span>
							{#if role.isDefault}
								<span class="ml-auto text-[10px] text-text-muted uppercase">Default</span>
							{/if}
						</button>
					{/each}
				{/if}
			</div>
			<div class="border-t border-border p-3">
				<div class="space-y-2">
					<Input label="New Role" bind:value={newRoleName} placeholder="Role name" />
					<div class="flex items-center gap-2">
						<input type="color" bind:value={newRoleColor} class="h-9 w-10 rounded border border-border bg-transparent" />
						<Button size="sm" onclick={createRole} disabled={isCreatingRole || !newRoleName.trim()}>
							{#if isCreatingRole}
								<Spinner size="sm" />
								Creating...
							{:else}
								Create
							{/if}
						</Button>
					</div>
				</div>
			</div>
		</div>

		<div class="space-y-4">
			{#if !selectedRoleId}
				<div class="bg-surface-hover rounded-lg border border-border p-4">
					<p class="text-sm text-text-muted">Select a role to edit its settings and manage members.</p>
				</div>
			{:else}
				<div class="bg-surface-hover rounded-lg border border-border p-4">
					<div class="flex items-center justify-between mb-4">
						<h4 class="text-sm font-semibold text-text-primary">Role Settings</h4>
						<div class="flex items-center gap-2">
							<Button size="sm" onclick={saveRole} disabled={isSavingRole}>
								{#if isSavingRole}
									<Spinner size="sm" />
									Saving...
								{:else}
									Save
								{/if}
							</Button>
							<Button
								variant="ghost"
								onclick={() => {
									const role = roles.find((item) => item.id === selectedRoleId);
									if (role) {
										deleteRole(role);
									}
								}}
								disabled={isDeletingRole || !!roles.find((role) => role.id === selectedRoleId)?.isDefault}
							>
								Delete
							</Button>
						</div>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<Input label="Role Name" bind:value={roleDraft.name} />
						<div>
							<label for="role-color" class="text-sm text-text-muted">Color</label>
							<div class="flex items-center gap-2 mt-1">
								<input id="role-color" type="color" bind:value={roleDraft.color} class="h-9 w-12 rounded border border-border bg-transparent" />
								<Input bind:value={roleDraft.color} />
							</div>
						</div>
					</div>

					<div class="mt-4">
						<h5 class="text-sm font-semibold text-text-primary mb-2">Permissions</h5>
						<div class="grid grid-cols-2 gap-2">
							{#each permissionOptions as option (option.value)}
								<label class="flex items-center gap-2 text-sm text-text-primary">
									<input
										type="checkbox"
										checked={(roleDraft.permissions & option.value) !== 0}
										onchange={() => togglePermission(option.value)}
									/>
									<span>{option.label}</span>
								</label>
							{/each}
						</div>
					</div>
				</div>

				<div class="bg-surface-hover rounded-lg border border-border p-4">
					<div class="flex items-center justify-between mb-3">
						<h4 class="text-sm font-semibold text-text-primary">Members with this role</h4>
						<span class="text-xs text-text-muted">{roleMembers.length} member(s)</span>
					</div>

					<div class="relative mb-3">
						<div class="relative">
							<Search size={14} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
							<input
								type="text"
								bind:value={addSearchQuery}
								placeholder="Search members to add..."
								class="w-full pl-8 pr-3 py-1.5 text-sm bg-surface rounded-lg border border-border placeholder:text-text-muted focus:outline-none focus:border-primary text-text-primary"
							/>
						</div>

						{#if searchResults.length > 0}
							<div class="absolute z-10 left-0 right-0 mt-1 bg-surface-hover border border-border rounded-lg shadow-xl overflow-hidden">
								{#each searchResults as member (member.userId)}
									<button
										class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-surface transition-colors disabled:opacity-50"
										disabled={updatingMembers.has(member.userId)}
										onclick={() => addRoleToMember(member)}
									>
										<div class="h-6 w-6 rounded-full bg-surface flex items-center justify-center text-xs text-text-muted shrink-0 overflow-hidden">
											{#if member.user?.avatarUrl}
												<img src={member.user.avatarUrl} alt="" class="h-full w-full object-cover" />
											{:else}
												{getMemberLabel(member).charAt(0).toUpperCase()}
											{/if}
										</div>
										<span class="flex-1 truncate text-text-primary">{getMemberLabel(member)}</span>
										{#if updatingMembers.has(member.userId)}
											<Spinner size="sm" />
										{/if}
										<span class="text-xs text-primary shrink-0">Add</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>

					{#if isLoadingMembers}
						<div class="flex justify-center py-6">
							<Spinner size="sm" />
						</div>
					{:else if roleMembers.length === 0}
						<p class="text-sm text-text-muted">No members have this role yet.</p>
					{:else}
						<div class="space-y-0.5 max-h-64 overflow-y-auto">
							{#each roleMembers as member (member.userId)}
								<div class="flex items-center justify-between py-1.5 px-2 rounded hover:bg-surface transition-colors group">
									<button
										class="flex items-center gap-2 min-w-0 flex-1"
										onclick={(e) => handleMemberClick(member, e)}
									>
										<div class="h-7 w-7 rounded-full bg-surface flex items-center justify-center text-xs text-text-muted shrink-0 overflow-hidden">
											{#if member.user?.avatarUrl}
												<img src={member.user.avatarUrl} alt="" class="h-full w-full object-cover" />
											{:else}
												{getMemberLabel(member).charAt(0).toUpperCase()}
											{/if}
										</div>
										<span class="text-sm text-text-primary truncate">{getMemberLabel(member)}</span>
									</button>
									<button
										class="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
										title="Remove role"
										disabled={updatingMembers.has(member.userId)}
										onclick={() => removeRoleFromMember(member)}
									>
										{#if updatingMembers.has(member.userId)}
											<Spinner size="sm" />
										{:else}
											<X size={14} />
										{/if}
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
