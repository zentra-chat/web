<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button, Input, Modal } from '$lib/components/ui';
	import { Server, Globe, Check, X, AlertCircle, Pencil, Save, ImagePlus } from 'lucide-svelte';
	import {
		instances,
		addInstance,
		removeInstance,
		updateInstance,
		setActiveInstance,
		activeInstanceId,
		generateInstanceId
	} from '$lib/stores/instance';
	import { showToast } from '$lib/stores/ui';
	import { api } from '$lib/api';

	interface Props {
		isOpen: boolean;
		onclose: () => void;
	}

	let { isOpen, onclose }: Props = $props();

	let newInstanceUrl = $state('');
	let newInstanceName = $state('');
	let newInstanceIconPreview = $state<string | null>(null);
	let isChecking = $state(false);
	let checkResult = $state<'success' | 'error' | null>(null);
	let editingInstanceId = $state<string | null>(null);
	let editName = $state('');
	let editIconPreview = $state<string | null>(null);

	async function readImageAsDataUrl(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result));
			reader.onerror = () => reject(new Error('Failed to read image file'));
			reader.readAsDataURL(file);
		});
	}

	function handleNewInstanceIconChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		if (!file.type.startsWith('image/')) {
			showToast('error', 'Please choose an image file');
			input.value = '';
			return;
		}

		readImageAsDataUrl(file)
			.then((dataUrl) => {
				newInstanceIconPreview = dataUrl;
			})
			.catch(() => showToast('error', 'Failed to load image'));
	}

	function handleEditIconChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		if (!file.type.startsWith('image/')) {
			showToast('error', 'Please choose an image file');
			input.value = '';
			return;
		}

		readImageAsDataUrl(file)
			.then((dataUrl) => {
				editIconPreview = dataUrl;
			})
			.catch(() => showToast('error', 'Failed to load image'));
	}

	async function checkInstance() {
		if (!newInstanceUrl.trim()) return;

		// Normalize URL
		let url = newInstanceUrl.trim();
		if (!url.startsWith('http://') && !url.startsWith('https://')) {
			url = 'https://' + url;
		}
		// Remove trailing slash
		url = url.replace(/\/$/, '');

		isChecking = true;
		checkResult = null;

		try {
			const isOnline = await api.checkHealth(url);
			checkResult = isOnline ? 'success' : 'error';

			if (isOnline) {
				newInstanceUrl = url;
			}
		} catch {
			checkResult = 'error';
		} finally {
			isChecking = false;
		}
	}

	async function handleAddInstance() {
		if (!newInstanceUrl.trim() || checkResult !== 'success') return;

		// Check if already exists
		const existing = $instances.find((i) => i.url === newInstanceUrl);
		if (existing) {
			showToast('warning', 'This instance is already added');
			setActiveInstance(existing.id);
			onclose();
			goto('/login');
			return;
		}

		const instance = {
			id: generateInstanceId(),
			url: newInstanceUrl,
			name: newInstanceName.trim() || new URL(newInstanceUrl).hostname,
			iconUrl: newInstanceIconPreview || undefined,
			isOnline: true,
			lastChecked: new Date().toISOString()
		};

		addInstance(instance);
		setActiveInstance(instance.id);
		showToast('success', 'Instance added successfully');
		newInstanceUrl = '';
		newInstanceName = '';
		newInstanceIconPreview = null;
		checkResult = null;
		onclose();
		goto('/login');
	}

	function startEditInstance(instance: { id: string; name: string; iconUrl?: string }) {
		editingInstanceId = instance.id;
		editName = instance.name;
		editIconPreview = instance.iconUrl || null;
	}

	function saveInstanceEdits(instance: { id: string; url: string }) {
		const fallbackName = new URL(instance.url).hostname;
		updateInstance(instance.id, {
			name: editName.trim() || fallbackName,
			iconUrl: editIconPreview || undefined
		});
		showToast('success', 'Instance updated');
		editingInstanceId = null;
	}

	function cancelEdit() {
		editingInstanceId = null;
		editName = '';
		editIconPreview = null;
	}

	function handleRemoveInstance(id: string) {
		removeInstance(id);
		showToast('info', 'Instance removed');
	}

	function handleSelectInstance(id: string) {
		setActiveInstance(id);
		onclose();
		goto('/login');
	}

	function handleClose() {
		newInstanceUrl = '';
		newInstanceName = '';
		newInstanceIconPreview = null;
		cancelEdit();
		checkResult = null;
		onclose();
	}
</script>

<Modal isOpen={isOpen} title="Manage Instances" size="lg" onclose={handleClose}>
	<div class="space-y-6">
		<div class="space-y-3">
			<h3 class="text-sm font-medium text-text-secondary">Add New Instance</h3>
			<Input
				type="text"
				bind:value={newInstanceName}
				placeholder="Display name (optional)"
			/>
			<div class="space-y-2">
				<label class="text-xs text-text-muted">Instance Image (optional)</label>
				<div class="flex items-center gap-3">
					<label class="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-sm text-text-secondary hover:text-text-primary hover:border-border-light transition-colors">
						<ImagePlus size={16} />
						Choose image
						<input type="file" accept="image/*" class="hidden" onchange={handleNewInstanceIconChange} />
					</label>
					{#if newInstanceIconPreview}
						<img src={newInstanceIconPreview} alt="Instance preview" class="w-10 h-10 rounded-lg object-cover border border-border" />
						<Button variant="ghost" size="sm" onclick={() => (newInstanceIconPreview = null)}>Remove</Button>
					{/if}
				</div>
			</div>
			<div class="flex gap-2">
				<div class="flex-1 relative">
					<Input
						type="url"
						bind:value={newInstanceUrl}
						placeholder="https://zentra.example.com"
						onkeydown={(e) => e.key === 'Enter' && checkInstance()}
					/>
					{#if checkResult === 'success'}
						<div class="absolute right-3 top-1/2 -translate-y-1/2 text-success">
							<Check size={18} />
						</div>
					{:else if checkResult === 'error'}
						<div class="absolute right-3 top-1/2 -translate-y-1/2 text-danger">
							<X size={18} />
						</div>
					{/if}
				</div>
				<Button variant="secondary" onclick={checkInstance} loading={isChecking}>Check</Button>
			</div>
			{#if checkResult === 'error'}
				<p class="text-sm text-danger flex items-center gap-1">
					<AlertCircle size={14} />
					Unable to connect to instance
				</p>
			{/if}
			{#if checkResult === 'success'}
				<Button onclick={handleAddInstance} class="w-full">Add Instance</Button>
			{/if}
		</div>

		{#if $instances.length > 0}
			<div class="space-y-3">
				<h3 class="text-sm font-medium text-text-secondary">Your Instances</h3>
				<div class="space-y-2">
					{#each $instances as instance (instance.id)}
						<div
							class="flex items-center gap-3 p-3 bg-background rounded-lg border border-border hover:border-border-light transition-colors group"
						>
							<div
								class="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-primary"
							>
								{#if instance.iconUrl}
									<img
										src={instance.iconUrl}
										alt={instance.name}
										class="w-full h-full rounded-lg object-cover"
									/>
								{:else}
									<Server size={20} />
								{/if}
							</div>
							<div class="flex-1 min-w-0">
								<p class="font-medium text-text-primary truncate">{instance.name}</p>
								<p class="text-sm text-text-muted truncate">{instance.url}</p>
							</div>
							<div class="flex items-center gap-2">
								<span
									class="w-2 h-2 rounded-full {instance.isOnline ? 'bg-success' : 'bg-text-muted'}"
								></span>
								<Button
									variant="ghost"
									size="sm"
									onclick={() => startEditInstance(instance)}
								>
									<Pencil size={14} />
								</Button>
								{#if $activeInstanceId === instance.id}
									<span class="text-xs text-primary font-medium">Active</span>
								{:else}
									<Button
										variant="ghost"
										size="sm"
										onclick={() => handleSelectInstance(instance.id)}
									>
										Connect
									</Button>
								{/if}
								<Button
									variant="ghost"
									size="sm"
									onclick={() => handleRemoveInstance(instance.id)}
									class="text-danger hover:text-danger-hover opacity-0 group-hover:opacity-100"
								>
									<X size={16} />
								</Button>
							</div>
						</div>
						{#if editingInstanceId === instance.id}
							<div class="mt-3 p-3 rounded-lg border border-border bg-background space-y-3">
								<Input type="text" bind:value={editName} placeholder="Instance display name" />
								<div class="flex items-center gap-3">
									<label class="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-sm text-text-secondary hover:text-text-primary hover:border-border-light transition-colors">
										<ImagePlus size={16} />
										Change image
										<input type="file" accept="image/*" class="hidden" onchange={handleEditIconChange} />
									</label>
									{#if editIconPreview}
										<img src={editIconPreview} alt="Instance image" class="w-10 h-10 rounded-lg object-cover border border-border" />
										<Button variant="ghost" size="sm" onclick={() => (editIconPreview = null)}>Remove</Button>
									{/if}
								</div>
								<div class="flex items-center justify-end gap-2">
									<Button variant="ghost" size="sm" onclick={cancelEdit}>Cancel</Button>
									<Button size="sm" onclick={() => saveInstanceEdits(instance)}>
										<Save size={14} />
										Save
									</Button>
								</div>
							</div>
						{/if}
					{/each}
				</div>
			</div>
		{:else}
			<div class="text-center py-8">
				<div class="w-16 h-16 mx-auto mb-4 rounded-full bg-surface flex items-center justify-center">
					<Globe size={32} class="text-text-muted" />
				</div>
				<p class="text-text-secondary mb-2">No instances added yet</p>
				<p class="text-sm text-text-muted">Add a Zentra instance URL above to get started</p>
			</div>
		{/if}
	</div>
</Modal>
