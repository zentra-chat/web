<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import {
		Chart,
		BarController,
		BarElement,
		LinearScale,
		CategoryScale,
		Tooltip
	} from 'chart.js';

	Chart.register(BarController, BarElement, LinearScale, CategoryScale, Tooltip);

	interface BarItem {
		label: string;
		value: number;
	}

	interface Props {
		data: BarItem[];
		title: string;
		color?: string;
		height?: number;
	}

	let {
		data = [],
		title,
		color = 'var(--color-primary)',
		height = 220
	}: Props = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	function resolveColor(c: string): string {
		if (c.startsWith('var(')) {
			const name = c.slice(4, -1).trim();
			return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#00ffa9';
		}
		return c;
	}

	function hexToRgb(hex: string) {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result
			? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
			: '0, 255, 169';
	}

	function buildChart() {
		if (!canvas) return;
		if (chart) {
			chart.destroy();
			chart = null;
		}

		const safeData = data ?? [];
		if (safeData.length < 2) return;

		const resolvedColor = resolveColor(color);
		const rgb = hexToRgb(resolvedColor);

		chart = new Chart(canvas, {
			type: 'bar',
			data: {
				labels: safeData.map((d) => d.label),
				datasets: [
					{
						label: title,
						data: safeData.map((d) => d.value),
						backgroundColor: (ctx) => {
							if (!ctx.chart.chartArea) return resolvedColor;
							const gradient = ctx.chart.ctx.createLinearGradient(
								0,
								ctx.chart.chartArea.top,
								0,
								ctx.chart.chartArea.bottom
							);
							gradient.addColorStop(0, `rgba(${rgb}, 0.85)`);
							gradient.addColorStop(1, `rgba(${rgb}, 0.35)`);
							return gradient;
						},
						borderRadius: 4,
						borderSkipped: false
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: {
					duration: 800,
					easing: 'easeOutQuart'
				},
				interaction: {
					intersect: false,
					mode: 'index'
				},
				plugins: {
					legend: {
						display: false
					},
					tooltip: {
						backgroundColor: 'rgba(19, 26, 42, 0.95)',
						titleColor: '#f1f5f9',
						bodyColor: '#94a3b8',
						borderColor: 'rgba(30, 58, 95, 0.8)',
						borderWidth: 1,
						padding: 12,
						cornerRadius: 8,
						displayColors: false,
						callbacks: {
							title: (items) => {
								const i = items[0].dataIndex;
								return safeData[i]?.label ?? '';
							},
							label: (item) => `${item.parsed.y} ${title.toLowerCase()}`
						}
					}
				},
				scales: {
					x: {
						grid: {
							display: false
						},
						ticks: {
							color: '#64748b',
							font: { size: 11, family: 'Inter, sans-serif' },
							maxRotation: 45
						},
						border: {
							display: false
						}
					},
					y: {
						beginAtZero: true,
						grid: {
							color: 'rgba(30, 58, 95, 0.3)',
							drawBorder: false
						},
						ticks: {
							color: '#64748b',
							font: { size: 11, family: 'Inter, sans-serif' },
							padding: 8,
							maxTicksLimit: 6,
							callback: (val) => {
								if (typeof val === 'number' && val >= 1000) {
									return (val / 1000).toFixed(1) + 'k';
								}
								return val;
							}
						},
						border: {
							display: false
						}
					}
				}
			}
		});
	}

	$effect(() => {
		data;
		tick().then(() => buildChart());
	});

	onDestroy(() => {
		if (chart) {
			chart.destroy();
			chart = null;
		}
	});
</script>

<div class="bg-surface border border-border rounded-xl p-6">
	<div class="flex items-center gap-2 mb-4">
		<span class="w-2.5 h-2.5 rounded-full" style="background: {resolveColor(color)}"></span>
		<h3 class="text-sm font-semibold text-text-primary">{title}</h3>
	</div>

	<div class="relative" style="height: {height}px">
		{#if (data ?? []).length > 1}
			<canvas bind:this={canvas} />
		{:else}
			<div class="flex items-center justify-center h-full text-text-muted text-sm">
				No data available
			</div>
		{/if}
	</div>
</div>
