<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Users,
		MessageSquare,
		Building2,
		Hash,
		Globe,
		Activity,
		UserPlus,
		TrendingUp,
		BarChart3,
		Trophy,
		ArrowUp,
		ArrowDown
	} from 'lucide-svelte';
	import { api } from '$lib/api';
	import StatCard from '$lib/components/admin/StatCard.svelte';
	import AreaChart from '$lib/components/admin/AreaChart.svelte';
	import BarChart from '$lib/components/admin/BarChart.svelte';
	import type { AnalyticsStats } from '$lib/types';

	let stats: AnalyticsStats | null = $state(null);
	let loading = $state(true);
	let error = $state('');

	onMount(async () => {
		try {
			stats = await api.getAdminAnalytics();
		} catch (e) {
			error = 'Failed to load analytics data';
			console.error(e);
		} finally {
			loading = false;
		}
	});

	function formatNum(n: number): string {
		if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
		if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
		return n.toLocaleString();
	}

	function growthColor(rate: number): string {
		if (rate > 0) return 'text-success';
		if (rate < 0) return 'text-danger';
		return 'text-text-muted';
	}

	function growthIcon(rate: number) {
		if (rate > 0) return ArrowUp;
		if (rate < 0) return ArrowDown;
		return undefined;
	}

	function growthLabel(rate: number): string {
		if (rate === 0) return 'No change';
		return `${Math.abs(rate).toFixed(1)}% ${rate > 0 ? 'increase' : 'decrease'}`;
	}

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

</script>

<div class="p-8 max-w-[1600px] mx-auto">
	<div class="mb-8">
		<h1 class="text-2xl font-bold text-text-primary">Analytics</h1>
		<p class="text-sm text-text-muted mt-1">Detailed instance statistics and insights</p>
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
		<!-- Summary Stat Cards -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
			<StatCard
				title="Total Users"
				value={formatNum(stats.totalUsers)}
				subtitle="Registered accounts"
			>
				{#snippet icon()}
					<Users size={20} class="text-primary" />
				{/snippet}
			</StatCard>

			<StatCard
				title="Total Messages"
				value={formatNum(stats.totalMessages)}
				subtitle="Messages sent"
			>
				{#snippet icon()}
					<MessageSquare size={20} class="text-primary" />
				{/snippet}
			</StatCard>

			<StatCard
				title="Communities"
				value={formatNum(stats.totalCommunities)}
				subtitle="Active communities"
			>
				{#snippet icon()}
					<Building2 size={20} class="text-primary" />
				{/snippet}
			</StatCard>

			<StatCard
				title="Channels"
				value={formatNum(stats.totalChannels)}
				subtitle="Across all communities"
			>
				{#snippet icon()}
					<Hash size={20} class="text-primary" />
				{/snippet}
			</StatCard>

			<StatCard
				title="Online Now"
				value={formatNum(stats.onlineUsers)}
				subtitle="Currently online"
			>
				{#snippet icon()}
					<Globe size={20} class="text-info" />
				{/snippet}
			</StatCard>

			<StatCard
				title="Messages Today"
				value={formatNum(stats.messagesToday)}
				subtitle="Last 24 hours"
			>
				{#snippet icon()}
					<Activity size={20} class="text-warning" />
				{/snippet}
			</StatCard>

			<StatCard
				title="New Users Today"
				value={formatNum(stats.newUsersToday)}
				subtitle="Registered in last 24h"
			>
				{#snippet icon()}
					<UserPlus size={20} class="text-accent" />
				{/snippet}
			</StatCard>

			<StatCard
				title="Active Users (7d)"
				value={formatNum(stats.activeUsers7d)}
				subtitle="Sent a message this week"
			>
				{#snippet icon()}
					<TrendingUp size={20} class="text-success" />
				{/snippet}
			</StatCard>
		</div>

		<!-- Growth Rates -->
		<div class="mb-8">
			<h2 class="text-lg font-semibold text-text-primary mb-4">Growth Rates (7-day comparison)</h2>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				{#each [
					{ label: 'User Growth', rate: stats.userGrowthRate, desc: 'New users vs previous 7 days', icon: Users },
					{ label: 'Message Growth', rate: stats.messageGrowthRate, desc: 'Messages vs previous 7 days', icon: MessageSquare },
					{ label: 'Community Growth', rate: stats.communityGrowthRate, desc: 'New communities vs previous 7 days', icon: Building2 }
				] as g}
					<div class="bg-surface border border-border rounded-xl p-5">
						<div class="flex items-center justify-between mb-3">
							<div class="p-2 rounded-lg bg-primary/10">
								<svelte:component this={g.icon} size={18} class="text-primary" />
							</div>
							<div class="flex items-center gap-1.5">
								{#if growthIcon(g.rate)}
									<svelte:component this={growthIcon(g.rate)} size={18} class={growthColor(g.rate)} />
								{/if}
								<span class="text-lg font-bold {growthColor(g.rate)}">
									{g.rate === 0 ? '0%' : `${Math.abs(g.rate).toFixed(1)}%`}
								</span>
							</div>
						</div>
						<p class="text-sm font-medium text-text-primary">{g.label}</p>
						<p class="text-xs text-text-muted mt-0.5">{g.desc}</p>
					</div>
				{/each}
			</div>
		</div>

		<!-- Period Totals -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
			<div class="bg-surface border border-border rounded-xl p-4">
				<p class="text-xs text-text-muted font-medium uppercase tracking-wider">New Users (7d)</p>
				<p class="text-xl font-bold text-text-primary mt-1">{formatNum(stats.newUsers7d)}</p>
			</div>
			<div class="bg-surface border border-border rounded-xl p-4">
				<p class="text-xs text-text-muted font-medium uppercase tracking-wider">New Users (30d)</p>
				<p class="text-xl font-bold text-text-primary mt-1">{formatNum(stats.newUsers30d)}</p>
			</div>
			<div class="bg-surface border border-border rounded-xl p-4">
				<p class="text-xs text-text-muted font-medium uppercase tracking-wider">Messages (7d)</p>
				<p class="text-xl font-bold text-text-primary mt-1">{formatNum(stats.messages7d)}</p>
			</div>
			<div class="bg-surface border border-border rounded-xl p-4">
				<p class="text-xs text-text-muted font-medium uppercase tracking-wider">Messages (30d)</p>
				<p class="text-xl font-bold text-text-primary mt-1">{formatNum(stats.messages30d)}</p>
			</div>
		</div>

		<!-- Derived Metrics -->
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
			<div class="bg-surface border border-border rounded-xl p-4">
				<div class="flex items-center gap-2 mb-1">
					<BarChart3 size={16} class="text-text-muted" />
					<p class="text-xs text-text-muted font-medium uppercase tracking-wider">Avg Messages / User</p>
				</div>
				<p class="text-xl font-bold text-text-primary">{stats.avgMessagesPerUser.toFixed(1)}</p>
			</div>
			<div class="bg-surface border border-border rounded-xl p-4">
				<div class="flex items-center gap-2 mb-1">
					<Users size={16} class="text-text-muted" />
					<p class="text-xs text-text-muted font-medium uppercase tracking-wider">Avg Members / Community</p>
				</div>
				<p class="text-xl font-bold text-text-primary">{stats.avgMembersPerCommunity.toFixed(1)}</p>
			</div>
		</div>

		<!-- Charts -->
		<div class="mb-8">
			<h2 class="text-lg font-semibold text-text-primary mb-4">Trends (Last 30 Days)</h2>
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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
					data={stats.activeUsersOverTime}
					title="Daily Active Users"
					color="var(--color-accent)"
				/>
			</div>
		</div>

		<!-- Activity Patterns -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
			<BarChart
				data={stats.activeHours.map((h) => ({ label: h.hour, value: h.count }))}
				title="Activity by Hour"
				color="var(--color-primary)"
			/>
			<BarChart
				data={stats.activeWeekdays.map((d) => ({ label: d.day, value: d.count }))}
				title="Activity by Day of Week"
				color="var(--color-accent)"
			/>
		</div>

		<!-- Top Communities -->
		<div class="bg-surface border border-border rounded-xl overflow-hidden">
			<div class="flex items-center gap-2 px-6 py-4 border-b border-border">
				<Trophy size={16} class="text-warning" />
				<h3 class="text-sm font-semibold text-text-primary">Top Communities</h3>
			</div>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-border">
							<th class="text-left text-text-muted font-medium px-6 py-3 w-12">#</th>
							<th class="text-left text-text-muted font-medium px-6 py-3">Name</th>
							<th class="text-right text-text-muted font-medium px-6 py-3">Members</th>
							<th class="text-right text-text-muted font-medium px-6 py-3">Messages</th>
							<th class="text-right text-text-muted font-medium px-6 py-3">Created</th>
						</tr>
					</thead>
					<tbody>
						{#each stats.topCommunities as community, i}
							<tr class="border-b border-border last:border-b-0 hover:bg-background-secondary/50 transition-colors">
								<td class="px-6 py-3.5 text-text-muted">{i + 1}</td>
								<td class="px-6 py-3.5 font-medium text-text-primary">{community.name}</td>
								<td class="px-6 py-3.5 text-right text-text-primary tabular-nums">{community.memberCount.toLocaleString()}</td>
								<td class="px-6 py-3.5 text-right text-text-primary tabular-nums">{community.messageCount.toLocaleString()}</td>
								<td class="px-6 py-3.5 text-right text-text-muted text-xs">{formatDate(community.createdAt)}</td>
							</tr>
						{/each}
						{#if stats.topCommunities.length === 0}
							<tr>
								<td colspan="5" class="px-6 py-8 text-center text-text-muted text-sm">
									No communities found
								</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>
