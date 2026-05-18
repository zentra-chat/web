let tauriNotification: typeof import('@tauri-apps/plugin-notification') | null = null;

async function getTauriNotification() {
	if (tauriNotification) return tauriNotification;
	try {
		tauriNotification = await import('@tauri-apps/plugin-notification');
		return tauriNotification;
	} catch {
		return null;
	}
}

function isTauri(): boolean {
	return typeof window !== 'undefined' && '__TAURI__' in window;
}

/** Request browser/OS notification permission. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
	if (isTauri()) {
		const plugin = await getTauriNotification();
		if (plugin) {
			let granted = await plugin.isPermissionGranted();
			if (!granted) {
				const permission = await plugin.requestPermission();
				granted = permission === 'granted';
			}
			return granted;
		}
	}

	if (typeof window === 'undefined' || !('Notification' in window)) return false;

	if (Notification.permission === 'granted') return true;
	if (Notification.permission === 'denied') return false;

	const result = await Notification.requestPermission();
	return result === 'granted';
}

/** Whether native notifications are available and permitted. */
export async function canSendNativeNotification(): Promise<boolean> {
	if (isTauri()) {
		const plugin = await getTauriNotification();
		if (plugin) {
			return plugin.isPermissionGranted();
		}
	}

	if (typeof window === 'undefined' || !('Notification' in window)) return false;
	return Notification.permission === 'granted';
}

export interface NativeNotificationOptions {
	body?: string;
	icon?: string;
	tag?: string;
	/** Navigate to this URL when the notification is clicked */
	onClick?: () => void;
}

/**
 * Fire a native OS notification. If the document is currently focused the
 * notification is silently skipped (the in-app toast is sufficient in that case).
 * Pass `force: true` to always show regardless of focus.
 */
export async function sendNativeNotification(
	title: string,
	options: NativeNotificationOptions & { force?: boolean } = {}
): Promise<void> {
	if (!(await canSendNativeNotification())) return;

	if (!options.force && typeof document !== 'undefined' && document.visibilityState === 'visible') {
		return;
	}

	if (isTauri()) {
		const plugin = await getTauriNotification();
		if (plugin) {
			const { body, icon } = options;
			plugin.sendNotification({ title, body, icon });
			return;
		}
	}

	const { body, icon, tag, onClick } = options;

	const notif = new Notification(title, {
		body,
		icon: icon ?? '/icons/icon-192.png',
		tag
	});

	if (onClick) {
		notif.onclick = (e) => {
			e.preventDefault();
			window.focus?.();
			onClick();
		};
	} else {
		notif.onclick = () => {
			window.focus?.();
		};
	}
}
