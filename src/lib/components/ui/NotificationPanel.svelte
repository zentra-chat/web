<script lang="ts">
	import { Bell } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import Avatar from './Avatar.svelte';
	import {
		notifications,
		unreadCount,
		notificationPanelOpen,
		toggleNotificationPanel,
		closeNotificationPanel,
		setNotifications,
		setUnreadCount,
		markNotificationReadLocal,
		markAllNotificationsReadLocal
	} from '$lib/stores/notification';
	import { api } from '$lib/api';
	import { goto } from '$app/navigation';
	import { selectCommunity, activeChannelId } from '$lib/stores/community';
	import { setActiveDmConversationId } from '$lib/stores/dm';
	import type { Notification } from '$lib/types';

	let isLoading = $state(false);
	let panelRef: HTMLDivElement | null = $state(null);

	onMount(() => {
		loadNotifications();
	});

	async function loadNotifications() {
		isLoading = true;
		try {
			const [list, count] = await Promise.all([
				api.getNotifications(1, 50),
				api.getUnreadNotificationCount()
			]);
			setNotifications(list?.data ?? []);
			setUnreadCount(count ?? 0);
		} catch (err) {
			console.error('Failed to load notifications:', err);
		} finally {
			isLoading = false;
		}
	}

	async function handleMarkRead(e: MouseEvent, notif: Notification) {
		e.stopPropagation();
		if (notif.isRead) return;
		try {
			await api.markNotificationRead(notif.id);
			markNotificationReadLocal(notif.id);
		} catch (err) {
			console.error('Failed to mark notification read:', err);
		}
	}

	async function handleMarkAllRead() {
		try {
			await api.markAllNotificationsRead();
			markAllNotificationsReadLocal();
		} catch (err) {
			console.error('Failed to mark all read:', err);
		}
	}

	async function handleNotificationClick(notif: Notification) {
		// Mark as read
		if (!notif.isRead) {
			try {
				await api.markNotificationRead(notif.id);
				markNotificationReadLocal(notif.id);
			} catch {
				// ignore
			}
		}

		closeNotificationPanel();

		// Navigate to the relevant context
		if (notif.type === 'dm_message' && notif.channelId) {
			setActiveDmConversationId(notif.channelId);
			goto('/app');
		} else if (notif.communityId && notif.channelId) {
			selectCommunity(notif.communityId);
			activeChannelId.set(notif.channelId);
			goto('/app');
		}
	}

	function formatTime(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60_000);
		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours}h ago`;
		const diffDays = Math.floor(diffHours / 24);
		return `${diffDays}d ago`;
	}

	function notifIcon(type: Notification['type']): string {
		if (type === 'dm_message') return '💬';
		if (type === 'reply') return '↩️';
		return '@';
	}

	// Close panel on outside click
	$effect(() => {
		if (!$notificationPanelOpen) return;

		function handleOutsideClick(e: MouseEvent) {
			if (panelRef && !panelRef.contains(e.target as Node)) {
				closeNotificationPanel();
			}
		}
		document.addEventListener('mousedown', handleOutsideClick);
		return () => document.removeEventListener('mousedown', handleOutsideClick);
	});
</script>

<div class="relative" bind:this={panelRef}>
	<!-- Bell button with unread badge -->
	<button
		onclick={toggleNotificationPanel}
		class="w-12 h-12 rounded-2xl hover:rounded-xl bg-surface-hover hover:bg-surface-active text-text-secondary hover:text-text-primary transition-all duration-200 flex items-center justify-center relative"
		aria-label="Notifications"
	>
		<Bell size={20} />
		{#if $unreadCount > 0}
			<span
				class="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center leading-none"
			>
				{$unreadCount > 99 ? '99+' : $unreadCount}
			</span>
		{/if}
	</button>

	<!-- Dropdown panel -->
	{#if $notificationPanelOpen}
		<div
			class="absolute left-full bottom-0 ml-3 w-80 max-h-130 flex flex-col bg-surface border border-border rounded-xl shadow-2xl z-60 overflow-hidden"
			role="dialog"
			aria-label="Notifications panel"
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
				<h3 class="text-sm font-semibold text-text-primary">Notifications</h3>
				{#if $unreadCount > 0}
					<button
						onclick={handleMarkAllRead}
						class="text-xs text-primary hover:underline transition-colors"
					>
						Mark all read
					</button>
				{/if}
			</div>

			<!-- List -->
			<div class="flex-1 overflow-y-auto">
				{#if isLoading}
					<div class="flex items-center justify-center py-8">
						<span class="text-text-muted text-sm">Loading...</span>
					</div>
				{:else if $notifications.length === 0}
					<div class="flex flex-col items-center justify-center py-10 gap-2 text-text-muted">
						<Bell size={28} class="opacity-40" />
						<p class="text-sm">No notifications</p>
					</div>
				{:else}
					{#each $notifications as notif (notif.id)}
						<button
							onclick={() => handleNotificationClick(notif)}
							class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors border-b border-border/50
							{!notif.isRead ? 'bg-primary/5' : ''}"
						>
							<!-- Icon / Avatar -->
							<div class="relative shrink-0 mt-0.5">
								{#if notif.actor}
									<Avatar user={notif.actor} size="sm" />
									<span
										class="absolute -bottom-1 -right-1 text-[11px] w-4 h-4 flex items-center justify-center rounded-full bg-surface border border-border"
									>
										{notifIcon(notif.type)}
									</span>
								{:else}
									<div
										class="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center text-sm"
									>
										{notifIcon(notif.type)}
									</div>
								{/if}
							</div>

							<!-- Text -->
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium text-text-primary leading-snug truncate">
									{notif.title}
								</p>
								{#if notif.body}
									<p class="text-xs text-text-muted mt-0.5 line-clamp-2 leading-relaxed">
										{notif.body}
									</p>
								{/if}
								<p class="text-[10px] text-text-muted mt-1">{formatTime(notif.createdAt)}</p>
							</div>

							<!-- Unread dot -->
							{#if !notif.isRead}
								<div
									class="w-2 h-2 rounded-full bg-primary shrink-0 mt-2"
									title="Unread"
								></div>
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>
