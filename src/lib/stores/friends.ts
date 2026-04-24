import { derived, get, writable } from 'svelte/store';
import { api } from '$lib/api/client';
import type { FriendRequest, RelationshipStatus, User } from '$lib/types';
import { activeInstance } from './instance';

export interface FriendsSnapshot {
	friends: User[];
	incoming: FriendRequest[];
	outgoing: FriendRequest[];
	loading: boolean;
	loaded: boolean;
}

const EMPTY_SNAPSHOT: FriendsSnapshot = {
	friends: [],
	incoming: [],
	outgoing: [],
	loading: false,
	loaded: false
};

const loadInFlightByInstance: Record<string, Promise<void> | undefined> = {};

export const friendsCache = writable<Record<string, FriendsSnapshot>>({});

export const activeFriendsSnapshot = derived(
	[friendsCache, activeInstance],
	([$cache, $instance]): FriendsSnapshot => {
		if (!$instance) return EMPTY_SNAPSHOT;
		return $cache[$instance.id] ?? EMPTY_SNAPSHOT;
	}
);

export const incomingFriendRequestCount = derived(
	activeFriendsSnapshot,
	($snapshot) => $snapshot.incoming.length
);

function setSnapshot(instanceId: string, next: FriendsSnapshot): void {
	friendsCache.update((cache) => ({
		...cache,
		[instanceId]: next
	}));
}

function getSnapshotForInstance(instanceId: string): FriendsSnapshot {
	return get(friendsCache)[instanceId] ?? EMPTY_SNAPSHOT;
}

export async function loadFriendsData(options: { force?: boolean } = {}): Promise<void> {
	const instance = get(activeInstance);
	if (!instance) return;

	const snapshot = getSnapshotForInstance(instance.id);
	if (!options.force && snapshot.loaded) {
		return;
	}

	const inFlight = loadInFlightByInstance[instance.id];
	if (inFlight) {
		return inFlight;
	}

	setSnapshot(instance.id, {
		...snapshot,
		loading: true
	});

	const loadTask = Promise.all([api.getFriends(), api.getFriendRequests()])
		.then(([friends, requests]) => {
			setSnapshot(instance.id, {
				friends: friends || [],
				incoming: requests.incoming || [],
				outgoing: requests.outgoing || [],
				loading: false,
				loaded: true
			});
		})
		.catch((error) => {
			const latest = getSnapshotForInstance(instance.id);
			setSnapshot(instance.id, {
				...latest,
				loading: false
			});
			throw error;
		})
		.finally(() => {
			delete loadInFlightByInstance[instance.id];
		});

	loadInFlightByInstance[instance.id] = loadTask;
	return loadTask;
}

export async function sendFriendRequestAndRefresh(userId: string): Promise<void> {
	await api.sendFriendRequest(userId);
	await loadFriendsData({ force: true });
}

export async function acceptFriendRequestAndRefresh(userId: string): Promise<void> {
	await api.acceptFriendRequest(userId);
	await loadFriendsData({ force: true });
}

export async function removeFriendRequestAndRefresh(userId: string): Promise<void> {
	await api.removeFriendRequest(userId);
	await loadFriendsData({ force: true });
}

export async function removeFriendAndRefresh(userId: string): Promise<void> {
	await api.removeFriend(userId);
	await loadFriendsData({ force: true });
}

export function getRelationshipFromSnapshot(
	snapshot: FriendsSnapshot,
	userId: string
): RelationshipStatus {
	if (snapshot.friends.some((friend) => friend.id === userId)) {
		return 'friends';
	}
	if (snapshot.incoming.some((request) => request.user.id === userId)) {
		return 'incoming_request';
	}
	if (snapshot.outgoing.some((request) => request.user.id === userId)) {
		return 'outgoing_request';
	}
	return 'none';
}
