<script lang="ts">
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
		image = '/og-image.svg',
		url = 'https://zentra.abstractmelon.net',
		type = 'website'
	}: Props = $props();
</script>

<svelte:head>
	<title>{title}</title>

	<meta name="description" content={description} />

	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={image} />
	<meta property="og:url" content={url} />
	<meta property="og:type" content={type} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image} />
</svelte:head>
