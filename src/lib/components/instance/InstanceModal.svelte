<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button, Input, Modal } from '$lib/components/ui';
	import { Server, Globe, Check, X, AlertCircle } from 'lucide-svelte';
	import {
		instances,
		addInstance,
		removeInstance,
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
	let isChecking = $state(false);
	let checkResult = $state<'success' | 'error' | null>(null);

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
			name: new URL(newInstanceUrl).hostname,
			isOnline: true,
			lastChecked: new Date().toISOString()
		};

		addInstance(instance);
		setActiveInstance(instance.id);
		showToast('success', 'Instance added successfully');
		newInstanceUrl = '';
		checkResult = null;
		onclose();
		goto('/login');
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
		checkResult = null;
		onclose();
	}
</script>

<Modal isOpen={isOpen} title="Manage Instances" size="lg" onclose={handleClose}>
	<div class="space-y-6">
		<div class="space-y-3">
			<h3 class="text-sm font-medium text-text-secondary">Add New Instance</h3>
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
