<script lang="ts">
	import { goto } from '$app/navigation';
	import { env } from '$env/dynamic/public';
	import { Button, Input } from '$lib/components/ui';
	import { Server } from 'lucide-svelte';
	import { api } from '$lib/api';
	import {
		activeInstance,
		setInstanceAuth,
		isLoggedIn,
		shouldSkipAutoPortableAuth,
		clearSkipAutoPortableAuth
	} from '$lib/stores/instance';
	import { showToast } from '$lib/stores/ui';
	import { hasPortableProfile } from '$lib/stores/profile';
	import { InstanceModal } from '$lib/components/instance';
	import AnimatedBackground from '$lib/components/layout/AnimatedBackground.svelte';
	import { getErrorMessage, getFieldErrors, normalizeApiError } from '$lib/utils/apiError';
	import { onDestroy, onMount } from 'svelte';

	let username = $state('');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let captchaToken = $state('');
	let captchaLoading = $state(false);
	let acceptTerms = $state(false);
	let isLoading = $state(false);
	let errors = $state<Record<string, string>>({});
	let formError = $state('');
	let showInstanceModal = $state(false);
	let pendingInvite = $state<string | null>(null);
	let captchaContainer = $state<HTMLDivElement | null>(null);
	let captchaWidgetId = $state<string | null>(null);
	let attemptedPortableAuth = false;
	let skipAutoPortableAuth = false;

	const turnstileSiteKey = (env.PUBLIC_TURNSTILE_SITE_KEY ?? '').trim();

	onMount(() => {
		skipAutoPortableAuth = shouldSkipAutoPortableAuth();

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

		loadCaptchaWidget();
		attemptPortableAuth();
	});

	onDestroy(() => {
		if (typeof window === 'undefined') return;
		if (!window.turnstile || captchaWidgetId === null) return;

		window.turnstile.remove?.(captchaWidgetId);
		captchaWidgetId = null;
	});

	function canTryPortableAuth(): boolean {
		return Boolean(
			$activeInstance && !attemptedPortableAuth && !skipAutoPortableAuth && hasPortableProfile()
		);
	}

	async function attemptPortableAuth() {
		if (!canTryPortableAuth()) return;

		attemptedPortableAuth = true;
		isLoading = true;

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
			handleRedirectAfterRegister();
		} catch {
			// Fall through to normal register flow.
		} finally {
			isLoading = false;
		}
	}

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
		formError = '';

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

		if (turnstileSiteKey && !captchaToken) {
			errors.captchatoken = 'Please complete the captcha challenge';
		}

		return Object.keys(errors).length === 0;
	}

	function loadCaptchaWidget() {
		if (!turnstileSiteKey || typeof window === 'undefined') {
			return;
		}

		if (window.turnstile) {
			renderCaptchaWidget();
			return;
		}

		const existingScript = document.querySelector<HTMLScriptElement>('script[data-turnstile-script="1"]');
		if (existingScript) {
			existingScript.addEventListener(
				'load',
				() => {
					captchaLoading = false;
					renderCaptchaWidget();
				},
				{ once: true }
			);
			return;
		}

		captchaLoading = true;
		const script = document.createElement('script');
		script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
		script.async = true;
		script.defer = true;
		script.setAttribute('data-turnstile-script', '1');
		script.onload = () => {
			captchaLoading = false;
			renderCaptchaWidget();
		};
		script.onerror = () => {
			captchaLoading = false;
			errors.captchatoken = 'Captcha failed to load. Refresh and try again.';
		};
		document.head.appendChild(script);
	}

	function renderCaptchaWidget() {
		if (!turnstileSiteKey || !captchaContainer || !window.turnstile || captchaWidgetId !== null) {
			return;
		}

		captchaWidgetId = window.turnstile.render(captchaContainer, {
			sitekey: turnstileSiteKey,
			callback: (token: string) => {
				captchaToken = token;
				delete errors.captchatoken;
			},
			'expired-callback': () => {
				captchaToken = '';
			},
			'error-callback': (errorCode?: string) => {
				captchaToken = '';
				if (errorCode === '110200') {
					errors.captchatoken = 'Turnstile site key is invalid for this domain. For local dev, use Cloudflare test keys or allow localhost in Turnstile settings.';
					return;
				}

				errors.captchatoken = 'Captcha verification failed. Please try again.';
			}
		});
	}

	function resetCaptchaWidget() {
		captchaToken = '';
		if (!window.turnstile || captchaWidgetId === null) {
			return;
		}

		window.turnstile.reset(captchaWidgetId);
	}

	async function handleRegister() {
		if (!$activeInstance) {
			showInstanceModal = true;
			return;
		}

		if (!validateForm()) return;

		isLoading = true;
		formError = '';

		try {
			const response = await api.register({
				username: username.trim(),
				email: email.trim(),
				password,
				captchaToken: captchaToken || undefined
			});
			clearSkipAutoPortableAuth();
			resetCaptchaWidget();

			if (response.verificationSent) {
				showToast('success', response.message || 'Account created. Check your inbox to verify your email.');
			} else {
				showToast('warning', response.message || 'Account created but verification email could not be sent.');
			}

			if (!response.requiresEmailVerification) {
				goto('/login');
				return;
			}

			const targetEmail = response.email || email.trim();
			goto(`/verify-email?email=${encodeURIComponent(targetEmail)}`);
		} catch (err) {
			const normalizedError = normalizeApiError(err, 'Failed to create account. Please try again.');
			const fieldErrors = getFieldErrors(err);
			const knownFieldKeys = new Set([
				'username',
				'email',
				'password',
				'confirmPassword',
				'acceptTerms',
				'captchatoken',
				'captchaToken'
			]);

			errors = {};
			for (const [field, message] of Object.entries(fieldErrors)) {
				if (knownFieldKeys.has(field)) {
					errors[field] = message;
				}
			}

			if (normalizedError.code === 'CAPTCHA_REQUIRED' || normalizedError.code === 'CAPTCHA_INVALID') {
				errors.captchatoken = normalizedError.error || 'Please complete the captcha challenge';
				resetCaptchaWidget();
				return;
			}

			if (Object.keys(errors).length === 0) {
				formError = getErrorMessage(err, 'Failed to create account. Please try again.');
				showToast('error', formError);
			}
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Register - Zentra</title>
</svelte:head>

<div class="relative min-h-screen bg-background flex items-center justify-center p-4 overflow-hidden">
	<AnimatedBackground particleCountDesktop={220} particleCountMobile={70} />
	<div class="absolute inset-0 bg-background/80 z-0"></div>

	<div class="relative z-10 w-full max-w-md">
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

				{#if turnstileSiteKey}
					<div class="space-y-2">
						<p class="text-xs text-text-muted">Security Check</p>
						<div class="min-h-[78px] rounded-lg border border-border bg-background p-3 flex items-center justify-center">
							<div bind:this={captchaContainer}></div>
							{#if captchaLoading}
								<p class="text-xs text-text-muted">Loading captcha...</p>
							{/if}
						</div>
						{#if errors.captchatoken}
							<p class="text-xs text-error">{errors.captchatoken}</p>
						{/if}
					</div>
				{/if}

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

				{#if formError}
					<p class="text-sm text-danger text-center">{formError}</p>
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
