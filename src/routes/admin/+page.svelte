<script lang="ts">
	import { onMount } from 'svelte';
	import { Users, MessageSquare, Building2 } from 'lucide-svelte';
	import { api } from '$lib/api';
	import StatCard from '$lib/components/admin/StatCard.svelte';
	import AreaChart from '$lib/components/admin/AreaChart.svelte';
	import type { DashboardStats } from '$lib/types';

	let stats: DashboardStats | null = $state(null);
	let loading = $state(true);
	let error = $state('');

	onMount(async () => {
		try {
			const data = await api.getAdminDashboard();
			stats = {
				totalUsers: data.totalUsers ?? 0,
				totalMessages: data.totalMessages ?? 0,
				totalCommunities: data.totalCommunities ?? 0,
				usersOverTime: data.usersOverTime ?? [],
				messagesOverTime: data.messagesOverTime ?? [],
				communitiesOverTime: data.communitiesOverTime ?? []
			};
		} catch (e) {
			error = 'Failed to load dashboard data';
			console.error(e);
		} finally {
			loading = false;
		}
	});
</script>

<div class="p-8 max-w-[1600px] mx-auto">
	<div class="mb-8">
		<h1 class="text-2xl font-bold text-text-primary">Admin Overview</h1>
		<p class="text-sm text-text-muted mt-1">Monitor and manage your instance</p>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-32">
			<div
				class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"
			></div>
		</div>
	{:else if error}
		<div class="bg-danger/10 border border-danger/20 rounded-lg p-6 text-center">
			<p class="text-danger font-medium">{error}</p>
		</div>
	{:else if stats}
		<!-- Stat Cards -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
			<StatCard
				title="Total Users"
				value={stats.totalUsers.toLocaleString()}
				subtitle="Registered accounts"
			>
				{#snippet icon()}
					<Users size={20} class="text-primary" />
				{/snippet}
			</StatCard>

			<StatCard
				title="Total Messages"
				value={stats.totalMessages.toLocaleString()}
				subtitle="Messages sent"
			>
				{#snippet icon()}
					<MessageSquare size={20} class="text-primary" />
				{/snippet}
			</StatCard>

			<StatCard
				title="Communities"
				value={stats.totalCommunities.toLocaleString()}
				subtitle="Active communities"
			>
				{#snippet icon()}
					<Building2 size={20} class="text-primary" />
				{/snippet}
			</StatCard>

			</div>

		<!-- Charts -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
			<AreaChart
				data={stats.usersOverTime}
				title="New Users"
				color="var(--color-info)"
			/>
			<AreaChart
				data={stats.messagesOverTime}
				title="Messages"
				color="var(--color-primary)"
			/>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<AreaChart
				data={stats.communitiesOverTime}
				title="New Communities"
				color="var(--color-warning)"
			/>
			<AreaChart
				data={stats.usersOverTime.map((d, i) => ({
					date: d.date,
					count: stats.messagesOverTime[i]?.count ?? 0
				}))}
				title="Engagement Rate"
				color="var(--color-accent)"
			/>
		</div>
	{/if}
</div>
