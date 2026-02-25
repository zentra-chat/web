<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button, Input } from '$lib/components/ui';
	import { Mail, Lock, ArrowLeft, Server } from 'lucide-svelte';
	import { api } from '$lib/api';
	import { activeInstance, setInstanceAuth, isLoggedIn, instanceAuth } from '$lib/stores/instance';
	import { showToast } from '$lib/stores/ui';
	import { hasPortableProfile } from '$lib/stores/profile';
	import { InstanceModal } from '$lib/components/instance';
	import { onMount } from 'svelte';

	let login = $state('');
	let password = $state('');
	let totpCode = $state('');
	let isLoading = $state(false);
	let requires2FA = $state(false);
	let error = $state('');
	let showInstanceModal = $state(false);
	let pendingInvite = $state<string | null>(null);
	let isAddAccountMode = $derived($page.url.searchParams.get('addAccount') === '1');
	let attemptedPortableAuth = false;

	onMount(() => {
		// Check for pending invite
		pendingInvite = sessionStorage.getItem('pendingInvite');

		// Check if already logged in
		if ($isLoggedIn && $activeInstance && !isAddAccountMode) {
			handleRedirectAfterLogin();
		}
		// If no instance selected, show modal
		if (!$activeInstance) {
			showInstanceModal = true;
		}

		attemptPortableAuth();
	});

	function canTryPortableAuth(): boolean {
		return Boolean($activeInstance && !attemptedPortableAuth && !isAddAccountMode && hasPortableProfile());
	}

	async function attemptPortableAuth() {
		if (!canTryPortableAuth()) return;

		attemptedPortableAuth = true;
		isLoading = true;
		error = '';

		try {
			const response = await api.portableAuth();

			setInstanceAuth($activeInstance!.id, {
				instanceId: $activeInstance!.id,
				accessToken: response.accessToken,
				refreshToken: response.refreshToken,
				expiresAt: response.expiresAt,
				user: response.user
			});

			showToast('success', `Signed in as ${response.user.displayName || response.user.username}`);
			handleRedirectAfterLogin();
		} catch {
			// No-op; user can continue with normal login.
		} finally {
			isLoading = false;
		}
	}

	function handleRedirectAfterLogin() {
		if (pendingInvite) {
			sessionStorage.removeItem('pendingInvite');
			goto(`/invite/${pendingInvite}`);
		} else {
			goto('/app');
		}
	}

	async function handleLogin() {
		if (!$activeInstance) {
			showInstanceModal = true;
			return;
		}

		if (!login.trim() || !password.trim()) {
			error = 'Please enter your username/email and password';
			return;
		}

		if (requires2FA && !totpCode.trim()) {
			error = 'Please enter your 2FA code';
			return;
		}

		isLoading = true;
		error = '';

		try {
			const response = await api.login({
				login: login.trim(),
				password,
				totpCode: totpCode || undefined
			});

			if (response.requires2FA && !totpCode) {
				requires2FA = true;
				isLoading = false;
				return;
			}

			setInstanceAuth($activeInstance.id, {
				instanceId: $activeInstance.id,
				accessToken: response.accessToken,
				refreshToken: response.refreshToken,
				expiresAt: response.expiresAt,
				user: response.user
			});

			showToast('success', `Welcome back, ${response.user.displayName || response.user.username}!`);
			handleRedirectAfterLogin();
		} catch (err) {
			const apiError = err as { error?: string; code?: string };
			error = apiError.error || 'Failed to login. Please check your credentials.';
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Login - Zentra</title>
</svelte:head>

<div class="min-h-screen bg-background flex items-center justify-center p-4">
	<div class="w-full max-w-md">
		<div class="text-center mb-8">
			<a href="/" class="inline-block">
				<h1 class="text-4xl font-bold text-gradient glow-text">Zentra</h1>
			</a>
			<p class="text-text-secondary mt-2">{isAddAccountMode ? 'Add another account' : 'Welcome back'}</p>
		</div>

		{#if isAddAccountMode}
			<div class="mb-4 p-3 bg-surface border border-border rounded-lg">
				<p class="text-sm text-text-secondary text-center">
					Sign in with another account on this instance to enable quick switching.
				</p>
			</div>
		{/if}

		{#if pendingInvite}
			<div class="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
				<p class="text-sm text-primary text-center">
					Log in to accept your community invite
				</p>
			</div>
		{/if}

		{#if $activeInstance}
			<div class="mb-6 p-3 bg-surface rounded-lg border border-border flex items-center gap-3">
				<div class="w-8 h-8 rounded bg-background flex items-center justify-center text-primary">
					<Server size={16} />
				</div>
				<div class="flex-1 min-w-0">
					<p class="text-sm font-medium text-text-primary truncate">{$activeInstance.name}</p>
					<p class="text-xs text-text-muted truncate">{$activeInstance.url}</p>
				</div>
				<Button variant="ghost" size="sm" onclick={() => (showInstanceModal = true)}>Change</Button>
			</div>
		{/if}

		<div class="bg-surface border border-border rounded-xl p-6 shadow-xl">
			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleLogin();
				}}
				class="space-y-4"
			>
				{#if !requires2FA}
					<Input
						type="text"
						label="Username or Email"
						bind:value={login}
						placeholder="Enter your username or email"
						autocomplete="username"
						required
					/>

					<Input
						type="password"
						label="Password"
						bind:value={password}
						placeholder="Enter your password"
						autocomplete="current-password"
						required
					/>
				{:else}
					<div class="text-center mb-4">
						<Lock size={32} class="mx-auto mb-2 text-primary" />
						<p class="text-text-secondary">Enter the code from your authenticator app</p>
					</div>
					<Input
						type="text"
						label="2FA Code"
						bind:value={totpCode}
						placeholder="000000"
						autocomplete="one-time-code"
						required
					/>
				{/if}

				{#if error}
					<p class="text-sm text-danger text-center">{error}</p>
				{/if}

				<Button type="submit" class="w-full" loading={isLoading}>
					{requires2FA ? 'Verify' : 'Login'}
				</Button>

				{#if requires2FA}
					<Button variant="ghost" class="w-full" onclick={() => (requires2FA = false)}>
						<ArrowLeft size={16} />
						Back to login
					</Button>
				{/if}
			</form>

			{#if !requires2FA}
				<div class="mt-6 pt-6 border-t border-border text-center">
					<p class="text-text-secondary">
						Don't have an account?
						<a href="/register" class="text-primary hover:underline">Register</a>
					</p>
				</div>
			{/if}
		</div>

		<p class="text-center mt-4 text-xs text-text-muted">
			By continuing, you agree to the
			<a href="/terms" class="text-primary hover:underline">Terms of Service</a>
			and
			<a href="/privacy" class="text-primary hover:underline">Privacy Policy</a>.
		</p>

		<p class="text-center mt-6 text-sm text-text-muted">
			<a href="/" class="hover:text-text-secondary">Back to home!</a>
		</p>
	</div>
</div>

<InstanceModal isOpen={showInstanceModal} onclose={() => (showInstanceModal = false)} />
