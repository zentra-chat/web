<script lang="ts">
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui';
	import AnimatedBackground from '$lib/components/layout/AnimatedBackground.svelte';
	import { Home, ArrowLeft } from 'lucide-svelte';

	let status = $derived($page.error?.status ?? 404);
	// let message = $derived<string>(
	// 	$page.error?.message ?? ($page.error?.status === 404 ? "This page doesn't exist." : 'Something went wrong.')
	// );

	let subtitle = $derived(status === 404 ? "Looks like you've wandered into the void." : 'Something went wrong.');

	function goBack() {
		if (history.length > 1) {
			history.back();
		} else {
			goto(resolve('/'));
		}
	}
</script>

<div class="relative min-h-screen bg-background flex items-center justify-center p-6 overflow-hidden">
	<AnimatedBackground particleCountDesktop={300} particleCountMobile={80} />
	<div class="absolute inset-0 bg-background/70 z-0"></div>

	<div class="relative z-10 w-full max-w-xl text-center">
		<div class="mb-8">
			<span class="text-[8rem] md:text-[10rem] font-black text-gradient glow-text select-none leading-none tracking-tighter">{status}</span>
		</div>

		<h1 class="text-4xl md:text-2xl font-bold text-text-primary mb-12">{subtitle}</h1>
		<!-- <p class="text-text-secondary text-xl mb-10 max-w-lg mx-auto">{message}</p> -->

		<div class="flex flex-col sm:flex-row gap-4 justify-center">
			<Button size="lg" onclick={goBack}>
				<ArrowLeft size={20} />
				Go back
			</Button>
			<a href={resolve('/')}>
				<Button variant="secondary" size="lg">
					<Home size={20} />
					Go home
				</Button>
			</a>
		</div>
	</div>
</div>
