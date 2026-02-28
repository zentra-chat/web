<script lang="ts">
	import { goto } from '$app/navigation';
	import { Input, Textarea, Button, Spinner } from '$lib/components/ui';
	import { Image, X, Trash, Copy, RefreshCw, Users, Settings as SettingsIcon, Link, Clock, Plus, Crown, Smile, Pencil, ScrollText, Gavel, UserX, Puzzle } from 'lucide-svelte';
	import PluginSettings from '$lib/components/community/PluginSettings.svelte';
	import { addToast } from '$lib/stores/ui';
	import {
		activeCommunity,
		activeCommunityMembers,
		updateCommunity,
		removeCommunity,
		setMembers,
		updateMemberRoles
	} from '$lib/stores/community';
	import { currentUserId } from '$lib/stores/instance';
	import { api } from '$lib/api';
	import type { CommunityInvite, Role, CommunityMember, CustomEmoji, CommunityBan, AuditLogEntry } from '$lib/types';
	import { Permission, memberHasPermission } from '$lib/stores/community';
	import { refreshCustomEmojis } from '$lib/stores/emoji';

	type ApiErrorLike = { error?: string; message?: string; response?: { data?: { message?: string } } };

	let name = $state('');
	let description = $state('');
	let icon = $state<File | null>(null);
	let iconPreview = $state<string | null>(null);
	let isPrivate = $state(false);
	let invites = $state<CommunityInvite[]>([]);
	let activeTab = $state<'overview' | 'members' | 'roles' | 'invites' | 'emojis' | 'plugins' | 'bans' | 'audit-log'>('overview');
	let isSubmitting = $state(false);
	let isGeneratingInvite = $state(false);
	let isLoadingInvites = $state(false);
	let hasAttemptedInviteLoad = $state(false);
	let errors = $state<Record<string, string>>({});
	let showCreateInviteForm = $state(false);
	let newInviteMaxUses = $state<number | null>(null);
	let newInviteExpiry = $state<string>('never'); // 'never', '30m', '1h', '6h', '12h', '1d', '7d'
	let roles = $state<Role[]>([]);
	let isLoadingRoles = $state(false);
	let hasAttemptedRolesLoad = $state(false);
	let selectedRoleId = $state<string | null>(null);
	let roleDraft = $state<{ name: string; color: string; permissions: number }>({
		name: '',
		color: '#99a3b0',
		permissions: 0
	});
	let isSavingRole = $state(false);
	let isCreatingRole = $state(false);
	let isDeletingRole = $state(false);
	let newRoleName = $state('');
	let newRoleColor = $state('#6b7280');

	let isLoadingMembers = $state(false);
	let hasAttemptedMembersLoad = $state(false);
	let selectedMemberId = $state<string | null>(null);
	let selectedMemberRoleIds = $state<string[]>([]);
	let isUpdatingMemberRoles = $state(false);

	// Emoji management state
	let communityEmojis = $state<CustomEmoji[]>([]);
	let isLoadingEmojis = $state(false);
	let hasAttemptedEmojiLoad = $state(false);
	let isUploadingEmoji = $state(false);
	let newEmojiName = $state('');
	let newEmojiFile = $state<File | null>(null);
	let newEmojiPreview = $state<string | null>(null);
	let emojiFileInputRef: HTMLInputElement | null = $state(null);
	let editingEmojiId = $state<string | null>(null);
	let editingEmojiName = $state('');

	// Moderation state
	let bans = $state<CommunityBan[]>([]);
	let auditLogs = $state<AuditLogEntry[]>([]);
	let auditLogTotal = $state(0);
	let auditLogPage = $state(1);
	let isLoadingBans = $state(false);
	let isLoadingAuditLog = $state(false);
	let hasAttemptedBansLoad = $state(false);
	let hasAttemptedAuditLoad = $state(false);
	let banReasonInput = $state('');
	let banTargetId = $state<string | null>(null);
	let showBanModal = $state(false);
	let isProcessingBan = $state(false);

	let fileInputRef: HTMLInputElement | null = $state(null);
	let isOwner = $derived($activeCommunity?.ownerId === $currentUserId);

	// Check if the current user has moderation permissions
	let currentMember = $derived($activeCommunityMembers.find((m) => m.userId === $currentUserId) || null);
	let canModerate = $derived(
		isOwner ||
		memberHasPermission(currentMember, Permission.BanMembers) ||
		memberHasPermission(currentMember, Permission.KickMembers) ||
		memberHasPermission(currentMember, Permission.ViewAuditLog)
	);

	// Load community data when page is active
	$effect(() => {
		if ($activeCommunity) {
			name = $activeCommunity.name;
			description = $activeCommunity.description || '';
			iconPreview = $activeCommunity.iconUrl || null;
			isPrivate = !$activeCommunity.isPublic;
		} else {
			goto('/app');
		}
	});

	// Load invites when switching to invites tab
	$effect(() => {
		if (activeTab === 'invites' && $activeCommunity && !hasAttemptedInviteLoad && !isLoadingInvites) {
			loadInvites();
		}
	});

	$effect(() => {
		if (activeTab === 'roles' && $activeCommunity && !hasAttemptedRolesLoad && !isLoadingRoles) {
			loadRoles();
		}
	});

	$effect(() => {
		if (activeTab === 'members' && $activeCommunity && !hasAttemptedMembersLoad && !isLoadingMembers) {
			loadMembers();
		}
	});

	$effect(() => {
		if (activeTab === 'emojis' && $activeCommunity && !hasAttemptedEmojiLoad && !isLoadingEmojis) {
			loadEmojis();
		}
	});

	// Reset attempt flag when switching tabs away from invites
	$effect(() => {
		if (activeTab !== 'invites') {
			hasAttemptedInviteLoad = false;
		}
	});

	$effect(() => {
		if (activeTab !== 'roles') {
			hasAttemptedRolesLoad = false;
		}
	});

	$effect(() => {
		if (activeTab !== 'members') {
			hasAttemptedMembersLoad = false;
		}
	});

	$effect(() => {
		if (activeTab !== 'emojis') {
			hasAttemptedEmojiLoad = false;
		}
	});

	// Load bans when switching to bans tab
	$effect(() => {
		if (activeTab === 'bans' && $activeCommunity && !hasAttemptedBansLoad && !isLoadingBans) {
			loadBans();
		}
	});

	// Load audit log when switching to audit-log tab
	$effect(() => {
		if (activeTab === 'audit-log' && $activeCommunity && !hasAttemptedAuditLoad && !isLoadingAuditLog) {
			loadAuditLog();
		}
	});

	$effect(() => {
		if (activeTab !== 'bans') {
			hasAttemptedBansLoad = false;
		}
	});

	$effect(() => {
		if (activeTab !== 'audit-log') {
			hasAttemptedAuditLoad = false;
		}
	});

	async function loadInvites() {
		if (!$activeCommunity || isLoadingInvites) return;

		isLoadingInvites = true;
		try {
			invites = await api.getInvites($activeCommunity.id);
		} catch (err) {
			console.error('Failed to load invites:', err);
			addToast({
				type: 'error',
				message: 'Failed to load invites'
			});
		} finally {
			isLoadingInvites = false;
			hasAttemptedInviteLoad = true;
		}
	}

	async function loadRoles() {
		if (!$activeCommunity || isLoadingRoles) return;

		isLoadingRoles = true;
		try {
			roles = await api.getRoles($activeCommunity.id);
			if (!selectedRoleId && roles.length > 0) {
				selectRole(roles[0]);
			}
		} catch (err) {
			console.error('Failed to load roles:', err);
			addToast({
				type: 'error',
				message: 'Failed to load roles'
			});
		} finally {
			isLoadingRoles = false;
			hasAttemptedRolesLoad = true;
		}
	}

	async function loadMembers() {
		if (!$activeCommunity || isLoadingMembers) return;

		isLoadingMembers = true;
		try {
			const members = await api.getCommunityMembers($activeCommunity.id);
			setMembers($activeCommunity.id, members);
			if (!selectedMemberId && members.length > 0) {
				selectMember(members[0]);
			}
			if (roles.length === 0 && !isLoadingRoles) {
				loadRoles();
			}
		} catch (err) {
			console.error('Failed to load members:', err);
			addToast({
				type: 'error',
				message: 'Failed to load members'
			});
		} finally {
			isLoadingMembers = false;
			hasAttemptedMembersLoad = true;
		}
	}

	async function loadBans() {
		if (!$activeCommunity || isLoadingBans) return;
		isLoadingBans = true;
		hasAttemptedBansLoad = true;
		try {
			bans = await api.getBans($activeCommunity.id);
		} catch (err) {
			console.error('Failed to load bans:', err);
			addToast({ type: 'error', message: 'Failed to load ban list' });
		} finally {
			isLoadingBans = false;
		}
	}

	async function loadAuditLog(page = 1) {
		if (!$activeCommunity || isLoadingAuditLog) return;
		isLoadingAuditLog = true;
		hasAttemptedAuditLoad = true;
		try {
			const result = await api.getAuditLog($activeCommunity.id, page);
			auditLogs = result.data;
			auditLogTotal = result.total;
			auditLogPage = page;
		} catch (err) {
			console.error('Failed to load audit log:', err);
			addToast({ type: 'error', message: 'Failed to load audit log' });
		} finally {
			isLoadingAuditLog = false;
		}
	}

	function openBanModal(userId: string) {
		banTargetId = userId;
		banReasonInput = '';
		showBanModal = true;
	}

	function closeBanModal() {
		showBanModal = false;
		banTargetId = null;
		banReasonInput = '';
	}

	async function confirmBan() {
		if (!$activeCommunity || !banTargetId || isProcessingBan) return;
		isProcessingBan = true;
		try {
			await api.banMember($activeCommunity.id, banTargetId, banReasonInput.trim() || undefined);
			addToast({ type: 'success', message: 'Member banned' });
			closeBanModal();

			// Refresh the members list so the banned user disappears
			const members = await api.getCommunityMembers($activeCommunity.id);
			setMembers($activeCommunity.id, members);

			// If we're on the bans tab, refresh bans too
			if (activeTab === 'bans') {
				await loadBans();
			}
		} catch (err) {
			const msg = (err as ApiErrorLike)?.error || (err as ApiErrorLike)?.message || 'Failed to ban member';
			addToast({ type: 'error', message: msg });
		} finally {
			isProcessingBan = false;
		}
	}

	async function handleUnban(userId: string) {
		if (!$activeCommunity) return;
		try {
			await api.unbanMember($activeCommunity.id, userId);
			bans = bans.filter((b) => b.userId !== userId);
			addToast({ type: 'success', message: 'User unbanned' });
		} catch (err) {
			const msg = (err as ApiErrorLike)?.error || (err as ApiErrorLike)?.message || 'Failed to unban user';
			addToast({ type: 'error', message: msg });
		}
	}

	async function handleKick(userId: string, displayName: string) {
		if (!$activeCommunity) return;
		if (!confirm(`Kick ${displayName} from the community?`)) return;
		try {
			await api.kickMember($activeCommunity.id, userId);
			addToast({ type: 'success', message: `${displayName} has been kicked` });
			const members = await api.getCommunityMembers($activeCommunity.id);
			setMembers($activeCommunity.id, members);
		} catch (err) {
			const msg = (err as ApiErrorLike)?.error || (err as ApiErrorLike)?.message || 'Failed to kick member';
			addToast({ type: 'error', message: msg });
		}
	}

	function formatAuditAction(action: string): string {
		const labels: Record<string, string> = {
			'community.create': 'created the community',
			'community.update': 'updated community settings',
			'community.delete': 'deleted the community',
			'community.icon.update': 'changed the community icon',
			'community.icon.remove': 'removed the community icon',
			'channel.create': 'created a channel',
			'channel.update': 'updated a channel',
			'channel.delete': 'deleted a channel',
			'member.join': 'joined the community',
			'member.leave': 'left the community',
			'member.kick': 'kicked a member',
			'member.ban': 'banned a member',
			'member.unban': 'unbanned a member',
			'role.create': 'created a role',
			'role.update': 'updated a role',
			'role.delete': 'deleted a role',
			'invite.create': 'created an invite',
			'invite.delete': 'deleted an invite',
			'message.delete': 'deleted a message',
			'message.pin': 'pinned a message',
			'message.unpin': 'unpinned a message'
		};
		return labels[action] || action;
	}

	// Safely parse audit log details - handles both object and string forms
	function parseDetails(details: unknown): Record<string, unknown> | null {
		if (!details) return null;
		if (typeof details === 'object') return details as Record<string, unknown>;
		if (typeof details === 'string') {
			try {
				return JSON.parse(details);
			} catch {
				return null;
			}
		}
		return null;
	}

	function formatRelativeTime(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffSec = Math.floor(diffMs / 1000);
		const diffMin = Math.floor(diffSec / 60);
		const diffHr = Math.floor(diffMin / 60);
		const diffDay = Math.floor(diffHr / 24);

		if (diffDay > 30) return date.toLocaleDateString();
		if (diffDay > 0) return `${diffDay}d ago`;
		if (diffHr > 0) return `${diffHr}h ago`;
		if (diffMin > 0) return `${diffMin}m ago`;
		return 'just now';
	}

	function handleClose() {
		goto('/app');
		resetForm();
	}

	function resetForm() {
		icon = null;
		iconPreview = $activeCommunity?.iconUrl || null;
		errors = {};
		activeTab = 'overview';
		invites = [];
		showCreateInviteForm = false;
		newInviteMaxUses = null;
		newInviteExpiry = 'never';
		roles = [];
		selectedRoleId = null;
		selectedMemberId = null;
		selectedMemberRoleIds = [];
		communityEmojis = [];
		newEmojiName = '';
		newEmojiFile = null;
		newEmojiPreview = null;
		editingEmojiId = null;
		bans = [];
		auditLogs = [];
		showBanModal = false;
		banTargetId = null;
		banReasonInput = '';
	}

	// --- Emoji management ---

	async function loadEmojis() {
		if (!$activeCommunity || isLoadingEmojis) return;
		isLoadingEmojis = true;
		hasAttemptedEmojiLoad = true;
		try {
			communityEmojis = await api.getCommunityEmojis($activeCommunity.id);
		} catch (err) {
			addToast({ type: 'error', message: 'Failed to load emojis' });
		} finally {
			isLoadingEmojis = false;
		}
	}

	function handleEmojiFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		// Validate on the client side too
		const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
		if (!allowed.includes(file.type)) {
			addToast({ type: 'error', message: 'Must be a PNG, JPEG, GIF, or WebP image' });
			return;
		}
		if (file.size > 256 * 1024) {
			addToast({ type: 'error', message: 'Emoji must be under 256KB' });
			return;
		}

		newEmojiFile = file;
		const reader = new FileReader();
		reader.onload = () => newEmojiPreview = reader.result as string;
		reader.readAsDataURL(file);
	}

	async function uploadEmoji() {
		if (!$activeCommunity || !newEmojiFile || !newEmojiName.trim()) return;
		isUploadingEmoji = true;
		try {
			await api.createEmoji($activeCommunity.id, newEmojiName.trim(), newEmojiFile);
			addToast({ type: 'success', message: `Emoji :${newEmojiName.trim()}: added` });
			newEmojiName = '';
			newEmojiFile = null;
			newEmojiPreview = null;
			if (emojiFileInputRef) emojiFileInputRef.value = '';
			await loadEmojis();
			// Refresh the global emoji store so the picker updates
			refreshCustomEmojis();
		} catch (err) {
			const msg = (err as ApiErrorLike)?.message || (err as ApiErrorLike)?.error || 'Failed to upload emoji';
			addToast({ type: 'error', message: msg });
		} finally {
			isUploadingEmoji = false;
		}
	}

	function startEditEmoji(emoji: CustomEmoji) {
		editingEmojiId = emoji.id;
		editingEmojiName = emoji.name;
	}

	function cancelEditEmoji() {
		editingEmojiId = null;
		editingEmojiName = '';
	}

	async function saveEmojiName(emojiId: string) {
		if (!editingEmojiName.trim()) return;
		try {
			await api.updateEmoji(emojiId, editingEmojiName.trim());
			addToast({ type: 'success', message: 'Emoji renamed' });
			cancelEditEmoji();
			await loadEmojis();
			refreshCustomEmojis();
		} catch (err) {
			const msg = (err as ApiErrorLike)?.message || (err as ApiErrorLike)?.error || 'Failed to rename emoji';
			addToast({ type: 'error', message: msg });
		}
	}

	async function deleteEmoji(emojiId: string, emojiName: string) {
		if (!confirm(`Delete :${emojiName}:? This can't be undone.`)) return;
		try {
			await api.deleteEmoji(emojiId);
			addToast({ type: 'success', message: `Emoji :${emojiName}: deleted` });
			await loadEmojis();
			refreshCustomEmojis();
		} catch {
			addToast({ type: 'error', message: 'Failed to delete emoji' });
		}
	}

	const permissionOptions = [
		{ label: 'View Channels', value: 1 << 0 },
		{ label: 'Send Messages', value: 1 << 1 },
		{ label: 'Manage Messages', value: 1 << 2 },
		{ label: 'Manage Channels', value: 1 << 3 },
		{ label: 'Manage Community', value: 1 << 4 },
		{ label: 'Manage Roles', value: 1 << 5 },
		{ label: 'Kick Members', value: 1 << 6 },
		{ label: 'Ban Members', value: 1 << 7 },
		{ label: 'Create Invites', value: 1 << 8 },
		{ label: 'Attach Files', value: 1 << 9 },
		{ label: 'Add Reactions', value: 1 << 10 },
		{ label: 'Mention Everyone', value: 1 << 11 },
		{ label: 'Pin Messages', value: 1 << 12 },
		{ label: 'Manage Webhooks', value: 1 << 13 },
		{ label: 'View Audit Log', value: 1 << 14 },
		{ label: 'Administrator', value: 1 << 15 },
		{ label: 'Manage Emojis', value: 1 << 20 }
	];

	function selectRole(role: Role) {
		selectedRoleId = role.id;
		roleDraft = {
			name: role.name,
			color: role.color || '#6b7280',
			permissions: role.permissions
		};
	}

	function selectMember(member: CommunityMember) {
		selectedMemberId = member.userId;
		selectedMemberRoleIds = (member.roles || []).filter((role) => !role.isDefault).map((role) => role.id);
	}

	function togglePermission(bit: number) {
		roleDraft = {
			...roleDraft,
			permissions: roleDraft.permissions ^ bit
		};
	}

	async function saveRole() {
		if (!$activeCommunity || !selectedRoleId || isSavingRole) return;
		isSavingRole = true;
		try {
			const updated = await api.updateRole($activeCommunity.id, selectedRoleId, {
				name: roleDraft.name.trim(),
				color: roleDraft.color || null,
				permissions: roleDraft.permissions
			});
			roles = roles.map((role) => (role.id === updated.id ? updated : role));
			addToast({ type: 'success', message: 'Role updated' });
		} catch (err) {
			console.error('Failed to update role:', err);
			addToast({ type: 'error', message: 'Failed to update role' });
		} finally {
			isSavingRole = false;
		}
	}

	async function createRole() {
		if (!$activeCommunity || !newRoleName.trim() || isCreatingRole) return;
		isCreatingRole = true;
		try {
			const created = await api.createRole($activeCommunity.id, {
				name: newRoleName.trim(),
				color: newRoleColor || null,
				permissions: 0
			});
			roles = [created, ...roles];
			newRoleName = '';
			newRoleColor = '#6b7280';
			selectRole(created);
			addToast({ type: 'success', message: 'Role created' });
		} catch (err) {
			console.error('Failed to create role:', err);
			addToast({ type: 'error', message: 'Failed to create role' });
		} finally {
			isCreatingRole = false;
		}
	}

	async function deleteRole(role: Role) {
		if (!$activeCommunity || role.isDefault || isDeletingRole) return;
		if (!confirm(`Delete role "${role.name}"?`)) return;
		isDeletingRole = true;
		try {
			await api.deleteRole($activeCommunity.id, role.id);
			roles = roles.filter((r) => r.id !== role.id);
			if (selectedRoleId === role.id) {
				selectedRoleId = null;
				if (roles.length > 0) selectRole(roles[0]);
			}
			addToast({ type: 'success', message: 'Role deleted' });
		} catch (err) {
			console.error('Failed to delete role:', err);
			addToast({ type: 'error', message: 'Failed to delete role' });
		} finally {
			isDeletingRole = false;
		}
	}

	async function saveMemberRoles() {
		if (!$activeCommunity || !selectedMemberId || isUpdatingMemberRoles) return;
		isUpdatingMemberRoles = true;
		try {
			await api.setMemberRoles($activeCommunity.id, selectedMemberId, selectedMemberRoleIds);
			const member = $activeCommunityMembers.find((m) => m.userId === selectedMemberId) || null;
			const roleMap = new Map(roles.map((role) => [role.id, role]));
			const updatedRoles = selectedMemberRoleIds
				.map((id) => roleMap.get(id))
				.filter((role): role is Role => !!role);
			if (member) {
				const defaultRole = roles.find((role) => role.isDefault) || null;
				updateMemberRoles($activeCommunity.id, selectedMemberId, defaultRole ? [defaultRole, ...updatedRoles] : updatedRoles);
			}
			addToast({ type: 'success', message: 'Member roles updated' });
		} catch (err) {
			console.error('Failed to update member roles:', err);
			addToast({ type: 'error', message: 'Failed to update member roles' });
		} finally {
			isUpdatingMemberRoles = false;
		}
	}

	function getMemberLabel(member: CommunityMember): string {
		return member.nickname || member.user?.displayName || member.user?.username || 'Unknown';
	}

	function handleIconSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			const file = input.files[0];

			if (!file.type.startsWith('image/')) {
				errors = { ...errors, icon: 'Please select an image file' };
				return;
			}

			if (file.size > 5 * 1024 * 1024) {
				errors = { ...errors, icon: 'Image must be less than 5MB' };
				return;
			}

			icon = file;
			iconPreview = URL.createObjectURL(file);
			delete errors.icon;
		}
	}

	function removeIcon() {
		icon = null;
		iconPreview = null;
		if (fileInputRef) fileInputRef.value = '';
	}

	function validate(): boolean {
		const newErrors: Record<string, string> = {};

		if (!name.trim()) {
			newErrors.name = 'Community name is required';
		} else if (name.length < 2) {
			newErrors.name = 'Name must be at least 2 characters';
		} else if (name.length > 100) {
			newErrors.name = 'Name must be less than 100 characters';
		}

		if (description.length > 500) {
			newErrors.description = 'Description must be less than 500 characters';
		}

		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	async function handleSubmit() {
		if (!validate() || isSubmitting || !$activeCommunity) return;

		isSubmitting = true;

		try {
			const updatedCommunity = await api.updateCommunity($activeCommunity.id, {
				name: name.trim(),
				description: description.trim() || undefined,
				isPublic: !isPrivate
			});

			// Upload icon if changed
			if (icon) {
				try {
					const iconUrl = await api.updateCommunityIcon($activeCommunity.id, icon);
					updatedCommunity.iconUrl = iconUrl;
				} catch (err) {
					console.error('Failed to upload icon:', err);
				}
			} else if (iconPreview === null && $activeCommunity.iconUrl) {
				try {
					await api.removeCommunityIcon($activeCommunity.id);
					updatedCommunity.iconUrl = null;
				} catch (err) {
					console.error('Failed to remove icon:', err);
				}
			}

			updateCommunity($activeCommunity.id, updatedCommunity);
			addToast({
				type: 'success',
				message: 'Community updated!'
			});
		} catch (err: unknown) {
			const error = err as ApiErrorLike;
			console.error('Failed to update community:', err);
			if (error.response?.data?.message) {
				errors = { submit: error.response.data.message };
			} else {
				errors = { submit: error.error || error.message || 'Failed to update community. Please try again.' };
			}
		} finally {
			isSubmitting = false;
		}
	}

	async function handleDeleteCommunity() {
		if (!$activeCommunity) return;

		const confirmed = confirm(
			`Are you sure you want to delete "${$activeCommunity.name}"? This action cannot be undone.`
		);
		if (!confirmed) return;

		try {
			await api.deleteCommunity($activeCommunity.id);
			removeCommunity($activeCommunity.id);
			addToast({
				type: 'success',
				message: 'Community deleted'
			});
			handleClose();
		} catch (err) {
			console.error('Failed to delete community:', err);
			addToast({
				type: 'error',
				message: 'Failed to delete community'
			});
		}
	}

	async function handleLeaveCommunity() {
		if (!$activeCommunity) return;

		const confirmed = confirm(`Are you sure you want to leave "${$activeCommunity.name}"?`);
		if (!confirmed) return;

		try {
			await api.leaveCommunity($activeCommunity.id);
			removeCommunity($activeCommunity.id);
			addToast({
				type: 'success',
				message: 'Left community'
			});
			handleClose();
		} catch (err) {
			console.error('Failed to leave community:', err);
			addToast({
				type: 'error',
				message: 'Failed to leave community'
			});
		}
	}

	async function generateInvite() {
		if (!$activeCommunity || isGeneratingInvite) return;

		isGeneratingInvite = true;

		try {
			// Convert expiry selection to seconds
			let expiresIn: number | undefined;
			switch (newInviteExpiry) {
				case '30m': expiresIn = 30 * 60; break;
				case '1h': expiresIn = 60 * 60; break;
				case '6h': expiresIn = 6 * 60 * 60; break;
				case '12h': expiresIn = 12 * 60 * 60; break;
				case '1d': expiresIn = 24 * 60 * 60; break;
				case '7d': expiresIn = 7 * 24 * 60 * 60; break;
				default: expiresIn = undefined;
			}

			const invite = await api.createInvite($activeCommunity.id, {
				maxUses: newInviteMaxUses || undefined,
				expiresIn
			});

			invites = [invite, ...invites];
			showCreateInviteForm = false;
			newInviteMaxUses = null;
			newInviteExpiry = 'never';

			// Copy the new invite link
			copyInviteLink(invite.code);

			addToast({
				type: 'success',
				message: 'Invite created and copied to clipboard!'
			});
		} catch (err) {
			console.error('Failed to generate invite:', err);
			addToast({
				type: 'error',
				message: 'Failed to generate invite'
			});
		} finally {
			isGeneratingInvite = false;
		}
	}

	function copyInviteLink(code: string) {
		navigator.clipboard.writeText(`${window.location.origin}/invite/${code}`);
		addToast({
			type: 'success',
			message: 'Invite link copied!'
		});
	}

	async function deleteInvite(inviteId: string) {
		if (!$activeCommunity) return;

		try {
			await api.deleteInvite($activeCommunity.id, inviteId);
			invites = invites.filter(i => i.id !== inviteId);
			addToast({
				type: 'success',
				message: 'Invite deleted'
			});
		} catch (err) {
			console.error('Failed to delete invite:', err);
			addToast({
				type: 'error',
				message: 'Failed to delete invite'
			});
		}
	}

	function formatExpiryTime(expiresAt: string | null): string {
		if (!expiresAt) return 'Never';
		const date = new Date(expiresAt);
		const now = new Date();
		const diffMs = date.getTime() - now.getTime();

		if (diffMs <= 0) return 'Expired';

		const diffMins = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays > 0) return `${diffDays}d`;
		if (diffHours > 0) return `${diffHours}h`;
		if (diffMins > 0) return `${diffMins}m`;
		return 'Soon';
	}

	function isExpired(invite: CommunityInvite): boolean {
		if (!invite.expiresAt) return false;
		return new Date(invite.expiresAt).getTime() < Date.now();
	}

	function isMaxedOut(invite: CommunityInvite): boolean {
		if (!invite.maxUses) return false;
		return invite.useCount >= invite.maxUses;
	}
</script>

<div class="flex-1 min-h-0 overflow-y-auto bg-background">
	<div class="max-w-7xl mx-auto px-6 py-6 md:px-8 md:py-8">
		<div class="flex items-center justify-between mb-6">
			<h1 class="text-2xl font-bold text-text-primary">Community Settings</h1>
			<Button variant="ghost" onclick={handleClose}>Back</Button>
		</div>
		<div class="flex gap-6">
		<!-- Tabs -->
		<div class="w-40 space-y-1">
			<button
				onclick={() => activeTab = 'overview'}
				class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'overview' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
			>
				<SettingsIcon size={16} class="inline-block mr-2" />
				Overview
			</button>
			<button
				onclick={() => activeTab = 'members'}
				class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'members' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
			>
				<Users size={16} class="inline-block mr-2" />
				Members
			</button>
			<button
				onclick={() => activeTab = 'roles'}
				class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'roles' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
			>
				<Crown size={16} class="inline-block mr-2" />
				Roles
			</button>
			<button
				onclick={() => activeTab = 'invites'}
				class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'invites' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
			>
				<Users size={16} class="inline-block mr-2" />
				Invites
			</button>
			<button
				onclick={() => activeTab = 'emojis'}
				class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'emojis' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
			>
				<Smile size={16} class="inline-block mr-2" />
				Emojis
			</button>
			<button
				onclick={() => activeTab = 'plugins'}
				class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'plugins' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
			>
				<Puzzle size={16} class="inline-block mr-2" />
				Plugins
			</button>
			{#if canModerate}
				<div class="pt-3 mt-3 border-t border-border">
					<p class="px-3 pb-1.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Moderation</p>
					<button
						onclick={() => activeTab = 'bans'}
						class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'bans' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
					>
						<Gavel size={16} class="inline-block mr-2" />
						Bans
					</button>
					<button
						onclick={() => activeTab = 'audit-log'}
						class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'audit-log' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
					>
						<ScrollText size={16} class="inline-block mr-2" />
						Audit Log
					</button>
				</div>
			{/if}
		</div>

		<!-- Content -->
		<div class="flex-1">
			{#if activeTab === 'overview'}
				<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
					<!-- Icon -->
					<div class="flex items-center gap-4">
						<input
							bind:this={fileInputRef}
							type="file"
							accept="image/*"
							onchange={handleIconSelect}
							class="hidden"
						/>

						{#if iconPreview}
							<div class="relative">
								<img
									src={iconPreview}
									alt="Community icon"
									class="w-20 h-20 rounded-xl object-cover"
								/>
								{#if isOwner}
									<button
										type="button"
										onclick={removeIcon}
										class="absolute -top-1 -right-1 w-5 h-5 bg-error text-white rounded-full flex items-center justify-center"
										aria-label="Remove icon"
									>
										<X size={12} />
									</button>
								{/if}
							</div>
						{:else}
							<button
								type="button"
								onclick={() => fileInputRef?.click()}
								disabled={!isOwner}
								class="w-20 h-20 rounded-xl border-2 border-dashed border-border hover:border-primary flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<Image size={24} class="text-text-muted" />
								<span class="text-xs text-text-muted">Upload</span>
							</button>
						{/if}

						<div>
							<p class="text-sm text-text-secondary">Community Icon</p>
							<p class="text-xs text-text-muted">Recommended size: 256x256</p>
							{#if errors.icon}
								<p class="text-xs text-error mt-1">{errors.icon}</p>
							{/if}
						</div>
					</div>

					<Input
						label="Community Name"
						bind:value={name}
						placeholder="My Awesome Community"
						error={errors.name}
						required
						maxlength={100}
						disabled={!isOwner}
					/>

					<Textarea
						label="Description"
						bind:value={description}
						placeholder="What's your community about?"
						rows={3}
						maxlength={500}
						error={errors.description}
						disabled={!isOwner}
					/>

					{#if isOwner}
						<label class="flex items-center gap-3 cursor-pointer">
							<div class="relative">
								<input
									type="checkbox"
									bind:checked={isPrivate}
									class="sr-only peer"
								/>
								<div class="w-10 h-6 bg-surface-hover rounded-full peer-checked:bg-primary transition-colors"></div>
								<div class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
							</div>
							<div>
								<p class="text-sm text-text-primary">Private Community</p>
								<p class="text-xs text-text-muted">Only people with an invite can join</p>
							</div>
						</label>
					{/if}

					{#if errors.submit}
						<p class="text-sm text-error">{errors.submit}</p>
					{/if}

					{#if isOwner}
						<div class="flex justify-between pt-4">
							<Button variant="danger" onclick={handleDeleteCommunity}>
								<Trash size={16} />
								Delete Community
							</Button>
							<Button type="submit" disabled={isSubmitting}>
								{#if isSubmitting}
									<Spinner size="sm" />
									Saving...
								{:else}
									Save Changes
								{/if}
							</Button>
						</div>
					{:else}
						<div class="pt-4">
							<Button variant="danger" onclick={handleLeaveCommunity}>
								Leave Community
							</Button>
						</div>
					{/if}
				</form>
			{:else if activeTab === 'members'}
				<div class="space-y-4">
					<div>
						<h3 class="text-lg font-semibold text-text-primary">Members</h3>
						<p class="text-sm text-text-muted">Assign roles to members in this community</p>
					</div>

					{#if isLoadingMembers}
						<div class="flex justify-center py-8">
							<Spinner size="lg" />
						</div>
					{:else}
						<div class="grid grid-cols-[220px_1fr] gap-4">
							<div class="bg-surface-hover rounded-lg border border-border overflow-hidden">
								<div class="px-3 py-2 text-xs uppercase tracking-wide text-text-muted border-b border-border">
									Members
								</div>
								<div class="max-h-96 overflow-y-auto">
									{#if $activeCommunityMembers.length === 0}
										<p class="text-sm text-text-muted px-3 py-4">No members found</p>
									{:else}
										{#each $activeCommunityMembers as member (member.userId)}
											<button
												class="w-full text-left px-3 py-2 text-sm transition-colors {selectedMemberId === member.userId ? 'bg-surface text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
												onclick={() => selectMember(member)}
											>
												<span class="truncate">{getMemberLabel(member)}</span>
											</button>
										{/each}
									{/if}
								</div>
							</div>

							<div class="bg-surface-hover rounded-lg border border-border p-4">
								{#if !selectedMemberId}
									<p class="text-sm text-text-muted">Select a member to edit roles.</p>
								{:else}
									{@const selectedMember = $activeCommunityMembers.find((m) => m.userId === selectedMemberId)}
									{@const memberDisplayName = getMemberLabel(selectedMember || { userId: '', communityId: '', nickname: null, joinedAt: '', roles: [] })}
									{@const isTargetOwner = $activeCommunity?.ownerId === selectedMemberId}
									{@const isSelf = selectedMemberId === $currentUserId}
									<div class="flex items-center justify-between mb-3">
										<div>
											<p class="text-sm font-semibold text-text-primary">Roles</p>
											<p class="text-xs text-text-muted">Changes apply immediately</p>
										</div>
										<Button size="sm" onclick={saveMemberRoles} disabled={isUpdatingMemberRoles}>
											{#if isUpdatingMemberRoles}
												<Spinner size="sm" />
												Saving...
											{:else}
												Save Roles
											{/if}
										</Button>
									</div>
									<div class="space-y-2">
										{#each roles as role (role.id)}
											{#if !role.isDefault}
												<label class="flex items-center gap-2 text-sm text-text-primary">
													<input
														type="checkbox"
														value={role.id}
														checked={selectedMemberRoleIds.includes(role.id)}
														onchange={(e) => {
															const checked = (e.target as HTMLInputElement).checked;
															selectedMemberRoleIds = checked
																? [...selectedMemberRoleIds, role.id]
																: selectedMemberRoleIds.filter((id) => id !== role.id);
														}}
													/>
													<span
														class="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs"
														style={role.color ? `background: ${role.color}1a; color: ${role.color}` : undefined}
													>
														<span
															class="h-2 w-2 rounded-full"
															style={role.color ? `background: ${role.color}` : 'background: var(--text-muted)'}
														></span>
														{role.name}
													</span>
												</label>
											{/if}
										{/each}
									</div>

									<!-- Moderation actions for this member -->
									{#if !isTargetOwner && !isSelf && (isOwner || memberHasPermission(currentMember, Permission.KickMembers) || memberHasPermission(currentMember, Permission.BanMembers))}
										<div class="mt-4 pt-4 border-t border-border space-y-2">
											<p class="text-xs uppercase tracking-wide text-text-muted mb-2">Moderation</p>
											<div class="flex gap-2">
												{#if isOwner || memberHasPermission(currentMember, Permission.KickMembers)}
													<Button
														variant="ghost"
														size="sm"
														onclick={() => handleKick(selectedMemberId!, memberDisplayName)}
													>
														<UserX size={14} />
														Kick
													</Button>
												{/if}
												{#if isOwner || memberHasPermission(currentMember, Permission.BanMembers)}
													<Button
														variant="danger"
														size="sm"
														onclick={() => openBanModal(selectedMemberId!)}
													>
														<Gavel size={14} />
														Ban
													</Button>
												{/if}
											</div>
										</div>
									{/if}
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{:else if activeTab === 'roles'}
				<div class="space-y-4">
					<div>
						<h3 class="text-lg font-semibold text-text-primary">Roles</h3>
						<p class="text-sm text-text-muted">Create roles and edit permissions for this community</p>
					</div>

					<div class="grid grid-cols-[240px_1fr] gap-4">
						<div class="bg-surface-hover rounded-lg border border-border overflow-hidden">
							<div class="px-3 py-2 text-xs uppercase tracking-wide text-text-muted border-b border-border">
								Roles
							</div>
							<div class="max-h-96 overflow-y-auto">
								{#if isLoadingRoles}
									<div class="flex justify-center py-6">
										<Spinner size="sm" />
									</div>
								{:else if roles.length === 0}
									<p class="text-sm text-text-muted px-3 py-4">No roles yet</p>
								{:else}
									{#each roles as role (role.id)}
										<button
											class="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors {selectedRoleId === role.id ? 'bg-surface text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
											onclick={() => selectRole(role)}
										>
											<span
												class="h-2.5 w-2.5 rounded-full"
												style={role.color ? `background: ${role.color}` : 'background: var(--text-muted)'}
											></span>
											<span class="truncate">{role.name}</span>
											{#if role.isDefault}
												<span class="ml-auto text-[10px] text-text-muted uppercase">Default</span>
											{/if}
										</button>
									{/each}
								{/if}
							</div>
							<div class="border-t border-border p-3">
								<div class="space-y-2">
									<Input label="New Role" bind:value={newRoleName} placeholder="Role name" />
									<div class="flex items-center gap-2">
										<input type="color" bind:value={newRoleColor} class="h-9 w-10 rounded border border-border bg-transparent" />
										<Button size="sm" onclick={createRole} disabled={isCreatingRole || !newRoleName.trim()}>
											{#if isCreatingRole}
												<Spinner size="sm" />
												Creating...
											{:else}
												Create
											{/if}
										</Button>
									</div>
								</div>
							</div>
						</div>

						<div class="bg-surface-hover rounded-lg border border-border p-4">
							{#if !selectedRoleId}
								<p class="text-sm text-text-muted">Select a role to edit its settings.</p>
							{:else}
								<div class="flex items-center justify-between mb-4">
									<h4 class="text-sm font-semibold text-text-primary">Role Settings</h4>
									<div class="flex items-center gap-2">
										<Button size="sm" onclick={saveRole} disabled={isSavingRole}>
											{#if isSavingRole}
												<Spinner size="sm" />
												Saving...
											{:else}
												Save
											{/if}
										</Button>
										<Button
											variant="ghost"
											onclick={() => {
												const role = roles.find((r) => r.id === selectedRoleId);
												if (role) deleteRole(role);
											}}
											disabled={isDeletingRole || !!roles.find((r) => r.id === selectedRoleId)?.isDefault}
										>
											Delete
										</Button>
									</div>
								</div>

								<div class="grid grid-cols-2 gap-4">
									<Input label="Role Name" bind:value={roleDraft.name} />
									<div>
										<label for="role-color" class="text-sm text-text-muted">Color</label>
										<div class="flex items-center gap-2 mt-1">
											<input id="role-color" type="color" bind:value={roleDraft.color} class="h-9 w-12 rounded border border-border bg-transparent" />
											<Input bind:value={roleDraft.color} />
										</div>
									</div>
								</div>

								<div class="mt-4">
									<h5 class="text-sm font-semibold text-text-primary mb-2">Permissions</h5>
									<div class="grid grid-cols-2 gap-2">
										{#each permissionOptions as option}
											<label class="flex items-center gap-2 text-sm text-text-primary">
												<input
													type="checkbox"
													checked={(roleDraft.permissions & option.value) !== 0}
													onchange={() => togglePermission(option.value)}
												/>
												<span>{option.label}</span>
											</label>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					</div>
				</div>
			{:else if activeTab === 'invites'}
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<div>
							<h3 class="text-lg font-semibold text-text-primary">Invite Links</h3>
							<p class="text-sm text-text-muted">Create and manage invite links for your community</p>
						</div>
						{#if !showCreateInviteForm}
							<Button onclick={() => showCreateInviteForm = true} size="sm">
								<Plus size={16} />
								Create Invite
							</Button>
						{/if}
					</div>

					<!-- Create Invite Form -->
					{#if showCreateInviteForm}
						<div class="bg-surface-hover rounded-lg p-4 space-y-4">
							<h4 class="font-medium text-text-primary">New Invite Link</h4>

							<div class="grid grid-cols-2 gap-4">
								<div>
									<label for="invite-expiry" class="block text-sm text-text-muted mb-1">Expire After</label>
									<select
										id="invite-expiry"
										bind:value={newInviteExpiry}
										class="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary"
									>
										<option value="30m">30 minutes</option>
										<option value="1h">1 hour</option>
										<option value="6h">6 hours</option>
										<option value="12h">12 hours</option>
										<option value="1d">1 day</option>
										<option value="7d">7 days</option>
										<option value="never">Never</option>
									</select>
								</div>

								<div>
									<label for="invite-max-uses" class="block text-sm text-text-muted mb-1">Max Uses</label>
									<select
										id="invite-max-uses"
										bind:value={newInviteMaxUses}
										class="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary"
									>
										<option value={null}>No limit</option>
										<option value={1}>1 use</option>
										<option value={5}>5 uses</option>
										<option value={10}>10 uses</option>
										<option value={25}>25 uses</option>
										<option value={50}>50 uses</option>
										<option value={100}>100 uses</option>
									</select>
								</div>
							</div>

							<div class="flex justify-end gap-2">
								<Button variant="ghost" onclick={() => showCreateInviteForm = false}>
									Cancel
								</Button>
								<Button onclick={generateInvite} disabled={isGeneratingInvite}>
									{#if isGeneratingInvite}
										<Spinner size="sm" />
										Creating...
									{:else}
										Generate Link
									{/if}
								</Button>
							</div>
						</div>
					{/if}

					<!-- Invites List -->
					{#if isLoadingInvites}
						<div class="flex justify-center py-8">
							<Spinner size="lg" />
						</div>
					{:else if invites === null || invites.length === 0}
						<div class="text-center py-8 text-text-muted">
							<Link size={32} class="mx-auto mb-2 opacity-50" />
							<p>No invite links yet</p>
							<p class="text-sm">Create an invite link to share with others</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each invites as invite (invite.id)}
								{@const expired = isExpired(invite)}
								{@const maxedOut = isMaxedOut(invite)}
								{@const invalid = expired || maxedOut}
								<div class="flex items-center justify-between p-3 bg-surface-hover rounded-lg {invalid ? 'opacity-50' : ''}">
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2">
											<code class="text-sm font-mono text-text-primary">{invite.code}</code>
											{#if expired}
												<span class="text-xs px-2 py-0.5 rounded bg-error/10 text-error">Expired</span>
											{:else if maxedOut}
												<span class="text-xs px-2 py-0.5 rounded bg-warning/10 text-warning">Max uses reached</span>
											{/if}
										</div>
										<div class="flex items-center gap-3 text-xs text-text-muted mt-1">
											<span class="flex items-center gap-1">
												<Users size={12} />
												{invite.useCount}{invite.maxUses ? ` / ${invite.maxUses}` : ''} uses
											</span>
											<span class="flex items-center gap-1">
												<Clock size={12} />
												{formatExpiryTime(invite.expiresAt)}
											</span>
										</div>
									</div>
									<div class="flex items-center gap-1 ml-2">
										<Button
											variant="ghost"
											size="sm"
											onclick={() => copyInviteLink(invite.code)}
											disabled={invalid}
										>
											<Copy size={16} />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onclick={() => deleteInvite(invite.id)}
										>
											<Trash size={16} class="text-error" />
										</Button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else if activeTab === 'emojis'}
				<div class="space-y-4">
					<div>
						<h3 class="text-lg font-semibold text-text-primary">Custom Emojis</h3>
						<p class="text-sm text-text-muted">Upload custom emojis for your community. Members can use them anywhere.</p>
					</div>

					<!-- Upload form -->
					<div class="bg-surface-hover rounded-lg p-4 space-y-3">
						<h4 class="font-medium text-text-primary text-sm">Upload Emoji</h4>
						<div class="flex items-end gap-3">
							<div class="shrink-0">
								<button
									onclick={() => emojiFileInputRef?.click()}
									class="w-16 h-16 rounded-lg border-2 border-dashed border-border hover:border-primary flex items-center justify-center transition-colors bg-surface overflow-hidden"
								>
									{#if newEmojiPreview}
										<img src={newEmojiPreview} alt="Preview" class="w-12 h-12 object-contain" />
									{:else}
										<Plus size={20} class="text-text-muted" />
									{/if}
								</button>
								<input
									bind:this={emojiFileInputRef}
									type="file"
									accept="image/png,image/jpeg,image/gif,image/webp"
									onchange={handleEmojiFileSelect}
									class="hidden"
								/>
							</div>
							<div class="flex-1">
								<label for="emoji-name" class="block text-xs text-text-muted mb-1">Name</label>
								<Input
									id="emoji-name"
									bind:value={newEmojiName}
									placeholder="emoji_name"
									maxlength={32}
								/>
								<p class="text-xs text-text-muted mt-1">2-32 characters, letters, numbers, and underscores only</p>
							</div>
							<Button
								onclick={uploadEmoji}
								disabled={isUploadingEmoji || !newEmojiFile || !newEmojiName.trim()}
								size="sm"
							>
								{#if isUploadingEmoji}
									<Spinner size="sm" />
								{:else}
									Upload
								{/if}
							</Button>
						</div>
					</div>

					<!-- Emoji list -->
					{#if isLoadingEmojis}
						<div class="flex justify-center py-8">
							<Spinner />
						</div>
					{:else if communityEmojis.length === 0}
						<div class="text-center py-8 text-text-muted">
							<Smile size={32} class="mx-auto mb-2 opacity-50" />
							<p>No custom emojis yet</p>
						</div>
					{:else}
						<div class="text-xs text-text-muted">{communityEmojis.length} / 200 emoji slots used</div>
						<div class="grid gap-2">
							{#each communityEmojis as emoji (emoji.id)}
								<div class="flex items-center gap-3 bg-surface rounded-lg px-3 py-2 border border-border group">
									<img src={emoji.imageUrl} alt={emoji.name} class="w-8 h-8 object-contain shrink-0" />
									{#if editingEmojiId === emoji.id}
										<div class="flex-1 flex items-center gap-2">
											<Input
												bind:value={editingEmojiName}
												class="text-sm"
												onkeydown={(e: KeyboardEvent) => {
													if (e.key === 'Enter') saveEmojiName(emoji.id);
													if (e.key === 'Escape') cancelEditEmoji();
												}}
											/>
											<Button size="sm" onclick={() => saveEmojiName(emoji.id)}>Save</Button>
											<Button size="sm" variant="ghost" onclick={cancelEditEmoji}>Cancel</Button>
										</div>
									{:else}
										<span class="flex-1 text-sm text-text-primary font-medium">:{emoji.name}:</span>
										<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
											<button
												onclick={() => startEditEmoji(emoji)}
												class="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
												aria-label="Rename emoji"
											>
												<Pencil size={14} />
											</button>
											<button
												onclick={() => deleteEmoji(emoji.id, emoji.name)}
												class="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-error transition-colors"
												aria-label="Delete emoji"
											>
												<Trash size={14} />
											</button>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else if activeTab === 'plugins'}
				{#if $activeCommunity}
					<PluginSettings communityId={$activeCommunity.id} />
				{/if}

			{:else if activeTab === 'bans'}
				<div class="space-y-4">
					<div>
						<h3 class="text-lg font-semibold text-text-primary">Bans</h3>
						<p class="text-sm text-text-muted">View and manage banned users</p>
					</div>

					{#if isLoadingBans}
						<div class="flex justify-center py-8">
							<Spinner size="lg" />
						</div>
					{:else if !bans || bans.length === 0}
						<div class="text-center py-8 text-text-muted">
							<Gavel size={32} class="mx-auto mb-2 opacity-50" />
							<p>No banned users</p>
							<p class="text-sm">Banned users will appear here</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each bans as ban (ban.id)}
								<div class="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
									<div class="flex items-center gap-3 min-w-0">
										{#if ban.user?.avatarUrl}
											<img src={ban.user.avatarUrl} alt="" class="w-9 h-9 rounded-full object-cover shrink-0" />
										{:else}
											<div class="w-9 h-9 rounded-full bg-surface flex items-center justify-center shrink-0">
												<UserX size={16} class="text-text-muted" />
											</div>
										{/if}
										<div class="min-w-0">
											<p class="text-sm font-medium text-text-primary truncate">
												{ban.user?.displayName || ban.user?.username || 'Unknown User'}
											</p>
											<div class="flex items-center gap-2 text-xs text-text-muted">
												{#if ban.reason}
													<span class="truncate max-w-50" title={ban.reason}>Reason: {ban.reason}</span>
													<span>&middot;</span>
												{/if}
												<span>by {ban.bannedByUser?.displayName || ban.bannedByUser?.username || 'Unknown'}</span>
												<span>&middot;</span>
												<span>{formatRelativeTime(ban.createdAt)}</span>
											</div>
										</div>
									</div>
									<Button
										variant="ghost"
										size="sm"
										onclick={() => {
											if (confirm(`Unban ${ban.user?.displayName || ban.user?.username || 'this user'}?`)) {
												handleUnban(ban.userId);
											}
										}}
									>
										Unban
									</Button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else if activeTab === 'audit-log'}
				<div class="space-y-4">
					<div>
						<h3 class="text-lg font-semibold text-text-primary">Audit Log</h3>
						<p class="text-sm text-text-muted">Review all actions taken in this community</p>
					</div>

					{#if isLoadingAuditLog}
						<div class="flex justify-center py-8">
							<Spinner size="lg" />
						</div>
					{:else if !auditLogs || auditLogs.length === 0}
						<div class="text-center py-8 text-text-muted">
							<ScrollText size={32} class="mx-auto mb-2 opacity-50" />
							<p>No audit log entries</p>
							<p class="text-sm">Actions taken in this community will appear here</p>
						</div>
					{:else}
						<div class="space-y-1">
							{#each auditLogs as entry (entry.id)}
								<div class="flex items-start gap-3 p-3 bg-surface-hover rounded-lg">
									{#if entry.actor?.avatarUrl}
										<img src={entry.actor.avatarUrl} alt="" class="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5" />
									{:else}
										<div class="w-8 h-8 rounded-full bg-surface flex items-center justify-center shrink-0 mt-0.5">
											<Users size={14} class="text-text-muted" />
										</div>
									{/if}
									<div class="min-w-0 flex-1">
										<p class="text-sm text-text-primary">
											<span class="font-medium">{entry.actor?.displayName || entry.actor?.username || 'Unknown'}</span>
											<span class="text-text-muted ml-1">{formatAuditAction(entry.action)}</span>
										</p>
										{#if entry.details}
											{@const parsed = parseDetails(entry.details)}
											{#if parsed}
												<p class="text-xs text-text-muted mt-0.5">
													{#if parsed.reason}
														Reason: {parsed.reason}
													{:else if parsed.name}
														{parsed.name}
													{:else if parsed.field}
														{parsed.field}{parsed.action ? ` (${parsed.action})` : ''}
													{/if}
												</p>
											{/if}
										{/if}
									</div>
									<span class="text-xs text-text-muted shrink-0">{formatRelativeTime(entry.createdAt)}</span>
								</div>
							{/each}
						</div>

						<!-- Pagination -->
						{#if auditLogTotal > 50}
							<div class="flex justify-center gap-2 pt-4">
								<Button
									variant="ghost"
									size="sm"
									disabled={auditLogPage <= 1}
									onclick={() => loadAuditLog(auditLogPage - 1)}
								>
									Previous
								</Button>
								<span class="text-sm text-text-muted py-1.5 px-2">
									Page {auditLogPage} of {Math.ceil(auditLogTotal / 50)}
								</span>
								<Button
									variant="ghost"
									size="sm"
									disabled={auditLogPage >= Math.ceil(auditLogTotal / 50)}
									onclick={() => loadAuditLog(auditLogPage + 1)}
								>
									Next
								</Button>
							</div>
						{/if}
					{/if}
				</div>
			{/if}
		</div>
		</div>
	</div>
</div>

<!-- Ban confirmation modal -->
{#if showBanModal}
	<div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" role="dialog">
		<div class="bg-surface rounded-xl p-6 w-full max-w-md shadow-xl border border-border">
			<h3 class="text-lg font-semibold text-text-primary mb-2">Ban Member</h3>
			<p class="text-sm text-text-muted mb-4">This will remove the user from the community and prevent them from rejoining.</p>

			<div class="mb-4">
				<label for="ban-reason" class="block text-sm text-text-muted mb-1">Reason (optional)</label>
				<Textarea
					id="ban-reason"
					bind:value={banReasonInput}
					placeholder="Why is this user being banned?"
					rows={3}
					maxlength={512}
				/>
			</div>

			<div class="flex justify-end gap-2">
				<Button variant="ghost" onclick={closeBanModal}>Cancel</Button>
				<Button variant="danger" onclick={confirmBan} disabled={isProcessingBan}>
					{#if isProcessingBan}
						<Spinner size="sm" />
						Banning...
					{:else}
						Ban Member
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/if}
