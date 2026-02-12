<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button, Input } from '$lib/components/ui';
	import { Server } from 'lucide-svelte';
	import { api } from '$lib/api';
	import { activeInstance, setInstanceAuth, isLoggedIn } from '$lib/stores/instance';
	import { showToast } from '$lib/stores/ui';
	import { InstanceModal } from '$lib/components/instance';
	import { onMount } from 'svelte';

	let username = $state('');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let acceptTerms = $state(false);
	let isLoading = $state(false);
	let errors = $state<Record<string, string>>({});
	let showInstanceModal = $state(false);
	let pendingInvite = $state<string | null>(null);

	onMount(() => {
		// Check for pending invite
		pendingInvite = sessionStorage.getItem('pendingInvite');

		// Check if already logged in
		if ($isLoggedIn && $activeInstance) {
			handleRedirectAfterRegister();
		}
		// If no instance selected, show modal
		if (!$activeInstance) {
			showInstanceModal = true;
		}
	});

	function handleRedirectAfterRegister() {
		if (pendingInvite) {
			sessionStorage.removeItem('pendingInvite');
			goto(`/invite/${pendingInvite}`);
		} else {
			goto('/app');
		}
	}

	function validateForm(): boolean {
		errors = {};

		if (!username.trim()) {
			errors.username = 'Username is required';
		} else if (username.length < 3) {
			errors.username = 'Username must be at least 3 characters';
		} else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
			errors.username = 'Username can only contain letters, numbers, and underscores';
		}

		if (!email.trim()) {
			errors.email = 'Email is required';
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			errors.email = 'Please enter a valid email';
		}

		if (!password) {
			errors.password = 'Password is required';
		} else if (password.length < 8) {
			errors.password = 'Password must be at least 8 characters';
		}

		if (password !== confirmPassword) {
			errors.confirmPassword = 'Passwords do not match';
		}

		if (!acceptTerms) {
			errors.acceptTerms = 'You must accept the Terms and Privacy Policy';
		}

		return Object.keys(errors).length === 0;
	}

	async function handleRegister() {
		if (!$activeInstance) {
			showInstanceModal = true;
			return;
		}

		if (!validateForm()) return;

		isLoading = true;

		try {
			const response = await api.register({
				username: username.trim(),
				email: email.trim(),
				password
			});

			setInstanceAuth($activeInstance.id, {
				instanceId: $activeInstance.id,
				accessToken: response.accessToken,
				refreshToken: response.refreshToken,
				expiresAt: response.expiresAt,
				user: response.user
			});

			showToast('success', 'Account created successfully! Welcome to Zentra.');
			handleRedirectAfterRegister();
		} catch (err) {
			const apiError = err as { error?: string; code?: string; details?: Record<string, string[]> };
			if (apiError.details) {
				for (const [field, messages] of Object.entries(apiError.details)) {
					errors[field] = messages[0];
				}
			} else {
				showToast('error', apiError.error || 'Failed to create account. Please try again.');
			}
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Register - Zentra</title>
</svelte:head>

<div class="min-h-screen bg-background flex items-center justify-center p-4">
	<div class="w-full max-w-md">
		<div class="text-center mb-8">
			<a href="/" class="inline-block">
				<h1 class="text-4xl font-bold text-gradient glow-text">Zentra</h1>
			</a>
			<p class="text-text-secondary mt-2">Create your account</p>
		</div>

		{#if pendingInvite}
			<div class="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
				<p class="text-sm text-primary text-center">
					Create an account to accept your community invite
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
					handleRegister();
				}}
				class="space-y-4"
			>
				<Input
					type="text"
					label="Username"
					bind:value={username}
					placeholder="Choose a username"
					autocomplete="username"
					error={errors.username}
					required
				/>

				<Input
					type="email"
					label="Email"
					bind:value={email}
					placeholder="Enter your email"
					autocomplete="email"
					error={errors.email}
					required
				/>

				<Input
					type="password"
					label="Password"
					bind:value={password}
					placeholder="Create a password"
					autocomplete="new-password"
					error={errors.password}
					required
				/>

				<Input
					type="password"
					label="Confirm Password"
					bind:value={confirmPassword}
					placeholder="Confirm your password"
					autocomplete="new-password"
					error={errors.confirmPassword}
					required
				/>

				<label class="flex items-start gap-3 text-sm text-text-secondary cursor-pointer select-none group">
					<input
						type="checkbox"
						bind:checked={acceptTerms}
						required
						class="mt-1 h-4 w-4 rounded border-border bg-background accent-primary cursor-pointer transition-colors"
					/>
					<span class="group-hover:text-text-primary transition-colors">
						By creating an account, you agree to the
						<a href="/terms" class="text-primary hover:underline" onclick={(e) => e.stopPropagation()}>Terms of Service</a>
						and
						<a href="/privacy" class="text-primary hover:underline" onclick={(e) => e.stopPropagation()}>Privacy Policy</a>.
					</span>
				</label>
				{#if errors.acceptTerms}
					<p class="text-xs text-error">{errors.acceptTerms}</p>
				{/if}

				<Button type="submit" class="w-full" loading={isLoading}>Create Account</Button>
			</form>

			<div class="mt-6 pt-6 border-t border-border text-center">
				<p class="text-text-secondary">
					Already have an account?
					<a href="/login" class="text-primary hover:underline">Login</a>
				</p>
			</div>
		</div>

		<p class="text-center mt-6 text-sm text-text-muted">
			<a href="/" class="hover:text-text-secondary">Back to home</a>
		</p>
	</div>
</div>

<InstanceModal isOpen={showInstanceModal} onclose={() => (showInstanceModal = false)} />
