<script lang="ts">
	const BASE = 'https://zentra.abstractmelon.net';

	interface Props {
		title: string;
		description?: string;
		image?: string;
		url?: string;
		type?: string;
	}

	let {
		title,
		description = 'Open-source, encrypted, community-hostable chat platform. Your conversations, your control.',
		image = `${BASE}/og-image.svg`,
		url = BASE,
		type = 'website'
	}: Props = $props();

	function absolute(path: string): string {
		if (path.startsWith('http://') || path.startsWith('https://')) return path;
		return `${BASE}${path}`;
	}

	let absoluteUrl = $derived(absolute(url));
	let absoluteImage = $derived(absolute(image));
</script>

<svelte:head>
	<title>{title}</title>

	<meta name="description" content={description} />

	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={absoluteImage} />
	<meta property="og:url" content={absoluteUrl} />
	<meta property="og:type" content={type} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={absoluteImage} />
</svelte:head>
