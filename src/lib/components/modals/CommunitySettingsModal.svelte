<script lang="ts">
	import { Modal, Input, Textarea, Button, Spinner } from '$lib/components/ui';
	import { Image, X, Trash, Copy, RefreshCw, Users, Settings as SettingsIcon, Link, Clock, Plus, Crown } from 'lucide-svelte';
	import { communitySettingsModalOpen, closeCommunitySettingsModal, addToast } from '$lib/stores/ui';
	import {
		activeCommunity,
		activeCommunityMembers,
		updateCommunity,
		removeCommunity,
		setMembers,
		updateMemberRoles
	} from '$lib/stores/community';
	import { currentUserId } from '$lib/stores/instance';
	import { api } from '$lib/api';
	import type { CommunityInvite, Role, CommunityMember } from '$lib/types';

	type ApiErrorLike = { error?: string; message?: string; response?: { data?: { message?: string } } };

	let name = $state('');
	let description = $state('');
	let icon = $state<File | null>(null);
	let iconPreview = $state<string | null>(null);
	let isPrivate = $state(false);
	let invites = $state<CommunityInvite[]>([]);
	let activeTab = $state<'overview' | 'members' | 'roles' | 'invites'>('overview');
	let isSubmitting = $state(false);
	let isGeneratingInvite = $state(false);
	let isLoadingInvites = $state(false);
	let hasAttemptedInviteLoad = $state(false);
	let errors = $state<Record<string, string>>({});
	let showCreateInviteForm = $state(false);
	let newInviteMaxUses = $state<number | null>(null);
	let newInviteExpiry = $state<string>('never'); // 'never', '30m', '1h', '6h', '12h', '1d', '7d'
	let roles = $state<Role[]>([]);
	let isLoadingRoles = $state(false);
	let hasAttemptedRolesLoad = $state(false);
	let selectedRoleId = $state<string | null>(null);
	let roleDraft = $state<{ name: string; color: string; permissions: number }>({
		name: '',
		color: '#99a3b0',
		permissions: 0
	});
	let isSavingRole = $state(false);
	let isCreatingRole = $state(false);
	let isDeletingRole = $state(false);
	let newRoleName = $state('');
	let newRoleColor = $state('#6b7280');

	let isLoadingMembers = $state(false);
	let hasAttemptedMembersLoad = $state(false);
	let selectedMemberId = $state<string | null>(null);
	let selectedMemberRoleIds = $state<string[]>([]);
	let isUpdatingMemberRoles = $state(false);

	let fileInputRef: HTMLInputElement | null = $state(null);
	let isOwner = $derived($activeCommunity?.ownerId === $currentUserId);

	// Load community data when modal opens
	$effect(() => {
		if ($communitySettingsModalOpen && $activeCommunity) {
			name = $activeCommunity.name;
			description = $activeCommunity.description || '';
			iconPreview = $activeCommunity.iconUrl || null;
			isPrivate = !$activeCommunity.isPublic;
		}
	});

	// Load invites when switching to invites tab
	$effect(() => {
		if (activeTab === 'invites' && $activeCommunity && !hasAttemptedInviteLoad && !isLoadingInvites) {
			loadInvites();
		}
	});

	$effect(() => {
		if (activeTab === 'roles' && $activeCommunity && !hasAttemptedRolesLoad && !isLoadingRoles) {
			loadRoles();
		}
	});

	$effect(() => {
		if (activeTab === 'members' && $activeCommunity && !hasAttemptedMembersLoad && !isLoadingMembers) {
			loadMembers();
		}
	});

	// Reset attempt flag when switching tabs away from invites
	$effect(() => {
		if (activeTab !== 'invites') {
			hasAttemptedInviteLoad = false;
		}
	});

	$effect(() => {
		if (activeTab !== 'roles') {
			hasAttemptedRolesLoad = false;
		}
	});

	$effect(() => {
		if (activeTab !== 'members') {
			hasAttemptedMembersLoad = false;
		}
	});

	async function loadInvites() {
		if (!$activeCommunity || isLoadingInvites) return;

		isLoadingInvites = true;
		try {
			invites = await api.getInvites($activeCommunity.id);
		} catch (err) {
			console.error('Failed to load invites:', err);
			addToast({
				type: 'error',
				message: 'Failed to load invites'
			});
		} finally {
			isLoadingInvites = false;
			hasAttemptedInviteLoad = true;
		}
	}

	async function loadRoles() {
		if (!$activeCommunity || isLoadingRoles) return;

		isLoadingRoles = true;
		try {
			roles = await api.getRoles($activeCommunity.id);
			if (!selectedRoleId && roles.length > 0) {
				selectRole(roles[0]);
			}
		} catch (err) {
			console.error('Failed to load roles:', err);
			addToast({
				type: 'error',
				message: 'Failed to load roles'
			});
		} finally {
			isLoadingRoles = false;
			hasAttemptedRolesLoad = true;
		}
	}

	async function loadMembers() {
		if (!$activeCommunity || isLoadingMembers) return;

		isLoadingMembers = true;
		try {
			const members = await api.getCommunityMembers($activeCommunity.id);
			setMembers($activeCommunity.id, members);
			if (!selectedMemberId && members.length > 0) {
				selectMember(members[0]);
			}
			if (roles.length === 0 && !isLoadingRoles) {
				loadRoles();
			}
		} catch (err) {
			console.error('Failed to load members:', err);
			addToast({
				type: 'error',
				message: 'Failed to load members'
			});
		} finally {
			isLoadingMembers = false;
			hasAttemptedMembersLoad = true;
		}
	}

	function handleClose() {
		closeCommunitySettingsModal();
		resetForm();
	}

	function resetForm() {
		icon = null;
		iconPreview = $activeCommunity?.iconUrl || null;
		errors = {};
		activeTab = 'overview';
		invites = [];
		showCreateInviteForm = false;
		newInviteMaxUses = null;
		newInviteExpiry = 'never';
		roles = [];
		selectedRoleId = null;
		selectedMemberId = null;
		selectedMemberRoleIds = [];
	}

	const permissionOptions = [
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
		{ label: 'Administrator', value: 1 << 15 }
	];

	function selectRole(role: Role) {
		selectedRoleId = role.id;
		roleDraft = {
			name: role.name,
			color: role.color || '#6b7280',
			permissions: role.permissions
		};
	}

	function selectMember(member: CommunityMember) {
		selectedMemberId = member.userId;
		selectedMemberRoleIds = (member.roles || []).filter((role) => !role.isDefault).map((role) => role.id);
	}

	function togglePermission(bit: number) {
		roleDraft = {
			...roleDraft,
			permissions: roleDraft.permissions ^ bit
		};
	}

	async function saveRole() {
		if (!$activeCommunity || !selectedRoleId || isSavingRole) return;
		isSavingRole = true;
		try {
			const updated = await api.updateRole($activeCommunity.id, selectedRoleId, {
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
		if (!$activeCommunity || !newRoleName.trim() || isCreatingRole) return;
		isCreatingRole = true;
		try {
			const created = await api.createRole($activeCommunity.id, {
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
		if (!$activeCommunity || role.isDefault || isDeletingRole) return;
		if (!confirm(`Delete role "${role.name}"?`)) return;
		isDeletingRole = true;
		try {
			await api.deleteRole($activeCommunity.id, role.id);
			roles = roles.filter((r) => r.id !== role.id);
			if (selectedRoleId === role.id) {
				selectedRoleId = null;
				if (roles.length > 0) selectRole(roles[0]);
			}
			addToast({ type: 'success', message: 'Role deleted' });
		} catch (err) {
			console.error('Failed to delete role:', err);
			addToast({ type: 'error', message: 'Failed to delete role' });
		} finally {
			isDeletingRole = false;
		}
	}

	async function saveMemberRoles() {
		if (!$activeCommunity || !selectedMemberId || isUpdatingMemberRoles) return;
		isUpdatingMemberRoles = true;
		try {
			await api.setMemberRoles($activeCommunity.id, selectedMemberId, selectedMemberRoleIds);
			const member = $activeCommunityMembers.find((m) => m.userId === selectedMemberId) || null;
			const roleMap = new Map(roles.map((role) => [role.id, role]));
			const updatedRoles = selectedMemberRoleIds
				.map((id) => roleMap.get(id))
				.filter((role): role is Role => !!role);
			if (member) {
				const defaultRole = roles.find((role) => role.isDefault) || null;
				updateMemberRoles($activeCommunity.id, selectedMemberId, defaultRole ? [defaultRole, ...updatedRoles] : updatedRoles);
			}
			addToast({ type: 'success', message: 'Member roles updated' });
		} catch (err) {
			console.error('Failed to update member roles:', err);
			addToast({ type: 'error', message: 'Failed to update member roles' });
		} finally {
			isUpdatingMemberRoles = false;
		}
	}

	function getMemberLabel(member: CommunityMember): string {
		return member.nickname || member.user?.displayName || member.user?.username || 'Unknown';
	}

	function handleIconSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			const file = input.files[0];

			if (!file.type.startsWith('image/')) {
				errors = { ...errors, icon: 'Please select an image file' };
				return;
			}

			if (file.size > 5 * 1024 * 1024) {
				errors = { ...errors, icon: 'Image must be less than 5MB' };
				return;
			}

			icon = file;
			iconPreview = URL.createObjectURL(file);
			delete errors.icon;
		}
	}

	function removeIcon() {
		icon = null;
		iconPreview = null;
		if (fileInputRef) fileInputRef.value = '';
	}

	function validate(): boolean {
		const newErrors: Record<string, string> = {};

		if (!name.trim()) {
			newErrors.name = 'Community name is required';
		} else if (name.length < 2) {
			newErrors.name = 'Name must be at least 2 characters';
		} else if (name.length > 100) {
			newErrors.name = 'Name must be less than 100 characters';
		}

		if (description.length > 500) {
			newErrors.description = 'Description must be less than 500 characters';
		}

		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	async function handleSubmit() {
		if (!validate() || isSubmitting || !$activeCommunity) return;

		isSubmitting = true;

		try {
			const updatedCommunity = await api.updateCommunity($activeCommunity.id, {
				name: name.trim(),
				description: description.trim() || undefined,
				isPublic: !isPrivate
			});

			// Upload icon if changed
			if (icon) {
				try {
					const iconUrl = await api.updateCommunityIcon($activeCommunity.id, icon);
					updatedCommunity.iconUrl = iconUrl;
				} catch (err) {
					console.error('Failed to upload icon:', err);
				}
			} else if (iconPreview === null && $activeCommunity.iconUrl) {
				try {
					await api.removeCommunityIcon($activeCommunity.id);
					updatedCommunity.iconUrl = null;
				} catch (err) {
					console.error('Failed to remove icon:', err);
				}
			}

			updateCommunity($activeCommunity.id, updatedCommunity);
			addToast({
				type: 'success',
				message: 'Community updated!'
			});
		} catch (err: unknown) {
			const error = err as ApiErrorLike;
			console.error('Failed to update community:', err);
			if (error.response?.data?.message) {
				errors = { submit: error.response.data.message };
			} else {
				errors = { submit: error.error || error.message || 'Failed to update community. Please try again.' };
			}
		} finally {
			isSubmitting = false;
		}
	}

	async function handleDeleteCommunity() {
		if (!$activeCommunity) return;

		const confirmed = confirm(
			`Are you sure you want to delete "${$activeCommunity.name}"? This action cannot be undone.`
		);
		if (!confirmed) return;

		try {
			await api.deleteCommunity($activeCommunity.id);
			removeCommunity($activeCommunity.id);
			addToast({
				type: 'success',
				message: 'Community deleted'
			});
			handleClose();
		} catch (err) {
			console.error('Failed to delete community:', err);
			addToast({
				type: 'error',
				message: 'Failed to delete community'
			});
		}
	}

	async function handleLeaveCommunity() {
		if (!$activeCommunity) return;

		const confirmed = confirm(`Are you sure you want to leave "${$activeCommunity.name}"?`);
		if (!confirmed) return;

		try {
			await api.leaveCommunity($activeCommunity.id);
			removeCommunity($activeCommunity.id);
			addToast({
				type: 'success',
				message: 'Left community'
			});
			handleClose();
		} catch (err) {
			console.error('Failed to leave community:', err);
			addToast({
				type: 'error',
				message: 'Failed to leave community'
			});
		}
	}

	async function generateInvite() {
		if (!$activeCommunity || isGeneratingInvite) return;

		isGeneratingInvite = true;

		try {
			// Convert expiry selection to seconds
			let expiresIn: number | undefined;
			switch (newInviteExpiry) {
				case '30m': expiresIn = 30 * 60; break;
				case '1h': expiresIn = 60 * 60; break;
				case '6h': expiresIn = 6 * 60 * 60; break;
				case '12h': expiresIn = 12 * 60 * 60; break;
				case '1d': expiresIn = 24 * 60 * 60; break;
				case '7d': expiresIn = 7 * 24 * 60 * 60; break;
				default: expiresIn = undefined;
			}

			const invite = await api.createInvite($activeCommunity.id, {
				maxUses: newInviteMaxUses || undefined,
				expiresIn
			});

			invites = [invite, ...invites];
			showCreateInviteForm = false;
			newInviteMaxUses = null;
			newInviteExpiry = 'never';

			// Copy the new invite link
			copyInviteLink(invite.code);

			addToast({
				type: 'success',
				message: 'Invite created and copied to clipboard!'
			});
		} catch (err) {
			console.error('Failed to generate invite:', err);
			addToast({
				type: 'error',
				message: 'Failed to generate invite'
			});
		} finally {
			isGeneratingInvite = false;
		}
	}

	function copyInviteLink(code: string) {
		navigator.clipboard.writeText(`${window.location.origin}/invite/${code}`);
		addToast({
			type: 'success',
			message: 'Invite link copied!'
		});
	}

	async function deleteInvite(inviteId: string) {
		if (!$activeCommunity) return;

		try {
			await api.deleteInvite($activeCommunity.id, inviteId);
			invites = invites.filter(i => i.id !== inviteId);
			addToast({
				type: 'success',
				message: 'Invite deleted'
			});
		} catch (err) {
			console.error('Failed to delete invite:', err);
			addToast({
				type: 'error',
				message: 'Failed to delete invite'
			});
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

<Modal isOpen={$communitySettingsModalOpen} onclose={handleClose} title="Community Settings" size="md">
	<div class="flex gap-6">
		<!-- Tabs -->
		<div class="w-40 space-y-1">
			<button
				onclick={() => activeTab = 'overview'}
				class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'overview' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
			>
				<SettingsIcon size={16} class="inline-block mr-2" />
				Overview
			</button>
			<button
				onclick={() => activeTab = 'members'}
				class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'members' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
			>
				<Users size={16} class="inline-block mr-2" />
				Members
			</button>
			<button
				onclick={() => activeTab = 'roles'}
				class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'roles' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
			>
				<Crown size={16} class="inline-block mr-2" />
				Roles
			</button>
			<button
				onclick={() => activeTab = 'invites'}
				class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'invites' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
			>
				<Users size={16} class="inline-block mr-2" />
				Invites
			</button>
		</div>

		<!-- Content -->
		<div class="flex-1">
			{#if activeTab === 'overview'}
				<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
					<!-- Icon -->
					<div class="flex items-center gap-4">
						<input
							bind:this={fileInputRef}
							type="file"
							accept="image/*"
							onchange={handleIconSelect}
							class="hidden"
						/>

						{#if iconPreview}
							<div class="relative">
								<img
									src={iconPreview}
									alt="Community icon"
									class="w-20 h-20 rounded-xl object-cover"
								/>
								{#if isOwner}
									<button
										type="button"
										onclick={removeIcon}
										class="absolute -top-1 -right-1 w-5 h-5 bg-error text-white rounded-full flex items-center justify-center"
										aria-label="Remove icon"
									>
										<X size={12} />
									</button>
								{/if}
							</div>
						{:else}
							<button
								type="button"
								onclick={() => fileInputRef?.click()}
								disabled={!isOwner}
								class="w-20 h-20 rounded-xl border-2 border-dashed border-border hover:border-primary flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<Image size={24} class="text-text-muted" />
								<span class="text-xs text-text-muted">Upload</span>
							</button>
						{/if}

						<div>
							<p class="text-sm text-text-secondary">Community Icon</p>
							<p class="text-xs text-text-muted">Recommended size: 256x256</p>
							{#if errors.icon}
								<p class="text-xs text-error mt-1">{errors.icon}</p>
							{/if}
						</div>
					</div>

					<Input
						label="Community Name"
						bind:value={name}
						placeholder="My Awesome Community"
						error={errors.name}
						required
						maxlength={100}
						disabled={!isOwner}
					/>

					<Textarea
						label="Description"
						bind:value={description}
						placeholder="What's your community about?"
						rows={3}
						maxlength={500}
						error={errors.description}
						disabled={!isOwner}
					/>

					{#if isOwner}
						<label class="flex items-center gap-3 cursor-pointer">
							<div class="relative">
								<input
									type="checkbox"
									bind:checked={isPrivate}
									class="sr-only peer"
								/>
								<div class="w-10 h-6 bg-surface-hover rounded-full peer-checked:bg-primary transition-colors"></div>
								<div class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
							</div>
							<div>
								<p class="text-sm text-text-primary">Private Community</p>
								<p class="text-xs text-text-muted">Only people with an invite can join</p>
							</div>
						</label>
					{/if}

					{#if errors.submit}
						<p class="text-sm text-error">{errors.submit}</p>
					{/if}

					{#if isOwner}
						<div class="flex justify-between pt-4">
							<Button variant="danger" onclick={handleDeleteCommunity}>
								<Trash size={16} />
								Delete Community
							</Button>
							<Button type="submit" disabled={isSubmitting}>
								{#if isSubmitting}
									<Spinner size="sm" />
									Saving...
								{:else}
									Save Changes
								{/if}
							</Button>
						</div>
					{:else}
						<div class="pt-4">
							<Button variant="danger" onclick={handleLeaveCommunity}>
								Leave Community
							</Button>
						</div>
					{/if}
				</form>
			{:else if activeTab === 'members'}
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
														onchange={(e) => {
															const checked = (e.target as HTMLInputElement).checked;
															selectedMemberRoleIds = checked
																? [...selectedMemberRoleIds, role.id]
																: selectedMemberRoleIds.filter((id) => id !== role.id);
														}}
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
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{:else if activeTab === 'roles'}
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
												const role = roles.find((r) => r.id === selectedRoleId);
												if (role) deleteRole(role);
											}}
											disabled={isDeletingRole || !!roles.find((r) => r.id === selectedRoleId)?.isDefault}
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
										{#each permissionOptions as option}
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
			{:else if activeTab === 'invites'}
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<div>
							<h3 class="text-lg font-semibold text-text-primary">Invite Links</h3>
							<p class="text-sm text-text-muted">Create and manage invite links for your community</p>
						</div>
						{#if !showCreateInviteForm}
							<Button onclick={() => showCreateInviteForm = true} size="sm">
								<Plus size={16} />
								Create Invite
							</Button>
						{/if}
					</div>

					<!-- Create Invite Form -->
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
								<Button variant="ghost" onclick={() => showCreateInviteForm = false}>
									Cancel
								</Button>
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

					<!-- Invites List -->
					{#if isLoadingInvites}
						<div class="flex justify-center py-8">
							<Spinner size="lg" />
						</div>
					{:else if invites === null || invites.length === 0}
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
												<span class="text-xs px-2 py-0.5 rounded bg-error/10 text-error">Expired</span>
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
										<Button
											variant="ghost"
											size="sm"
											onclick={() => copyInviteLink(invite.code)}
											disabled={invalid}
										>
											<Copy size={16} />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onclick={() => deleteInvite(invite.id)}
										>
											<Trash size={16} class="text-error" />
										</Button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</Modal>
