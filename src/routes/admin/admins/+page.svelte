<script lang="ts">
	import { onMount } from 'svelte';
	import { Shield, ShieldOff, Search, UserPlus } from 'lucide-svelte';
	import { api } from '$lib/api';
	import { showToast } from '$lib/stores/ui';
	import Button from '$lib/components/ui/Button.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import type { AdminUser } from '$lib/types';

	let admins: AdminUser[] = $state([]);
	let loading = $state(true);
	let searchQuery = $state('');
	let searchResults: { id: string; username: string; avatarUrl: string | null }[] = $state([]);
	let searching = $state(false);
	let showAddModal = $state(false);
	let selectedUserId = $state('');
	let selectedUsername = $state('');
	let addingAdmin = $state(false);
	let removingAdmin = $state<string | null>(null);

	onMount(loadAdmins);

	async function loadAdmins() {
		try {
			admins = await api.getAdminUsers();
		} catch (e) {
			showToast('error', 'Failed to load admins');
			console.error(e);
		} finally {
			loading = false;
		}
	}

	async function searchUsers(query: string) {
		if (query.length < 2) {
			searchResults = [];
			return;
		}
		searching = true;
		try {
			const result = await api.searchUsers(query, 1, 10);
			// Filter out existing admins
			const adminIds = new Set(admins.map((a) => a.id));
			searchResults = result.data.filter((u) => !adminIds.has(u.id));
		} catch (e) {
			searchResults = [];
		} finally {
			searching = false;
		}
	}

	async function addAdmin() {
		if (!selectedUserId) return;
		addingAdmin = true;
		try {
			await api.addAdmin(selectedUserId);
			showToast('success', `${selectedUsername} is now an admin`);
			showAddModal = false;
			selectedUserId = '';
			selectedUsername = '';
			searchQuery = '';
			searchResults = [];
			await loadAdmins();
		} catch (e) {
			showToast('error', 'Failed to add admin');
		} finally {
			addingAdmin = false;
		}
	}

	async function removeAdmin(userId: string, username: string) {
		if (!confirm(`Remove ${username} as admin?`)) return;
		removingAdmin = userId;
		try {
			await api.removeAdmin(userId);
			showToast('success', `${username} is no longer an admin`);
			await loadAdmins();
		} catch (e) {
			showToast('error', 'Failed to remove admin');
		} finally {
			removingAdmin = null;
		}
	}

	function openAddModal() {
		showAddModal = true;
		searchQuery = '';
		searchResults = [];
		selectedUserId = '';
		selectedUsername = '';
	}

	function selectUser(userId: string, username: string) {
		selectedUserId = userId;
		selectedUsername = username;
		searchQuery = username;
		searchResults = [];
	}
</script>

<div class="p-8 max-w-[1600px] mx-auto">
	<div class="flex items-center justify-between mb-8">
		<div>
			<h1 class="text-2xl font-bold text-text-primary">Manage Admins</h1>
			<p class="text-sm text-text-muted mt-1">Add or remove instance administrators</p>
		</div>
		<Button onclick={openAddModal}>
			{#snippet children()}
				<UserPlus size={16} />
				Add Admin
			{/snippet}
		</Button>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-32">
			<div
				class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"
			></div>
		</div>
	{:else}
		<div class="bg-surface border border-border rounded-xl overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead>
						<tr class="border-b border-border">
							<th
								class="text-left text-xs font-medium text-text-muted uppercase tracking-wider px-6 py-4"
							>
								User
							</th>
							<th
								class="text-left text-xs font-medium text-text-muted uppercase tracking-wider px-6 py-4"
							>
								Admin Since
							</th>
							<th
								class="text-right text-xs font-medium text-text-muted uppercase tracking-wider px-6 py-4"
							>
								Actions
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each admins as admin}
							<tr class="hover:bg-surface-hover transition-colors">
								<td class="px-6 py-4">
									<div class="flex items-center gap-3">
										<div
											class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary shrink-0"
										>
											{admin.username.charAt(0).toUpperCase()}
										</div>
										<div>
											<p class="text-sm font-medium text-text-primary">{admin.username}</p>
											<p class="text-xs text-text-muted">ID: {admin.id.slice(0, 8)}...</p>
										</div>
										<div class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10">
											<Shield size={12} class="text-primary" />
											<span class="text-xs font-medium text-primary">Admin</span>
										</div>
									</div>
								</td>
								<td class="px-6 py-4">
									<span class="text-sm text-text-secondary">{new Date(admin.createdAt).toLocaleDateString()}</span>
								</td>
								<td class="px-6 py-4 text-right">
									<Button
										variant="ghost"
										size="sm"
										disabled={removingAdmin === admin.id}
										loading={removingAdmin === admin.id}
										onclick={() => removeAdmin(admin.id, admin.username)}
									>
										{#snippet children()}
											<ShieldOff size={14} />
											Remove
										{/snippet}
									</Button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#if admins.length === 0}
				<div class="text-center py-16 text-text-muted">
					<Shield size={32} class="mx-auto mb-3 opacity-50" />
					<p class="font-medium">No admins found</p>
					<p class="text-sm mt-1">Add the first admin to get started</p>
				</div>
			{/if}
		</div>
	{/if}
</div>

<Modal
	isOpen={showAddModal}
	title="Add Admin"
	size="sm"
	onclose={() => {
		showAddModal = false;
	}}
>
	{#snippet children()}
		<div class="space-y-4">
			<div>
				<label class="block text-sm font-medium text-text-primary mb-2">Search Users</label>
				<div class="relative">
					<Search
						size={16}
						class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
					/>
					<input
						type="text"
						placeholder="Search by username..."
						bind:value={searchQuery}
						oninput={() => searchUsers(searchQuery)}
						class="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
					/>
				</div>
			</div>

			{#if searching}
				<div class="flex items-center justify-center py-4">
					<div
						class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"
					></div>
				</div>
			{/if}

			{#if selectedUserId}
				<div class="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center gap-3">
					<div
						class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary"
					>
						{selectedUsername.charAt(0).toUpperCase()}
					</div>
					<div>
						<p class="text-sm font-medium text-text-primary">{selectedUsername}</p>
						<p class="text-xs text-text-muted">Selected user</p>
					</div>
				</div>
			{/if}

			{#if searchResults.length > 0 && !selectedUserId}
				<div class="max-h-48 overflow-y-auto space-y-1">
					{#each searchResults as user}
						<button
							onclick={() => selectUser(user.id, user.username)}
							class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-hover text-left transition-colors"
						>
							<div
								class="w-8 h-8 rounded-full bg-background-tertiary flex items-center justify-center text-sm font-medium text-text-secondary shrink-0"
							>
								{user.username.charAt(0).toUpperCase()}
							</div>
							<span class="text-sm text-text-primary">{user.username}</span>
						</button>
					{/each}
				</div>
			{/if}

			{#if searchQuery.length >= 2 && searchResults.length === 0 && !searching && !selectedUserId}
				<p class="text-sm text-text-muted text-center py-2">No users found</p>
			{/if}
		</div>
	{/snippet}

	{#snippet footer()}
		<div class="flex justify-end gap-3">
			<Button
				variant="secondary"
				onclick={() => {
					showAddModal = false;
				}}
			>
				{#snippet children()}
					Cancel
				{/snippet}
			</Button>
			<Button
				disabled={!selectedUserId}
				loading={addingAdmin}
				onclick={addAdmin}
			>
				{#snippet children()}
					Add Admin
				{/snippet}
			</Button>
		</div>
	{/snippet}
</Modal>
