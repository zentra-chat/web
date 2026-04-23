<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { MailCheck, RefreshCcw } from 'lucide-svelte';
	import { Button, Input } from '$lib/components/ui';
	import { api } from '$lib/api';
	import { showToast } from '$lib/stores/ui';
	import AnimatedBackground from '$lib/components/layout/AnimatedBackground.svelte';
	import { getErrorMessage } from '$lib/utils/apiError';

	let email = $state('');
	let isVerifying = $state(false);
	let isVerified = $state(false);
	let isResending = $state(false);
	let statusMessage = $state('Check your inbox for a verification link.');
	let errorMessage = $state('');

	onMount(() => {
		const token = ($page.url.searchParams.get('token') ?? '').trim();
		email = ($page.url.searchParams.get('email') ?? '').trim();

		if (email) {
			statusMessage = `A verification link was sent to ${email}.`;
		}

		if (token) {
			void verifyToken(token);
		}
	});

	async function verifyToken(token: string) {
		isVerifying = true;
		errorMessage = '';
		statusMessage = 'Verifying your email...';

		try {
			const response = await api.verifyEmail(token);
			isVerified = true;
			statusMessage = response.message || 'Email verified successfully.';
			showToast('success', 'Email verified. You can now sign in.');
		} catch (err) {
			errorMessage = getErrorMessage(err, 'Verification link is invalid or expired.');
			statusMessage = 'Verification failed.';
		} finally {
			isVerifying = false;
		}
	}

	async function resendVerification() {
		if (!email.trim()) {
			errorMessage = 'Enter your email to resend verification.';
			return;
		}

		isResending = true;
		errorMessage = '';

		try {
			const response = await api.resendVerificationEmail(email.trim());
			statusMessage = response.message || 'Verification email sent.';
			showToast('success', 'If an account exists, a verification email has been sent.');
		} catch (err) {
			errorMessage = getErrorMessage(err, 'Unable to resend verification right now.');
		} finally {
			isResending = false;
		}
	}
</script>

<svelte:head>
	<title>Verify Email - Zentra</title>
</svelte:head>

<div class="relative min-h-screen bg-background flex items-center justify-center p-4 overflow-hidden">
	<AnimatedBackground particleCountDesktop={220} particleCountMobile={70} />
	<div class="absolute inset-0 bg-background/80 z-0"></div>

	<div class="relative z-10 w-full max-w-md">
		<div class="text-center mb-8">
			<a href="/" class="inline-block">
				<h1 class="text-4xl font-bold text-gradient glow-text">Zentra</h1>
			</a>
			<p class="text-text-secondary mt-2">Verify your email address</p>
		</div>

		<div class="bg-surface border border-border rounded-xl p-6 shadow-xl space-y-4">
			<div class="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary">
				<MailCheck size={18} />
				<p class="text-sm">{statusMessage}</p>
			</div>

			{#if errorMessage}
				<p class="text-sm text-danger">{errorMessage}</p>
			{/if}

			{#if isVerifying}
				<Button class="w-full" loading={true}>Verifying...</Button>
			{:else if isVerified}
				<Button class="w-full" onclick={() => goto('/login')}>Continue to Login</Button>
			{:else}
				<div class="space-y-3">
					<Input
						type="email"
						label="Email"
						bind:value={email}
						placeholder="Enter your email"
						autocomplete="email"
					/>
					<Button class="w-full" onclick={resendVerification} loading={isResending}>
						<RefreshCcw size={16} />
						Resend Verification Email
					</Button>
					<Button class="w-full" variant="ghost" onclick={() => goto('/login')}>Back to Login</Button>
				</div>
			{/if}
		</div>
	</div>
</div>
