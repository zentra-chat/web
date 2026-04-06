// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		__ZENTRA_WAYLAND__?: boolean;
		turnstile?: {
			render: (
				element: HTMLElement,
				options: {
					sitekey: string;
					callback?: (token: string) => void;
					'expired-callback'?: () => void;
					'error-callback'?: (errorCode?: string) => void;
				}
			) => string;
			reset: (widgetId?: string) => void;
			remove?: (widgetId: string) => void;
		};
	}
}

declare module 'markdown-it';
declare module 'markdown-it-ins';

export {};
