<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui';
	import { Github, ArrowRight, MessageSquare, Lock, Users, Globe, Server } from '$lib/components/icons';
	import { isLoggedIn, instances } from '$lib/stores/instance';

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null;
	let particles: Array<{
		x: number;
		y: number;
		vx: number;
		vy: number;
		size: number;
	}> = [];
	let mouse = { x: 0, y: 0, radius: 100 };
	let animationId: number;

	const maxDistance = 140;
	const particleCount = typeof window !== 'undefined' && window.innerWidth < 768 ? 80 : 200;

	onMount(() => {
		if (!canvas) return;
		ctx = canvas.getContext('2d');
		if (!ctx) return;

		resize();
		createParticles();
		animate();

		window.addEventListener('resize', resize);
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseout', handleMouseOut);

		return () => {
			window.removeEventListener('resize', resize);
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseout', handleMouseOut);
			cancelAnimationFrame(animationId);
		};
	});

	function resize() {
		if (!canvas) return;
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}

	function createParticles() {
		particles = [];
		for (let i = 0; i < particleCount; i++) {
			particles.push({
				x: Math.random() * (canvas?.width || 1920),
				y: Math.random() * (canvas?.height || 1080),
				vx: (Math.random() - 0.5) * 0.5,
				vy: (Math.random() - 0.5) * 0.5,
				size: Math.random() * 2 + 1
			});
		}
	}

	function handleMouseMove(e: MouseEvent) {
		mouse.x = e.clientX;
		mouse.y = e.clientY;
	}

	function handleMouseOut() {
		mouse.x = 0;
		mouse.y = 0;
	}

	function updateParticles() {
		particles.forEach((particle) => {
			// Mouse push effect
			if (mouse.x && mouse.y) {
				const dx = particle.x - mouse.x;
				const dy = particle.y - mouse.y;
				const dist = Math.sqrt(dx * dx + dy * dy);

				if (dist < mouse.radius && dist > 0) {
					const force = ((mouse.radius - dist) / mouse.radius) * 0.03;
					const angle = Math.atan2(dy, dx);
					particle.vx += Math.cos(angle) * force;
					particle.vy += Math.sin(angle) * force;
				}
			}

			// Limit velocity
			const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
			if (speed > 3) {
				const factor = 3 / speed;
				particle.vx *= factor;
				particle.vy *= factor;
			}

			// Move particle
			particle.x += particle.vx;
			particle.y += particle.vy;

			// Bounce off walls
			if (particle.x < 0 || particle.x > (canvas?.width || 1920)) particle.vx *= -1;
			if (particle.y < 0 || particle.y > (canvas?.height || 1080)) particle.vy *= -1;

			// Clamp position
			particle.x = Math.max(0, Math.min(canvas?.width || 1920, particle.x));
			particle.y = Math.max(0, Math.min(canvas?.height || 1080, particle.y));
		});
	}

	function drawParticles() {
		if (!ctx) return;
		ctx.fillStyle = 'rgba(0, 255, 169, 0.8)';
		particles.forEach((particle) => {
			ctx!.beginPath();
			ctx!.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
			ctx!.fill();
		});
	}

	function drawConnections() {
		if (!ctx) return;
		ctx.lineWidth = 1;

		for (let i = 0; i < particles.length; i++) {
			for (let j = i + 1; j < particles.length; j++) {
				const dx = particles[i].x - particles[j].x;
				const dy = particles[i].y - particles[j].y;
				const distance = Math.sqrt(dx * dx + dy * dy);

				if (distance < maxDistance) {
					const opacity = ((maxDistance - distance) / maxDistance) * 0.3;
					ctx.strokeStyle = `rgba(0, 255, 169, ${opacity})`;
					ctx.beginPath();
					ctx.moveTo(particles[i].x, particles[i].y);
					ctx.lineTo(particles[j].x, particles[j].y);
					ctx.stroke();
				}
			}
		}
	}

	function animate() {
		if (!ctx || !canvas) return;
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		updateParticles();
		drawConnections();
		drawParticles();

		animationId = requestAnimationFrame(animate);
	}

	const features = [
		{
			icon: MessageSquare,
			title: 'Real-time Messaging',
			description: 'Instant communication with WebSocket-powered real-time updates'
		},
		{
			icon: Lock,
			title: 'End-to-End Encryption',
			description: 'Your private conversations stay private with robust encryption'
		},
		{
			icon: Users,
			title: 'Communities',
			description: 'Create and join communities with channels, roles, and permissions'
		},
		{
			icon: Server,
			title: 'Self-Hostable',
			description: 'Run your own instance with full control over your data'
		},
		{
			icon: Globe,
			title: 'Multi-Instance',
			description: 'Connect to multiple servers from a single app interface'
		}
	];
</script>

<svelte:head>
	<title>Zentra - Encrypted Community Chat</title>
	<meta name="description" content="Open-source, encrypted, community-hostable chat platform" />
</svelte:head>

<div class="min-h-screen bg-background relative overflow-hidden">
	<canvas bind:this={canvas} class="absolute inset-0 z-0"></canvas>

	<!-- Navigation -->
	<nav class="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
		<h1 class="text-2xl font-bold text-gradient">Zentra</h1>
		<div class="flex items-center gap-4">
			<a
				href="https://github.com/zentra-chat"
				target="_blank"
				rel="noopener noreferrer"
				class="p-2 text-text-secondary hover:text-text-primary transition-colors"
				aria-label="GitHub"
			>
				<Github size={24} />
			</a>
			{#if $isLoggedIn}
				<Button onclick={() => window.location.href = '/app'}>
					Open App
					<ArrowRight size={18} />
				</Button>
			{:else}
				<a href="/login">
					<Button variant="secondary">Login</Button>
				</a>
				<a href="/register">
					<Button>
						Get Started
						<ArrowRight size={18} />
					</Button>
				</a>
			{/if}
		</div>
	</nav>

	<!-- Hero -->
	<main class="relative z-10 flex flex-col items-center justify-center text-center px-6 py-48">
		<h2 class="text-5xl md:text-7xl font-bold text-gradient glow-text mb-4">Zentra</h2>
		<p class="text-xl md:text-2xl text-text-secondary mb-8 max-w-2xl">
			Open-source, encrypted, community-hostable chat platform.
			<br class="hidden md:block" />
			Your conversations, your control.
		</p>

		<div class="flex flex-col sm:flex-row gap-4">
			{#if $isLoggedIn}
				<a href="/app">
					<Button size="lg" class="glow-primary">
						Open App
						<ArrowRight size={20} />
					</Button>
				</a>
			{:else if $instances.length > 0}
				<a href="/login">
					<Button size="lg" class="glow-primary">
						Continue to Login
						<ArrowRight size={20} />
					</Button>
				</a>
			{:else}
				<a href="/register">
					<Button size="lg" class="glow-primary">
						Get Started
						<ArrowRight size={20} />
					</Button>
				</a>
			{/if}
			<a
				href="https://github.com/zentra-chat"
				target="_blank"
				rel="noopener noreferrer"
			>
				<Button variant="secondary" size="lg">
					<Github size={20} />
					View on GitHub
				</Button>
			</a>
		</div>

		<!-- Features -->
		<!-- <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl">
			{#each features as feature}
				<div class="p-6 bg-surface/50 backdrop-blur-sm border border-border rounded-xl hover:border-primary/30 transition-colors">
					<div class="w-12 h-12 mb-4 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
						<feature.icon size={24} />
					</div>
					<h3 class="text-lg font-semibold text-text-primary mb-2">{feature.title}</h3>
					<p class="text-text-secondary">{feature.description}</p>
				</div>
			{/each}
		</div> -->
	</main>
</div>
