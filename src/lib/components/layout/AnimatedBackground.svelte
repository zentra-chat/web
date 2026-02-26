<script lang="ts">
	import { onMount } from 'svelte';

	let {
		particleCountMobile = 80,
		particleCountDesktop = 250,
		className = ''
	}: {
		particleCountMobile?: number;
		particleCountDesktop?: number;
		className?: string;
	} = $props();

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null = null;
	let particles: Array<{
		x: number;
		y: number;
		vx: number;
		vy: number;
		size: number;
	}> = [];
	let mouse = { x: 0, y: 0, radius: 100 };
	let animationId: number;

	const maxDistance = 150;

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
		const count = window.innerWidth < 768 ? particleCountMobile : particleCountDesktop;
		particles = [];
		for (let i = 0; i < count; i++) {
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

			const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
			if (speed > 3) {
				const factor = 3 / speed;
				particle.vx *= factor;
				particle.vy *= factor;
			}

			particle.x += particle.vx;
			particle.y += particle.vy;

			if (particle.x < 0 || particle.x > (canvas?.width || 1920)) particle.vx *= -1;
			if (particle.y < 0 || particle.y > (canvas?.height || 1080)) particle.vy *= -1;

			particle.x = Math.max(0, Math.min(canvas?.width || 1920, particle.x));
			particle.y = Math.max(0, Math.min(canvas?.height || 1080, particle.y));
		});
	}

	function drawParticles() {
		if (!ctx) return;
		const context = ctx;
		context.fillStyle = 'rgba(0, 255, 169, 0.8)';
		particles.forEach((particle) => {
			context.beginPath();
			context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
			context.fill();
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
</script>

<canvas bind:this={canvas} class={`absolute inset-0 z-0 ${className}`}></canvas>