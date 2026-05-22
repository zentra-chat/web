<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { Button, Input } from '$lib/components/ui';
	import { Lock, ArrowLeft, Server } from 'lucide-svelte';
	import { api } from '$lib/api';
	import {
		activeInstance,
		setInstanceAuth,
		isLoggedIn
	} from '$lib/stores/instance';
	import { showToast } from '$lib/stores/ui';
	import { InstanceModal } from '$lib/components/instance';
	import SEOMeta from '$lib/components/seo/SEOMeta.svelte';
import AnimatedBackground from '$lib/components/layout/AnimatedBackground.svelte';
	import { getErrorMessage, normalizeApiError } from '$lib/utils/apiError';
	import { onMount } from 'svelte';

	let login = $state('');
	let password = $state('');
	let totpCode = $state('');
	let isLoading = $state(false);
	let requires2FA = $state(false);
	let error = $state('');
	let errorCode = $state('');
	let showInstanceModal = $state(false);
	let pendingInvite = $state<string | null>(null);
	let isAddAccountMode = $derived($page.url.searchParams.get('addAccount') === '1');

	onMount(() => {
		const authNotice = sessionStorage.getItem('zentra_auth_notice');
		if (authNotice === 'expired') {
			error = 'Your session expired. Please sign in again.';
			sessionStorage.removeItem('zentra_auth_notice');
		}

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
	});

	function handleRedirectAfterLogin() {
		if (pendingInvite) {
			sessionStorage.removeItem('pendingInvite');
			goto(resolve(`/invite/${pendingInvite}`));
		} else {
			goto(resolve('/app'));
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
			const normalizedError = normalizeApiError(err, 'Failed to login. Please check your credentials.');
			errorCode = normalizedError.code || '';
			error = getErrorMessage(err, 'Failed to login. Please check your credentials.');
		} finally {
			isLoading = false;
		}
	}
</script>

<SEOMeta title="Login - Zentra" description="Sign in to your Zentra account." url="/login" />

<div class="relative min-h-screen bg-background flex items-center justify-center p-4 overflow-hidden">
	<AnimatedBackground particleCountDesktop={220} particleCountMobile={70} />
	<div class="absolute inset-0 bg-background/80 z-0"></div>

	<div class="relative z-10 w-full max-w-md">
		<div class="text-center mb-8">
			<a href={resolve("/")} class="inline-block">
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
					<div class="space-y-2 text-center">
						<p class="text-sm text-danger">{error}</p>
						{#if errorCode === 'EMAIL_NOT_VERIFIED'}
							<a
								href={resolve(`/verify-email?email=${encodeURIComponent(login.trim())}`)}
								class="text-xs text-primary hover:underline"
							>
								Verify email and resend link
							</a>
						{/if}
					</div>
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
						<a href={resolve("/register")} class="text-primary hover:underline">Register</a>
					</p>
				</div>
			{/if}
		</div>

		<p class="text-center mt-4 text-xs text-text-muted">
			By continuing, you agree to the
			<a href={resolve("/terms")} class="text-primary hover:underline">Terms of Service</a>
			and
			<a href={resolve("/privacy")} class="text-primary hover:underline">Privacy Policy</a>.
		</p>

		<p class="text-center mt-6 text-sm text-text-muted">
			<a href={resolve("/")} class="hover:text-text-secondary">Back to home</a>
		</p>
	</div>
</div>

<InstanceModal isOpen={showInstanceModal} onclose={() => (showInstanceModal = false)} />
