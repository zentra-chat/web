/**
 * Native push notification helper.
 *
 * Works on:
 *  - Browser   — via the standard Web Notification API (user must grant permission)
 *  - Tauri app — the WebView supports the same Web Notification API, so no plugin is needed
 *
 * Usage:
 *   await requestNotificationPermission();
 *   sendNativeNotification('New message', 'Hello from Alice');
 */

/** Request browser/OS notification permission. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
	if (typeof window === 'undefined' || !('Notification' in window)) return false;

	if (Notification.permission === 'granted') return true;
	if (Notification.permission === 'denied') return false;

	const result = await Notification.requestPermission();
	return result === 'granted';
}

/** Whether native notifications are available and permitted. */
export function canSendNativeNotification(): boolean {
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
export function sendNativeNotification(
	title: string,
	options: NativeNotificationOptions & { force?: boolean } = {}
): void {
	if (!canSendNativeNotification()) return;

	// Skip when the user already has the tab / window in focus
	if (!options.force && typeof document !== 'undefined' && document.visibilityState === 'visible') {
		return;
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
