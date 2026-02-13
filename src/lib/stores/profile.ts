import { writable, get } from 'svelte/store';
import type { FullUser, PortableProfile, PortableProfileSync } from '$lib/types';

const PORTABLE_PROFILE_KEY = 'zentra_portable_profile';

function generateIdentityId(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}
	return `ident_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function loadPortableProfile(): PortableProfile | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = localStorage.getItem(PORTABLE_PROFILE_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as PortableProfile;
	} catch {
		return null;
	}
}

function savePortableProfile(profile: PortableProfile | null): void {
	if (typeof window === 'undefined') return;
	if (!profile) {
		localStorage.removeItem(PORTABLE_PROFILE_KEY);
		return;
	}
	localStorage.setItem(PORTABLE_PROFILE_KEY, JSON.stringify(profile));
}

export const portableProfile = writable<PortableProfile | null>(loadPortableProfile());
portableProfile.subscribe(savePortableProfile);

export function hasPortableProfile(): boolean {
	const profile = get(portableProfile);
	return Boolean(profile?.identityId && profile?.profileVersion);
}

export function getPortableProfileForAuth(): PortableProfile | undefined {
	const profile = get(portableProfile);
	if (!profile?.identityId || !profile?.profileVersion) return undefined;
	return profile;
}

export function applyProfileSync(sync?: PortableProfileSync): void {
	if (!sync?.shouldStore || !sync.profile) return;
	portableProfile.set({
		...sync.profile,
		displayName: sync.profile.displayName ?? null,
		avatarUrl: sync.profile.avatarUrl ?? null,
		bio: sync.profile.bio ?? null,
		customStatus: sync.profile.customStatus ?? null
	});
}

export function upsertPortableProfileFromUser(user: FullUser): void {
	if (!user?.id || !user?.username) return;

	const current = get(portableProfile);
	const identityId = current?.identityId || generateIdentityId();
	const next: PortableProfile = {
		identityId,
		username: user.username,
		displayName: user.displayName ?? null,
		avatarUrl: user.avatarUrl ?? null,
		bio: user.bio ?? null,
		customStatus: user.customStatus ?? null,
		profileVersion: new Date().toISOString()
	};

	portableProfile.set(next);
}
