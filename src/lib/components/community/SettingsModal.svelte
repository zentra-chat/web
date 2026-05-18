<script lang="ts">
	import { Lock, Unlock, Plus, Trash2 } from 'lucide-svelte';
	import { api } from '$lib/api';
	import { Permission } from '$lib/stores/community';
	import { addToast } from '$lib/stores/ui';
	import { Button, Modal, Select, Spinner } from '$lib/components/ui';
	import type { Channel, ChannelPermission, CommunityMember, Role } from '$lib/types';

	type TargetType = 'role' | 'member';
	type PermissionState = 'inherit' | 'allow' | 'deny';

	interface Props {
		isOpen: boolean;
		channel: Channel | null;
		onclose: () => void;
	}

	interface PermissionOption {
		label: string;
		description: string;
		bit: number;
	}

	interface SelectOption {
		value: string;
		label: string;
	}

	let { isOpen, channel, onclose }: Props = $props();

	const targetTypeOptions: SelectOption[] = [
		{ value: 'role', label: 'Role' },
		{ value: 'member', label: 'Member' }
	];

	const permissionOptions: PermissionOption[] = [
		{ label: 'View Channel', description: 'Can view this channel', bit: Permission.ViewChannels },
		{ label: 'Send Messages', description: 'Can send text messages', bit: Permission.SendMessages },
		{ label: 'Attach Files', description: 'Can upload files and images', bit: Permission.AttachFiles },
		{ label: 'Add Reactions', description: 'Can add emoji reactions', bit: Permission.AddReactions },
		{ label: 'Mention Everyone', description: 'Can use @everyone and @here', bit: Permission.MentionEveryone },
		{ label: 'Manage Messages', description: 'Can delete and moderate messages', bit: Permission.ManageMessages },
		{ label: 'Pin Messages', description: 'Can pin and unpin messages', bit: Permission.PinMessages },
		{ label: 'Manage Webhooks', description: 'Can create and manage webhooks', bit: Permission.ManageWebhooks },
		{ label: 'Voice Connect', description: 'Can join this voice channel', bit: Permission.VoiceConnect },
		{ label: 'Voice Speak', description: 'Can speak in this voice channel', bit: Permission.VoiceSpeak }
	];

	let overwrites = $state<ChannelPermission[]>([]);
	let roles = $state<Role[]>([]);
	let members = $state<CommunityMember[]>([]);
	let isLoading = $state(false);
	let isTogglingPrivate = $state(false);
	let isAddingOverwrite = $state(false);
	let isSavingOverwrite = $state(false);
	let isDeletingOverwrite = $state(false);

	let addTargetType = $state<TargetType>('role');
	let addTargetId = $state('');

	let selectedOverwriteKey = $state<string | null>(null);
	let editAllowPermissions = $state(0);
	let editDenyPermissions = $state(0);
	let loadedChannelId = $state<string | null>(null);

	let defaultRole = $derived.by(() => roles.find((role) => role.isDefault) || null);
	let defaultRoleOverwrite = $derived.by(() => {
		if (!defaultRole) return null;
		return (
			overwrites.find(
				(overwrite) => overwrite.targetType === 'role' && overwrite.targetId === defaultRole.id
			) || null
		);
	});

	let isPrivateChannel = $derived.by(() => {
		if (!defaultRoleOverwrite) return false;
		const denied = (defaultRoleOverwrite.denyPermissions & Permission.ViewChannels) !== 0;
		const allowed = (defaultRoleOverwrite.allowPermissions & Permission.ViewChannels) !== 0;
		return denied && !allowed;
	});

	let roleTargetOptions = $derived.by<SelectOption[]>(() => {
		const sorted = [...roles].sort((a, b) => b.position - a.position);
		return sorted.map((role) => ({
			value: role.id,
			label: role.isDefault ? `${role.name} (default role)` : role.name
		}));
	});

	let memberTargetOptions = $derived.by<SelectOption[]>(() => {
		return members
			.map((member) => ({
				value: member.userId,
				label: getMemberLabel(member)
			}))
			.sort((a, b) => a.label.localeCompare(b.label));
	});

	let availableTargetOptions = $derived.by<SelectOption[]>(() => {
		const source = addTargetType === 'role' ? roleTargetOptions : memberTargetOptions;
		return source.filter((option) => !hasOverwrite(addTargetType, option.value));
	});

	let selectedOverwrite = $derived.by(() => {
		if (!selectedOverwriteKey) return null;
		return overwrites.find((overwrite) => getOverwriteKey(overwrite) === selectedOverwriteKey) || null;
	});

	let hasPendingOverwriteChanges = $derived.by(() => {
		if (!selectedOverwrite) return false;
		return (
			selectedOverwrite.allowPermissions !== editAllowPermissions ||
			selectedOverwrite.denyPermissions !== editDenyPermissions
		);
	});

	$effect(() => {
		if (!isOpen || !channel) return;
		if (loadedChannelId === channel.id) return;

		loadedChannelId = channel.id;
		void loadChannelSettings(channel);
	});

	$effect(() => {
		if (!selectedOverwrite) {
			editAllowPermissions = 0;
			editDenyPermissions = 0;
			return;
		}

		editAllowPermissions = selectedOverwrite.allowPermissions;
		editDenyPermissions = selectedOverwrite.denyPermissions;
	});

	$effect(() => {
		const options = availableTargetOptions;
		if (options.length === 0) {
			addTargetId = '';
			return;
		}

		if (!options.some((option) => option.value === addTargetId)) {
			addTargetId = options[0].value;
		}
	});

	$effect(() => {
		if (isOpen) return;
		loadedChannelId = null;
		selectedOverwriteKey = null;
		addTargetType = 'role';
		addTargetId = '';
	});

	function getOverwriteKey(overwrite: ChannelPermission): string {
		return `${overwrite.targetType}:${overwrite.targetId}`;
	}

	function hasOverwrite(targetType: TargetType, targetId: string): boolean {
		return overwrites.some(
			(overwrite) => overwrite.targetType === targetType && overwrite.targetId === targetId
		);
	}

	function ensureSelectedOverwrite(): void {
		if (
			selectedOverwriteKey &&
			overwrites.some((overwrite) => getOverwriteKey(overwrite) === selectedOverwriteKey)
		) {
			return;
		}

		selectedOverwriteKey = overwrites.length > 0 ? getOverwriteKey(overwrites[0]) : null;
	}

	function getRoleName(roleId: string): string {
		const role = roles.find((item) => item.id === roleId);
		if (!role) return `Unknown role (${shortId(roleId)})`;
		return role.isDefault ? `${role.name} (default role)` : role.name;
	}

	function getMemberLabel(member: CommunityMember): string {
		if (member.user) {
			return member.user.displayName || member.user.username;
		}
		return `Member ${shortId(member.userId)}`;
	}

	function getMemberName(memberID: string): string {
		const member = members.find((item) => item.userId === memberID);
		if (!member) return `Unknown member (${shortId(memberID)})`;
		return getMemberLabel(member);
	}

	function getOverwriteLabel(overwrite: ChannelPermission): string {
		if (overwrite.targetType === 'role') {
			return getRoleName(overwrite.targetId);
		}
		return getMemberName(overwrite.targetId);
	}

	function shortId(value: string): string {
		if (value.length <= 10) return value;
		return `${value.slice(0, 4)}...${value.slice(-4)}`;
	}

	function countBits(mask: number): number {
		let count = 0;
		let value = mask >>> 0;
		while (value > 0) {
			count += value & 1;
			value >>>= 1;
		}
		return count;
	}

	function getPermissionState(bit: number): PermissionState {
		if ((editAllowPermissions & bit) !== 0) return 'allow';
		if ((editDenyPermissions & bit) !== 0) return 'deny';
		return 'inherit';
	}

	function setPermissionState(bit: number, state: PermissionState): void {
		if (state === 'allow') {
			editAllowPermissions |= bit;
			editDenyPermissions &= ~bit;
			return;
		}

		if (state === 'deny') {
			editDenyPermissions |= bit;
			editAllowPermissions &= ~bit;
			return;
		}

		editAllowPermissions &= ~bit;
		editDenyPermissions &= ~bit;
	}

	async function loadOverwrites(channelId: string): Promise<void> {
		overwrites = (await api.getChannelPermissions(channelId)) || [];
		ensureSelectedOverwrite();
	}

	async function loadChannelSettings(targetChannel: Channel): Promise<void> {
		isLoading = true;
		try {
			const [fetchedRoles, fetchedMembers, fetchedOverwrites] = await Promise.all([
				api.getRoles(targetChannel.communityId),
				api.getCommunityMembers(targetChannel.communityId),
				api.getChannelPermissions(targetChannel.id)
			]);

			roles = fetchedRoles || [];
			members = fetchedMembers || [];
			overwrites = fetchedOverwrites || [];
			ensureSelectedOverwrite();
		} catch (err) {
			console.error('Failed to load channel settings data:', err);
			addToast({ type: 'error', message: 'Failed to load channel permissions' });
		} finally {
			isLoading = false;
		}
	}

	async function togglePrivateChannel(nextValue: boolean): Promise<void> {
		if (!channel) return;
		if (!defaultRole) {
			addToast({ type: 'error', message: 'Default role not found for this community' });
			return;
		}

		isTogglingPrivate = true;
		try {
			const current = defaultRoleOverwrite;
			let allowPermissions = current?.allowPermissions ?? 0;
			let denyPermissions = current?.denyPermissions ?? 0;

			if (nextValue) {
				denyPermissions |= Permission.ViewChannels;
				allowPermissions &= ~Permission.ViewChannels;
			} else {
				denyPermissions &= ~Permission.ViewChannels;
			}

			if (!nextValue && current && allowPermissions === 0 && denyPermissions === 0) {
				await api.deleteChannelPermission(channel.id, 'role', defaultRole.id);
			} else {
				await api.setChannelPermission(channel.id, {
					targetType: 'role',
					targetId: defaultRole.id,
					allowPermissions,
					denyPermissions
				});
			}

			await loadOverwrites(channel.id);
			addToast({
				type: 'success',
				message: nextValue ? 'Channel is now private' : 'Channel is now visible to everyone'
			});
		} catch (err) {
			console.error('Failed to toggle private channel state:', err);
			addToast({ type: 'error', message: 'Failed to update private channel setting' });
		} finally {
			isTogglingPrivate = false;
		}
	}

	async function addOverwrite(): Promise<void> {
		if (!channel || !addTargetId || isAddingOverwrite) return;

		isAddingOverwrite = true;
		try {
			await api.setChannelPermission(channel.id, {
				targetType: addTargetType,
				targetId: addTargetId,
				allowPermissions: 0,
				denyPermissions: 0
			});

			await loadOverwrites(channel.id);
			selectedOverwriteKey = `${addTargetType}:${addTargetId}`;
			addToast({ type: 'success', message: 'Permission override added' });
		} catch (err) {
			console.error('Failed to add permission override:', err);
			addToast({ type: 'error', message: 'Failed to add permission override' });
		} finally {
			isAddingOverwrite = false;
		}
	}

	async function saveSelectedOverwrite(): Promise<void> {
		if (!channel || !selectedOverwrite || !hasPendingOverwriteChanges || isSavingOverwrite) return;

		isSavingOverwrite = true;
		try {
			await api.setChannelPermission(channel.id, {
				targetType: selectedOverwrite.targetType,
				targetId: selectedOverwrite.targetId,
				allowPermissions: editAllowPermissions,
				denyPermissions: editDenyPermissions
			});

			await loadOverwrites(channel.id);
			addToast({ type: 'success', message: 'Channel permissions updated' });
		} catch (err) {
			console.error('Failed to save channel permission override:', err);
			addToast({ type: 'error', message: 'Failed to save channel permissions' });
		} finally {
			isSavingOverwrite = false;
		}
	}

	async function deleteSelectedOverwrite(): Promise<void> {
		if (!channel || !selectedOverwrite || isDeletingOverwrite) return;

		isDeletingOverwrite = true;
		try {
			await api.deleteChannelPermission(
				channel.id,
				selectedOverwrite.targetType,
				selectedOverwrite.targetId
			);
			await loadOverwrites(channel.id);
			addToast({ type: 'success', message: 'Permission override removed' });
		} catch (err) {
			console.error('Failed to remove channel permission override:', err);
			addToast({ type: 'error', message: 'Failed to remove permission override' });
		} finally {
			isDeletingOverwrite = false;
		}
	}
</script>

<Modal
	isOpen={isOpen}
	onclose={onclose}
	title={channel ? `Channel Settings · #${channel.name}` : 'Channel Settings'}
	size="md"
>
	{#if !channel}
		<p class="text-sm text-text-muted">Select a channel to edit settings.</p>
	{:else if isLoading}
		<div class="flex items-center justify-center py-10">
			<Spinner size="sm" />
		</div>
	{:else}
		<div class="space-y-5">
			<section class="rounded-lg border border-border bg-background p-4">
				<div class="flex items-center justify-between gap-4">
					<div>
						<h4 class="text-sm font-semibold text-text-primary">Private Channel</h4>
						<p class="text-xs text-text-muted mt-1">
							When enabled, the default role cannot view this channel unless another override allows it.
						</p>
					</div>
					<label class="inline-flex items-center cursor-pointer">
						<input
							type="checkbox"
							class="sr-only peer"
							checked={isPrivateChannel}
							disabled={isTogglingPrivate}
							onchange={(event) =>
								void togglePrivateChannel((event.currentTarget as HTMLInputElement).checked)}
						/>
						<div class="relative w-11 h-6 bg-surface peer-checked:bg-primary rounded-full transition-colors border border-border">
							<div class="absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-text-primary transition-transform peer-checked:translate-x-5"></div>
						</div>
					</label>
				</div>
				<div class="mt-3 text-xs text-text-muted flex items-center gap-2">
					{#if isPrivateChannel}
						<Lock size={14} />
						<span>Currently private</span>
					{:else}
						<Unlock size={14} />
						<span>Currently visible to everyone</span>
					{/if}
				</div>
			</section>

			<section class="rounded-lg border border-border bg-background p-4 space-y-4">
				<div>
					<h4 class="text-sm font-semibold text-text-primary">Permission Overwrites</h4>
					<p class="text-xs text-text-muted mt-1">
						Add role or member overrides to control who can talk, react, and upload files in this channel.
					</p>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-[130px_1fr_auto] gap-3 items-end">
					<Select label="Target Type" bind:value={addTargetType} options={targetTypeOptions} />
					<Select label="Target" bind:value={addTargetId} options={availableTargetOptions} />
					<Button
						onclick={() => void addOverwrite()}
						disabled={!addTargetId || isAddingOverwrite || availableTargetOptions.length === 0}
					>
						<Plus size={16} />
						Add Override
					</Button>
				</div>

				{#if availableTargetOptions.length === 0}
					<p class="text-xs text-text-muted">
						All {addTargetType === 'role' ? 'roles' : 'members'} already have overrides.
					</p>
				{/if}

				{#if overwrites.length === 0}
					<p class="text-sm text-text-muted">No channel overrides yet.</p>
				{:else}
					<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
						{#each overwrites as overwrite (getOverwriteKey(overwrite))}
							{@const overwriteKey = getOverwriteKey(overwrite)}
							<button
								onclick={() => {
									selectedOverwriteKey = overwriteKey;
								}}
								class="rounded-lg border px-3 py-2 text-left transition-colors {selectedOverwriteKey === overwriteKey
									? 'border-primary bg-primary/5'
									: 'border-border hover:border-border-light bg-surface'}"
							>
								<p class="text-sm font-medium text-text-primary truncate">{getOverwriteLabel(overwrite)}</p>
								<p class="text-xs text-text-muted mt-1">
									Allow {countBits(overwrite.allowPermissions)} · Deny {countBits(overwrite.denyPermissions)}
								</p>
							</button>
						{/each}
					</div>
				{/if}

				{#if selectedOverwrite}
					<div class="rounded-lg border border-border bg-surface p-4 space-y-3">
						<div class="flex items-start justify-between gap-4">
							<div>
								<p class="text-sm font-semibold text-text-primary">Editing {getOverwriteLabel(selectedOverwrite)}</p>
								<p class="text-xs text-text-muted mt-1">
									Choose Allow, Deny, or Inherit for each permission.
								</p>
							</div>
							<Button variant="ghost" onclick={() => void deleteSelectedOverwrite()} disabled={isDeletingOverwrite}>
								<Trash2 size={14} />
								Remove
							</Button>
						</div>

						<div class="space-y-2">
							{#each permissionOptions as option (option.bit)}
								{@const currentState = getPermissionState(option.bit)}
								<div class="rounded-lg border border-border bg-background p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
									<div>
										<p class="text-sm font-medium text-text-primary">{option.label}</p>
										<p class="text-xs text-text-muted">{option.description}</p>
									</div>
									<div class="inline-flex rounded-lg border border-border overflow-hidden self-start md:self-auto">
										<button
											type="button"
											onclick={() => setPermissionState(option.bit, 'inherit')}
											class="px-3 py-1.5 text-xs transition-colors {currentState === 'inherit' ? 'bg-surface-active text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'}"
										>
											Inherit
										</button>
										<button
											type="button"
											onclick={() => setPermissionState(option.bit, 'allow')}
											class="px-3 py-1.5 text-xs transition-colors {currentState === 'allow' ? 'bg-success/20 text-success' : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'}"
										>
											Allow
										</button>
										<button
											type="button"
											onclick={() => setPermissionState(option.bit, 'deny')}
											class="px-3 py-1.5 text-xs transition-colors {currentState === 'deny' ? 'bg-danger/20 text-danger' : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'}"
										>
											Deny
										</button>
									</div>
								</div>
							{/each}
						</div>

						<div class="flex justify-end">
							<Button
								onclick={() => void saveSelectedOverwrite()}
								disabled={!hasPendingOverwriteChanges || isSavingOverwrite}
							>
								Save Changes
							</Button>
						</div>
					</div>
				{/if}
			</section>
		</div>
	{/if}
</Modal>
