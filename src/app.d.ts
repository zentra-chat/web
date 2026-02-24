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
}

declare module 'markdown-it';
declare module 'markdown-it-ins';

interface Window {
	__ZENTRA_WAYLAND__?: boolean;
}

export {};
