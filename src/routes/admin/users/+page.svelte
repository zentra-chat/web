<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Search,
		Shield,
		Trash2,
		Undo2,
		Eye,
		ChevronLeft,
		ChevronRight,
		X,
		CheckCircle,
		XCircle,
		Save
	} from 'lucide-svelte';
	import { api } from '$lib/api';
	import { showToast } from '$lib/stores/ui';
	import Button from '$lib/components/ui/Button.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import type {
		AdminUserListItem,
		AdminUserDetail,
		PaginatedResponse,
		UserStatus
	} from '$lib/types';

	let users: AdminUserListItem[] = $state([]);
	let total = $state(0);
	let totalPages = $state(0);
	let loading = $state(true);
	let page = $state(1);
	let pageSize = $state(20);
	let searchQuery = $state('');
	let statusFilter = $state('');
	let searchTimeout: ReturnType<typeof setTimeout> | null = $state(null);

	let selectedUser: AdminUserDetail | null = $state(null);
	let showDetailModal = $state(false);
	let loadingDetail = $state(false);
	let editing = $state(false);

	let editUsername = $state('');
	let editEmail = $state('');
	let editDisplayName = $state('');
	let editBio = $state('');
	let editEmailVerified = $state(false);
	let editCustomStatus = $state('');
	let saving = $state(false);

	let deletingId = $state<string | null>(null);
	let togglingAdmin = $state(false);

	onMount(() => {
		loadUsers();
	});

	async function loadUsers() {
		loading = true;
		try {
			const result = await api.listAdminUsers(page, pageSize, searchQuery, statusFilter);
			users = result.data;
			total = result.total;
			totalPages = result.totalPages;
		} catch (e) {
			showToast('error', 'Failed to load users');
			console.error(e);
		} finally {
			loading = false;
		}
	}

	function onSearchInput() {
		if (searchTimeout) clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			page = 1;
			loadUsers();
		}, 300);
	}

	function onStatusFilterChange() {
		page = 1;
		loadUsers();
	}

	function prevPage() {
		if (page > 1) {
			page--;
			loadUsers();
		}
	}

	function nextPage() {
		if (page < totalPages) {
			page++;
			loadUsers();
		}
	}

	async function openDetail(userId: string) {
		loadingDetail = true;
		showDetailModal = true;
		editing = false;
		try {
			selectedUser = await api.getAdminUser(userId);
			editUsername = selectedUser.username;
			editEmail = selectedUser.email;
			editDisplayName = selectedUser.displayName ?? '';
			editBio = selectedUser.bio ?? '';
			editEmailVerified = selectedUser.emailVerified;
			editCustomStatus = selectedUser.customStatus ?? '';
		} catch (e) {
			showToast('error', 'Failed to load user details');
			showDetailModal = false;
		} finally {
			loadingDetail = false;
		}
	}

	function closeDetail() {
		showDetailModal = false;
		selectedUser = null;
		editing = false;
	}

	function startEditing() {
		editing = true;
	}

	function cancelEditing() {
		editing = false;
		if (selectedUser) {
			editUsername = selectedUser.username;
			editEmail = selectedUser.email;
			editDisplayName = selectedUser.displayName ?? '';
			editBio = selectedUser.bio ?? '';
			editEmailVerified = selectedUser.emailVerified;
			editCustomStatus = selectedUser.customStatus ?? '';
		}
	}

	async function saveUser() {
		if (!selectedUser) return;
		saving = true;
		try {
			const data: Record<string, unknown> = {};
			if (editUsername !== selectedUser.username) data.username = editUsername;
			if (editEmail !== selectedUser.email) data.email = editEmail;
			if ((editDisplayName || null) !== selectedUser.displayName) data.displayName = editDisplayName || null;
			if ((editBio || null) !== selectedUser.bio) data.bio = editBio || null;
			if (editEmailVerified !== selectedUser.emailVerified) data.emailVerified = editEmailVerified;
			if ((editCustomStatus || null) !== selectedUser.customStatus) data.customStatus = editCustomStatus || null;

			if (Object.keys(data).length === 0) {
				editing = false;
				return;
			}

			selectedUser = await api.updateAdminUser(selectedUser.id, data as any);
			showToast('success', 'User updated successfully');
			editing = false;
			loadUsers();
		} catch (e) {
			showToast('error', 'Failed to update user');
		} finally {
			saving = false;
		}
	}

	async function deleteUser(userId: string, username: string) {
		if (!confirm(`Delete user "${username}"? This will ban the account and revoke all sessions.`)) return;
		deletingId = userId;
		try {
			await api.deleteAdminUser(userId);
			showToast('success', `${username} has been deleted`);
			if (selectedUser?.id === userId) closeDetail();
			loadUsers();
		} catch (e) {
			showToast('error', 'Failed to delete user');
		} finally {
			deletingId = null;
		}
	}

	async function restoreUser(userId: string, username: string) {
		if (!confirm(`Restore user "${username}"?`)) return;
		deletingId = userId;
		try {
			await api.restoreAdminUser(userId);
			showToast('success', `${username} has been restored`);
			if (selectedUser?.id === userId) closeDetail();
			loadUsers();
		} catch (e) {
			showToast('error', 'Failed to restore user');
		} finally {
			deletingId = null;
		}
	}

	async function toggleAdmin(userId: string, username: string, isCurrentlyAdmin: boolean) {
		const action = isCurrentlyAdmin ? 'remove' : 'make';
		if (!confirm(`${action === 'make' ? 'Make' : 'Remove'} ${username} ${action === 'make' ? 'an' : 'as'} admin?`)) return;
		togglingAdmin = true;
		try {
			if (isCurrentlyAdmin) {
				await api.removeAdmin(userId);
				showToast('success', `${username} is no longer an admin`);
			} else {
				await api.addAdmin(userId);
				showToast('success', `${username} is now an admin`);
			}
			if (selectedUser?.id === userId) {
				selectedUser = await api.getAdminUser(userId);
			}
			loadUsers();
		} catch (e) {
			showToast('error', `Failed to ${action} admin`);
		} finally {
			togglingAdmin = false;
		}
	}

	function getStatusColor(status: UserStatus): string {
		switch (status) {
			case 'online': return 'bg-green-500';
			case 'away': return 'bg-yellow-500';
			case 'busy': return 'bg-red-500';
			case 'invisible': return 'bg-gray-500';
			default: return 'bg-gray-400';
		}
	}

	function getInitials(name: string): string {
		return name.charAt(0).toUpperCase();
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		return new Date(dateStr).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function formatDateTime(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		return new Date(dateStr).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="p-8 max-w-[1600px] mx-auto">
	<div class="flex items-center justify-between mb-6">
		<div>
			<h1 class="text-2xl font-bold text-text-primary">User Management</h1>
			<p class="text-sm text-text-muted mt-1">Manage all registered users on this instance</p>
		</div>
	</div>

	<div class="flex items-center gap-3 mb-6">
		<div class="relative flex-1 max-w-md">
			<Search
				size={16}
				class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
			/>
			<input
				type="text"
				placeholder="Search by username, display name, or email..."
				bind:value={searchQuery}
				oninput={onSearchInput}
				class="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
			/>
		</div>

		<select
			bind:value={statusFilter}
			onchange={onStatusFilterChange}
			class="bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
		>
			<option value="">All Status</option>
			<option value="online">Online</option>
			<option value="away">Away</option>
			<option value="busy">Busy</option>
			<option value="invisible">Invisible</option>
			<option value="offline">Offline</option>
		</select>
	</div>

	<div class="bg-surface border border-border rounded-xl overflow-hidden">
		{#if loading}
			<div class="flex items-center justify-center py-32">
				<div
					class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"
				></div>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead>
						<tr class="border-b border-border">
							<th class="text-left text-xs font-medium text-text-muted uppercase tracking-wider px-6 py-4">
								User
							</th>
							<th class="text-left text-xs font-medium text-text-muted uppercase tracking-wider px-6 py-4">
								Status
							</th>
							<th class="text-left text-xs font-medium text-text-muted uppercase tracking-wider px-6 py-4">
								Role
							</th>
							<th class="text-left text-xs font-medium text-text-muted uppercase tracking-wider px-6 py-4">
								Joined
							</th>
							<th class="text-left text-xs font-medium text-text-muted uppercase tracking-wider px-6 py-4">
								Last Seen
							</th>
							<th class="text-right text-xs font-medium text-text-muted uppercase tracking-wider px-6 py-4">
								Actions
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each users as user}
							<tr class="hover:bg-surface-hover transition-colors">
								<td class="px-6 py-4">
									<div class="flex items-center gap-3">
										{#if user.avatarUrl}
											<img
												src={user.avatarUrl}
												alt={user.username}
												class="w-9 h-9 rounded-full object-cover shrink-0"
											/>
										{:else}
											<div
												class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary shrink-0"
											>
												{getInitials(user.username)}
											</div>
										{/if}
										<div>
											<p class="text-sm font-medium text-text-primary">
												{user.displayName || user.username}
												{#if user.displayName}
													<span class="text-text-muted font-normal"> (@{user.username})</span>
												{/if}
											</p>
											<p class="text-xs text-text-muted">{user.email}</p>
										</div>
									</div>
								</td>
								<td class="px-6 py-4">
									<div class="flex items-center gap-2">
										<div class="w-2 h-2 rounded-full {getStatusColor(user.status)}"></div>
										<span class="text-sm text-text-secondary capitalize">{user.status}</span>
									</div>
								</td>
								<td class="px-6 py-4">
									{#if user.isAdmin}
										<div class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 w-fit">
											<Shield size={12} class="text-primary" />
											<span class="text-xs font-medium text-primary">Admin</span>
										</div>
									{:else}
										<span class="text-sm text-text-muted">User</span>
									{/if}
								</td>
								<td class="px-6 py-4">
									<span class="text-sm text-text-secondary">{formatDate(user.createdAt)}</span>
								</td>
								<td class="px-6 py-4">
									<span class="text-sm text-text-muted">{formatDate(user.lastSeenAt)}</span>
								</td>
								<td class="px-6 py-4 text-right">
									<div class="flex items-center justify-end gap-2">
										<Button
											variant="ghost"
											size="sm"
											onclick={() => openDetail(user.id)}
										>
											{#snippet children()}
												<Eye size={14} />
												View
											{/snippet}
										</Button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#if users.length === 0}
				<div class="text-center py-16 text-text-muted">
					<Search size={32} class="mx-auto mb-3 opacity-50" />
					<p class="font-medium">No users found</p>
					<p class="text-sm mt-1">
						{#if searchQuery}
							Try a different search query
						{:else}
							No users are registered yet
						{/if}
					</p>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Pagination -->
	{#if totalPages > 1}
		<div class="flex items-center justify-between mt-4 px-1">
			<p class="text-sm text-text-muted">
				Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total} users
			</p>
			<div class="flex items-center gap-2">
				<Button variant="ghost" size="sm" disabled={page <= 1} onclick={prevPage}>
					{#snippet children()}
						<ChevronLeft size={16} />
						Previous
					{/snippet}
				</Button>
				{#each Array.from({ length: totalPages }, (_, i) => i + 1) as p}
					<button
						onclick={() => { page = p; loadUsers(); }}
						class="w-8 h-8 rounded-lg text-sm font-medium transition-colors
							{p === page
								? 'bg-primary text-background'
								: 'text-text-muted hover:bg-surface-hover hover:text-text-primary'}"
					>
						{p}
					</button>
				{/each}
				<Button variant="ghost" size="sm" disabled={page >= totalPages} onclick={nextPage}>
					{#snippet children()}
						Next
						<ChevronRight size={16} />
					{/snippet}
				</Button>
			</div>
		</div>
	{/if}
</div>

<!-- User Detail Modal -->
<Modal
	isOpen={showDetailModal}
	title={selectedUser ? (editing ? 'Edit User' : `User: ${selectedUser.username}`) : ''}
	size="lg"
	onclose={closeDetail}
>
	{#snippet children()}
		{#if loadingDetail}
			<div class="flex items-center justify-center py-16">
				<div
					class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"
				></div>
			</div>
		{:else if selectedUser}
			<div class="space-y-6">
				<!-- Avatar and basic info -->
				<div class="flex items-center gap-4">
					{#if selectedUser.avatarUrl}
						<img
							src={selectedUser.avatarUrl}
							alt={selectedUser.username}
							class="w-16 h-16 rounded-full object-cover"
						/>
					{:else}
						<div
							class="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center text-2xl font-bold text-primary"
						>
							{getInitials(selectedUser.username)}
						</div>
					{/if}
					<div>
						<h3 class="text-lg font-semibold text-text-primary">{selectedUser.displayName || selectedUser.username}</h3>
						<p class="text-sm text-text-muted">@{selectedUser.username}</p>
					</div>
				</div>

				<!-- User details -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">
							Username
						</label>
						{#if editing}
							<input
								type="text"
								bind:value={editUsername}
								class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
							/>
						{:else}
							<p class="text-sm text-text-primary">{selectedUser.username}</p>
						{/if}
					</div>

					<div>
						<label class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">
							Email
						</label>
						{#if editing}
							<input
								type="email"
								bind:value={editEmail}
								class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
							/>
						{:else}
							<div class="flex items-center gap-2">
								<p class="text-sm text-text-primary">{selectedUser.email}</p>
								{#if selectedUser.emailVerified}
									<CheckCircle size={14} class="text-green-500 shrink-0" />
								{:else}
									<XCircle size={14} class="text-red-500 shrink-0" />
								{/if}
							</div>
						{/if}
					</div>

					<div>
						<label class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">
							Display Name
						</label>
						{#if editing}
							<input
								type="text"
								bind:value={editDisplayName}
								placeholder="No display name"
								class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
							/>
						{:else}
							<p class="text-sm text-text-primary">{selectedUser.displayName || '-'}</p>
						{/if}
					</div>

					<div>
						<label class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">
							Custom Status
						</label>
						{#if editing}
							<input
								type="text"
								bind:value={editCustomStatus}
								placeholder="No custom status"
								maxlength={128}
								class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
							/>
						{:else}
							<p class="text-sm text-text-primary">{selectedUser.customStatus || '-'}</p>
						{/if}
					</div>

					<div>
						<label class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">
							Bio
						</label>
						{#if editing}
							<textarea
								bind:value={editBio}
								placeholder="No bio"
								rows={3}
								class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
							></textarea>
						{:else}
							<p class="text-sm text-text-primary">{selectedUser.bio || '-'}</p>
						{/if}
					</div>

					<div>
						<label class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">
							Email Verified
						</label>
						{#if editing}
							<div class="flex items-center gap-2 mt-2">
								<button
									onclick={() => { editEmailVerified = !editEmailVerified; }}
									class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors
										{editEmailVerified ? 'bg-green-500' : 'bg-border'}"
								>
									<span
										class="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform
											{editEmailVerified ? 'translate-x-[18px]' : 'translate-x-[3px]'}"
									></span>
								</button>
								<span class="text-sm text-text-secondary">
									{editEmailVerified ? 'Verified' : 'Not verified'}
								</span>
							</div>
						{:else}
							<div class="flex items-center gap-1.5 mt-1">
								{#if selectedUser.emailVerified}
									<CheckCircle size={14} class="text-green-500" />
								{:else}
									<XCircle size={14} class="text-red-500" />
								{/if}
								<span class="text-sm {selectedUser.emailVerified ? 'text-green-500' : 'text-red-500'}">
									{selectedUser.emailVerified ? 'Verified' : 'Not verified'}
								</span>
							</div>
						{/if}
					</div>

					<div>
						<label class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">
							Status
						</label>
						<div class="flex items-center gap-2 mt-1">
							<div class="w-2.5 h-2.5 rounded-full {getStatusColor(selectedUser.status)}"></div>
							<span class="text-sm text-text-secondary capitalize">{selectedUser.status}</span>
						</div>
					</div>

					<div>
						<label class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">
							Role
						</label>
						<div class="mt-1">
							{#if selectedUser.isAdmin}
								<div class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 w-fit">
									<Shield size={12} class="text-primary" />
									<span class="text-xs font-medium text-primary">Admin</span>
								</div>
							{:else}
								<span class="text-sm text-text-secondary">User</span>
							{/if}
						</div>
					</div>

					<div>
						<label class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">
							2FA
						</label>
						<p class="text-sm mt-1 text-text-secondary">
							{selectedUser.twoFactorEnabled ? 'Enabled' : 'Disabled'}
						</p>
					</div>

					<div>
						<label class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">
							Created
						</label>
						<p class="text-sm mt-1 text-text-secondary">{formatDateTime(selectedUser.createdAt)}</p>
					</div>

					<div>
						<label class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">
							Last Seen
						</label>
						<p class="text-sm mt-1 text-text-secondary">{formatDateTime(selectedUser.lastSeenAt)}</p>
					</div>
				</div>
			</div>
		{/if}
	{/snippet}

	{#snippet footer()}
		{#if selectedUser}
			<div class="flex items-center justify-between w-full">
				<div class="flex items-center gap-2">
					{#if selectedUser.deletedAt}
						<Button
							variant="secondary"
							size="sm"
							disabled={deletingId === selectedUser.id}
							loading={deletingId === selectedUser.id}
							onclick={() => restoreUser(selectedUser.id, selectedUser.username)}
						>
							{#snippet children()}
								<Undo2 size={14} />
								Restore
							{/snippet}
						</Button>
					{:else if !editing}
						<Button
							variant={selectedUser.isAdmin ? 'secondary' : 'primary'}
							size="sm"
							disabled={togglingAdmin}
							loading={togglingAdmin}
							onclick={() => toggleAdmin(selectedUser.id, selectedUser.username, selectedUser.isAdmin)}
						>
							{#snippet children()}
								<Shield size={14} />
								{selectedUser.isAdmin ? 'Remove Admin' : 'Make Admin'}
							{/snippet}
						</Button>
						<Button
							variant="danger"
							size="sm"
							disabled={deletingId === selectedUser.id}
							loading={deletingId === selectedUser.id}
							onclick={() => deleteUser(selectedUser.id, selectedUser.username)}
						>
							{#snippet children()}
								<Trash2 size={14} />
								Delete
							{/snippet}
						</Button>
					{/if}
				</div>

				<div class="flex items-center gap-3">
					{#if editing}
						<Button variant="secondary" onclick={cancelEditing}>
							{#snippet children()}
								<X size={14} />
								Cancel
							{/snippet}
						</Button>
						<Button loading={saving} onclick={saveUser}>
							{#snippet children()}
								<Save size={14} />
								Save Changes
							{/snippet}
						</Button>
					{:else}
						<Button variant="secondary" onclick={closeDetail}>
							{#snippet children()}
								Close
							{/snippet}
						</Button>
						<Button onclick={startEditing}>
							{#snippet children()}
								Edit
							{/snippet}
						</Button>
					{/if}
				</div>
			</div>
		{/if}
	{/snippet}
</Modal>
