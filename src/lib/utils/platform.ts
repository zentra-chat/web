export async function waitForDesktop(timeout = 2000): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const w = window as any;
        if (w.__TAURI__ || w.__TAURI_IPC__ || w.tauri) return true;
        await new Promise(r => setTimeout(r, 50));
    }
    return false;
}

export function logTauriGlobals(): void {
	if (typeof window === 'undefined') return;
	const w = window as any;
	console.log('Tauri globals:', {
		__TAURI__: w.__TAURI__,
		__TAURI_IPC__: w.__TAURI_IPC__,
		tauri: w.tauri,
		ua: typeof navigator !== 'undefined' ? navigator.userAgent : null
	});
}
