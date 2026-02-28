<script lang="ts">
	import { Copy, UserCircle, Ban, UserMinus, Bug } from 'lucide-svelte';
	import { addToast, openProfileCard } from '$lib/stores/ui';
	import {
		activeCommunity,
		activeCommunityMembers,
		memberHasPermission,
		Permission,
		setMembers
	} from '$lib/stores/community';
	import { currentUserId } from '$lib/stores/instance';
	import { api } from '$lib/api';
	import type { User } from '$lib/types';

	interface Props {
		user: User;
		x: number;
		y: number;
		onclose: () => void;
		onban?: (userId: string) => void;
	}

	let { user, x, y, onclose, onban }: Props = $props();

	let menuEl: HTMLDivElement | undefined = $state();

	// Position the menu so it doesn't go off-screen
	let adjustedX = $derived.by(() => {
		const menuWidth = 200;
		if (x + menuWidth > window.innerWidth) return window.innerWidth - menuWidth - 8;
		return x;
	});
	let adjustedY = $derived.by(() => {
		const menuHeight = 240;
		if (y + menuHeight > window.innerHeight) return window.innerHeight - menuHeight - 8;
		return y;
	});

	let isOwner = $derived($activeCommunity?.ownerId === $currentUserId);
	let myMember = $derived($activeCommunityMembers.find((m) => m.userId === $currentUserId) || null);
	let canKick = $derived(
		(isOwner || memberHasPermission(myMember, Permission.KickMembers)) &&
		user.id !== $currentUserId &&
		user.id !== $activeCommunity?.ownerId
	);
	let canBan = $derived(
		(isOwner || memberHasPermission(myMember, Permission.BanMembers)) &&
		user.id !== $currentUserId &&
		user.id !== $activeCommunity?.ownerId
	);

	function handleClickOutside(e: MouseEvent) {
		if (menuEl && !menuEl.contains(e.target as Node)) {
			onclose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	$effect(() => {
		// Small delay to avoid the same click that opened the menu from closing it
		const timer = setTimeout(() => {
			document.addEventListener('click', handleClickOutside);
		}, 10);
		document.addEventListener('keydown', handleKeydown);
		return () => {
			clearTimeout(timer);
			document.removeEventListener('click', handleClickOutside);
			document.removeEventListener('keydown', handleKeydown);
		};
	});

	function copyUserId() {
		navigator.clipboard.writeText(user.id);
		addToast({ type: 'success', message: 'User ID copied' });
		onclose();
	}

	function viewProfile(e: MouseEvent) {
		openProfileCard(user, e);
		onclose();
	}

	async function handleKick() {
		if (!$activeCommunity) return;
		const displayName = user.displayName || user.username;
		if (!confirm(`Kick ${displayName} from the community?`)) return;
		try {
			await api.kickMember($activeCommunity.id, user.id);
			addToast({ type: 'success', message: `${displayName} has been kicked` });
			const members = await api.getCommunityMembers($activeCommunity.id);
			setMembers($activeCommunity.id, members);
		} catch (err: any) {
			addToast({ type: 'error', message: err?.error || err?.message || 'Failed to kick member' });
		}
		onclose();
	}

	function handleBan() {
		if (onban) {
			onban(user.id);
		}
		onclose();
	}
</script>

<div
	bind:this={menuEl}
	class="fixed z-[100] w-48 bg-surface border border-border rounded-lg shadow-xl py-1 select-none"
	style="left: {adjustedX}px; top: {adjustedY}px;"
	role="menu"
>
	<button
		class="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors text-left"
		onclick={viewProfile}
		role="menuitem"
	>
		<UserCircle size={16} />
		View Profile
	</button>

	<div class="h-px bg-border my-1"></div>

	<button
		class="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors text-left"
		onclick={copyUserId}
		role="menuitem"
	>
		<Copy size={16} />
		Copy User ID
	</button>

	<button
		class="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors text-left"
		onclick={() => {
			navigator.clipboard.writeText(JSON.stringify(user, null, 2));
			addToast({ type: 'success', message: 'User data copied' });
			onclose();
		}}
		role="menuitem"
	>
		<Bug size={16} />
		Copy User Object
	</button>

	{#if canKick || canBan}
		<div class="h-px bg-border my-1"></div>

		{#if canKick}
			<button
				class="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-error hover:bg-error/10 transition-colors text-left"
				onclick={handleKick}
				role="menuitem"
			>
				<UserMinus size={16} />
				Kick
			</button>
		{/if}

		{#if canBan}
			<button
				class="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-error hover:bg-error/10 transition-colors text-left"
				onclick={handleBan}
				role="menuitem"
			>
				<Ban size={16} />
				Ban
			</button>
		{/if}
	{/if}
</div>
