type DesktopWindow = Window & {
	__IS_DESKTOP__?: unknown;
	__TAURI__?: unknown;
	__TAURI_IPC__?: unknown;
	tauri?: unknown;
};

export function isDesktop(): boolean {
	if (typeof window === 'undefined') return false;
	const w = window as DesktopWindow;

	// explicit override used for debugging or test environments
	if (typeof w.__IS_DESKTOP__ !== 'undefined') return Boolean(w.__IS_DESKTOP__);

	// Common Tauri globals that may be injected
	if (w.__TAURI__ || w.__TAURI_IPC__ || w.tauri) return true;

	// Fallback to user agent detection
	if (typeof navigator !== 'undefined' && /tauri/i.test(navigator.userAgent)) return true;

	// Log results of checks for easier debugging
	console.log('Platform check: Not detected as desktop environment.');
	
	return false;
}

export function logTauriGlobals(): void {
	if (typeof window === 'undefined') return;
	const w = window as DesktopWindow;
	console.log('Tauri globals:', {
		__TAURI__: w.__TAURI__,
		__TAURI_IPC__: w.__TAURI_IPC__,
		tauri: w.tauri,
		ua: typeof navigator !== 'undefined' ? navigator.userAgent : null
	});
}
