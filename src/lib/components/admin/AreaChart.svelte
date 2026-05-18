<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import {
		Chart,
		LineController,
		LineElement,
		PointElement,
		LinearScale,
		TimeScale,
		CategoryScale,
		Filler,
		Tooltip
	} from 'chart.js';
	import type { DataPoint } from '$lib/types';

	Chart.register(
		LineController,
		LineElement,
		PointElement,
		LinearScale,
		CategoryScale,
		TimeScale,
		Filler,
		Tooltip
	);

	interface Props {
		data: DataPoint[];
		title: string;
		color?: string;
		height?: number;
	}

	let {
		data = [],
		title,
		color = '#00ffa9',
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
			type: 'line',
			data: {
				labels: safeData.map((d) => {
					const parts = d.date.split('-');
					return `${parts[1]}/${parts[2]}`;
				}),
				datasets: [
					{
						label: title,
						data: safeData.map((d) => d.count),
						borderColor: resolvedColor,
						backgroundColor: (ctx) => {
							if (!ctx.chart.chartArea) return color;
							const gradient = ctx.chart.ctx.createLinearGradient(
								0,
								ctx.chart.chartArea.top,
								0,
								ctx.chart.chartArea.bottom
							);
							gradient.addColorStop(0, `rgba(${rgb}, 0.35)`);
							gradient.addColorStop(1, `rgba(${rgb}, 0.0)`);
							return gradient;
						},
						fill: true,
						tension: 0.35,
						pointRadius: 3,
						pointHoverRadius: 5,
						pointBackgroundColor: resolvedColor,
						pointBorderColor: 'rgba(10, 20, 39, 1)',
						pointBorderWidth: 2,
						pointHoverBackgroundColor: resolvedColor,
						pointHoverBorderColor: 'rgba(10, 20, 39, 1)',
						pointHoverBorderWidth: 3,
						borderWidth: 2.5
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
								return safeData[i]?.date ?? '';
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
							maxTicksLimit: 7,
							maxRotation: 0
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
	<div class="flex items-center justify-between mb-4">
		<h3 class="text-sm font-semibold text-text-primary">{title}</h3>
		<div class="flex items-center gap-1.5 text-xs text-text-muted">
			<span class="w-2 h-2 rounded-full" style="background: {resolveColor(color)}"></span>
			<span>Last 30 days</span>
		</div>
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
