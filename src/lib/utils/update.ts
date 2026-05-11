import { check } from '@tauri-apps/plugin-updater';
import { showToast } from '$lib/stores/ui';

export async function checkForUpdates(manual = false) {
	try {
		const update = await check();

		if (update) {
			const version = update.version || 'unknown';
			const notes = update.body || '';

			const message = notes
				? `Update ${version} available!\n\n${notes}\n\nInstall now?`
				: `Update ${version} available! Install now?`;

			if (confirm(message)) {
				showToast('info', `Downloading update ${version}...`, 0);
				await update.downloadAndInstall();
			}
		} else if (manual) {
			showToast('success', "You're up to date!");
		}
	} catch (err) {
		if (manual) {
			showToast('error', 'Failed to check for updates');
		}
	}
}
