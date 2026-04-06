<script lang="ts">
	import { Button, Input, Spinner } from '$lib/components/ui';
	import { api } from '$lib/api';
	import { addToast } from '$lib/stores/ui';
	import type { Role } from '$lib/types';

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
	let isLoadingRoles = $state(false);
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

	$effect(() => {
		if (!communityId || loadedForCommunityId === communityId) return;
		loadedForCommunityId = communityId;
		roles = [];
		selectedRoleId = null;
		roleDraft = { name: '', color: '#99a3b0', permissions: 0 };
		newRoleName = '';
		newRoleColor = '#6b7280';
		void loadRoles();
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

	function selectRole(role: Role) {
		selectedRoleId = role.id;
		roleDraft = {
			name: role.name,
			color: role.color || '#6b7280',
			permissions: role.permissions
		};
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
</script>

<div class="space-y-4">
	<div>
		<h3 class="text-lg font-semibold text-text-primary">Roles</h3>
		<p class="text-sm text-text-muted">Create roles and edit permissions for this community</p>
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

		<div class="bg-surface-hover rounded-lg border border-border p-4">
			{#if !selectedRoleId}
				<p class="text-sm text-text-muted">Select a role to edit its settings.</p>
			{:else}
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
			{/if}
		</div>
	</div>
</div>
