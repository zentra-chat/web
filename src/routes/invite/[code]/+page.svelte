<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { Button, Spinner, Avatar } from '$lib/components/ui';
	import { Users, AlertCircle, CheckCircle, LogIn } from 'lucide-svelte';
	import { api } from '$lib/api';
	import { isAuthenticated, activeInstance, loadInstances } from '$lib/stores/instance';
	import { addCommunity, selectCommunity } from '$lib/stores/community';
	import { addToast } from '$lib/stores/ui';
	import type { Community } from '$lib/types';

	let inviteCode = $derived($page.params.code);
	let isLoading = $state(true);
	let isJoining = $state(false);
	let error = $state<string | null>(null);
	let joinError = $state<string | null>(null);
	let inviteInfo = $state<{ community: Community; valid: boolean } | null>(null);
	let hasJoined = $state(false);

	onMount(async () => {
		loadInstances();
		await fetchInviteInfo();
	});

	async function fetchInviteInfo() {
		if (!inviteCode) {
			error = 'Invalid invite code';
			isLoading = false;
			return;
		}

		try {
			// Check if we have an active instance
			if (!$activeInstance) {
				// Wait a bit for instances to load
				await new Promise((resolve) => setTimeout(resolve, 500));
				if (!$activeInstance) {
					error = 'Please connect to an instance first';
					isLoading = false;
					return;
				}
			}

			inviteInfo = await api.getInviteInfo(inviteCode);

			if (!inviteInfo.valid) {
				error = 'This invite link has expired or is invalid';
			}
		} catch (err: any) {
			console.error('Failed to fetch invite info:', err);
			if (err.code === 'NETWORK_ERROR' || !$activeInstance) {
				error = 'Please connect to an instance to view this invite';
			} else if (err.error?.includes('expired')) {
				error = 'This invite link has expired';
			} else if (err.error?.includes('maximum uses')) {
				error = 'This invite link has reached its maximum uses';
			} else {
				error = 'Invalid or expired invite link';
			}
		} finally {
			isLoading = false;
		}
	}

	async function handleJoin() {
		if (!inviteCode || isJoining) return;

		if (!$isAuthenticated) {
			// Store the invite code and redirect to login
			sessionStorage.setItem('pendingInvite', inviteCode);
			goto('/login');
			return;
		}

		isJoining = true;

		try {
			const community = await api.joinWithInvite(inviteCode);
			addCommunity(community);
			selectCommunity(community.id);
			hasJoined = true;
			addToast({
				type: 'success',
				message: `Welcome to ${community.name}!`
			});

			// Redirect to the community after a short delay
			setTimeout(() => {
				goto('/app');
			}, 1500);
		} catch (err: any) {
			console.error('Failed to join community:', err);
			const errorMessage = err.error || err.message || 'Failed to join community';
			const lowerError = errorMessage.toLowerCase();

			if (lowerError.includes('already a member')) {
				addToast({
					type: 'info',
					message: 'You are already a member of this community'
				});
				goto('/app');
			} else if (lowerError.includes('expired') || lowerError.includes('invalid')) {
				joinError = 'This invite link has expired or is no longer valid';
			} else {
				joinError = errorMessage;
				addToast({
					type: 'error',
					message: errorMessage
				});
			}
		} finally {
			isJoining = false;
		}
	}

	function handleLogin() {
		if (inviteCode) sessionStorage.setItem('pendingInvite', inviteCode);
		goto('/login');
	}

	function handleRegister() {
		if (inviteCode) sessionStorage.setItem('pendingInvite', inviteCode);
		goto('/register');
	}
</script>

<svelte:head>
	{#if inviteInfo?.community}
		<title>Join {inviteInfo.community.name} | Zentra</title>
	{:else}
		<title>Community Invite | Zentra</title>
	{/if}
</svelte:head>

<div class="min-h-screen bg-background flex items-center justify-center p-4">
	<div class="w-full max-w-md">
		{#if isLoading}
			<div class="bg-surface rounded-2xl p-8 shadow-xl text-center">
				<Spinner size="lg" />
				<p class="text-text-muted mt-4">Loading invite...</p>
			</div>
		{:else if error}
			<div class="bg-surface rounded-2xl p-8 shadow-xl text-center">
				<div class="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-4">
					<AlertCircle size={32} class="text-error" />
				</div>
				<h1 class="text-xl font-bold text-text-primary mb-2">Invalid Invite</h1>
				<p class="text-text-muted mb-6">{error}</p>
				<Button onclick={() => goto('/')} variant="secondary">
					Go Home
				</Button>
			</div>
		{:else if hasJoined}
			<div class="bg-surface rounded-2xl p-8 shadow-xl text-center">
				<div class="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
					<CheckCircle size={32} class="text-success" />
				</div>
				<h1 class="text-xl font-bold text-text-primary mb-2">You're in!</h1>
				<p class="text-text-muted mb-4">
					Welcome to <strong class="text-text-primary">{inviteInfo?.community.name}</strong>
				</p>
				<p class="text-sm text-text-muted">Redirecting you to the app...</p>
			</div>
		{:else if inviteInfo}
			<div class="bg-surface rounded-2xl p-8 shadow-xl">
				<!-- Header -->
				<div class="text-center mb-6">
					<p class="text-sm text-text-muted mb-4">You've been invited to join</p>

					<!-- Community info -->
					<div class="flex flex-col items-center gap-4">
						{#if inviteInfo.community.iconUrl}
							<img
								src={inviteInfo.community.iconUrl}
								alt={inviteInfo.community.name}
								class="w-20 h-20 rounded-2xl object-cover shadow-lg"
							/>
						{:else}
							<div class="w-20 h-20 rounded-2xl bg-linear-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
								<span class="text-3xl font-bold text-white">
									{inviteInfo.community.name.charAt(0).toUpperCase()}
								</span>
							</div>
						{/if}

						<div>
							<h1 class="text-2xl font-bold text-text-primary">
								{inviteInfo.community.name}
							</h1>
							{#if inviteInfo.community.description}
								<p class="text-text-muted mt-1 text-sm max-w-xs mx-auto">
									{inviteInfo.community.description}
								</p>
							{/if}
						</div>
					</div>
				</div>

				<!-- Member count -->
				<div class="flex items-center justify-center gap-2 text-text-muted mb-6 py-3 border-y border-border">
					<Users size={18} />
					<span>{inviteInfo.community.memberCount.toLocaleString()} member{inviteInfo.community.memberCount !== 1 ? 's' : ''}</span>
				</div>

				{#if joinError}
					<div class="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg flex items-start gap-2 text-error text-sm">
						<AlertCircle size={16} class="mt-0.5 shrink-0" />
						<span>{joinError}</span>
					</div>
				{/if}

				<!-- Actions -->
				{#if $isAuthenticated}
					<Button onclick={handleJoin} disabled={isJoining} class="w-full" size="lg">
						{#if isJoining}
							<Spinner size="sm" />
							Joining...
						{:else}
							Accept Invite
						{/if}
					</Button>
				{:else}
					<div class="space-y-3">
						<Button onclick={handleLogin} class="w-full" size="lg">
							<LogIn size={18} />
							Log in to Join
						</Button>
						<div class="text-center">
							<span class="text-text-muted text-sm">Don't have an account? </span>
							<button onclick={handleRegister} class="text-primary hover:underline text-sm font-medium">
								Sign up
							</button>
						</div>
					</div>
				{/if}
			</div>

			<!-- Instance info -->
			{#if $activeInstance}
				<p class="text-center text-xs text-text-muted mt-4">
					Connected to <strong class="text-text-secondary">{$activeInstance.name}</strong>
				</p>
			{/if}
		{/if}
	</div>
</div>

<style>
	:global(body) {
		background: linear-gradient(135deg, var(--color-background) 0%, var(--color-surface) 100%);
	}
</style>
