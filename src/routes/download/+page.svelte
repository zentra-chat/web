<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui';
	import AnimatedBackground from '$lib/components/layout/AnimatedBackground.svelte';
	import { Github, ArrowRight } from 'lucide-svelte';
	import { isLoggedIn } from '$lib/stores/instance';
	import linuxIcon from '$lib/assets/brands/linux.svg';
	import appleIcon from '$lib/assets/brands/apple.svg';
	import windowsIcon from '$lib/assets/brands/windows.svg';

	const releaseUrl = 'https://github.com/zentra-chat/zentra-desktop/releases/latest';
	const latestReleaseApi = 'https://api.github.com/repos/zentra-chat/zentra-desktop/releases/latest';
	const aurPackage = 'yay -S zentra-desktop-bin';

	type OsType = 'linux' | 'macos' | 'windows' | 'unknown';
	type ArchType = 'arm64' | 'x64' | 'unknown';
	type CtaInfo = { os: OsType; label: string; subtitle: string };
	type ReleaseAsset = { name: string; browser_download_url: string };

	let primaryCta: CtaInfo = {
		os: 'unknown',
		label: 'Download Zentra Desktop',
		subtitle: 'Finding the best installer for your system...'
	};

	let downloadLinks: Record<'linux' | 'macos' | 'windows', string> = {
		linux: releaseUrl,
		macos: releaseUrl,
		windows: releaseUrl
	};
	let primaryDownloadUrl = releaseUrl;
	let isLoadingAssets = true;

	onMount(async () => {
		primaryCta = getPrimaryCta();
		primaryDownloadUrl = getPrimaryUrl(primaryCta.os);
		await loadReleaseAssets();
		primaryDownloadUrl = getPrimaryUrl(primaryCta.os);
	});

	function getPrimaryCta(): CtaInfo {
		const ua = navigator.userAgent.toLowerCase();
		const platform = navigator.platform.toLowerCase();

		if (platform.includes('linux') || ua.includes('linux')) {
			return {
				os: 'linux',
				label: 'Download for Linux',
				subtitle: 'Direct download is selected for Linux. AUR option is available below.'
			};
		}

		if (platform.includes('mac') || ua.includes('mac os')) {
			return {
				os: 'macos',
				label: 'Download for macOS',
				subtitle: 'Direct download is selected for your Mac architecture when available.'
			};
		}

		if (platform.includes('win') || ua.includes('windows')) {
			return {
				os: 'windows',
				label: 'Download for Windows',
				subtitle: 'Direct download is selected for Windows installer assets.'
			};
		}

		return {
			os: 'unknown',
			label: 'Download Zentra Desktop',
			subtitle: 'Choose your platform below or use the latest release assets.'
		};
	}

	function detectArch(): ArchType {
		const ua = navigator.userAgent.toLowerCase();
		const platform = navigator.platform.toLowerCase();

		if (ua.includes('aarch64') || ua.includes('arm64') || platform.includes('arm')) return 'arm64';
		if (ua.includes('x86_64') || ua.includes('x64') || ua.includes('amd64') || platform.includes('x86')) return 'x64';
		return 'unknown';
	}

	function findAssetUrl(assets: ReleaseAsset[], os: 'linux' | 'macos' | 'windows', arch: ArchType): string {
		const byExt: Record<typeof os, RegExp> = {
			linux: /\.appimage$|\.deb$|\.rpm$|\.tar\.gz$/i,
			macos: /\.dmg$|\.pkg$|\.app\.tar\.gz$/i,
			windows: /\.msi$|\.exe$/i
		};

		const platformHints: Record<typeof os, RegExp> = {
			linux: /linux|appimage|deb|rpm/i,
			macos: /mac|darwin|osx|dmg|apple/i,
			windows: /windows|win|msi|setup|nsis/i
		};

		const archHint = arch === 'arm64' ? /arm64|aarch64|arm/i : /x64|x86_64|amd64|x86/i;
		const candidates = assets.filter((asset) => byExt[os].test(asset.name) && platformHints[os].test(asset.name));

		const archPreferred = candidates.find((asset) => archHint.test(asset.name));
		if (archPreferred) return archPreferred.browser_download_url;

		if (os === 'linux') {
			const appImage = candidates.find((asset) => /\.appimage$/i.test(asset.name));
			if (appImage) return appImage.browser_download_url;
			const deb = candidates.find((asset) => /\.deb$/i.test(asset.name));
			if (deb) return deb.browser_download_url;
		}

		if (os === 'macos') {
			const dmg = candidates.find((asset) => /\.dmg$/i.test(asset.name));
			if (dmg) return dmg.browser_download_url;
		}

		if (os === 'windows') {
			const msi = candidates.find((asset) => /\.msi$/i.test(asset.name));
			if (msi) return msi.browser_download_url;
		}

		return candidates[0]?.browser_download_url ?? releaseUrl;
	}

	async function loadReleaseAssets() {
		try {
			const response = await fetch(latestReleaseApi, {
				headers: {
					Accept: 'application/vnd.github+json'
				}
			});

			if (!response.ok) throw new Error(`GitHub API request failed: ${response.status}`);

			const data = await response.json();
			const assets = (Array.isArray(data.assets) ? data.assets : []) as ReleaseAsset[];
			const arch = detectArch();

			downloadLinks = {
				linux: findAssetUrl(assets, 'linux', arch),
				macos: findAssetUrl(assets, 'macos', arch),
				windows: findAssetUrl(assets, 'windows', arch)
			};
		} catch (error) {
			console.error('Unable to resolve latest release assets:', error);
			downloadLinks = {
				linux: releaseUrl,
				macos: releaseUrl,
				windows: releaseUrl
			};
		} finally {
			isLoadingAssets = false;
		}
	}

	function getPrimaryUrl(os: OsType): string {
		if (os === 'linux' || os === 'macos' || os === 'windows') return downloadLinks[os];
		return releaseUrl;
	}
</script>

<svelte:head>
	<title>Download Zentra Desktop</title>
	<meta
		name="description"
		content="Download Zentra Desktop with auto-detected direct links for Linux, macOS, and Windows."
	/>
</svelte:head>

<div class="min-h-screen bg-background relative overflow-hidden flex flex-col">
  <AnimatedBackground particleCountDesktop={220} />

  <nav class="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto w-full">
		<a href="/" class="text-2xl font-bold text-gradient">Zentra</a>
		<div class="flex items-center gap-4">
			<a href="/download" class="text-text-primary transition-colors text-sm font-medium">Download</a>
			<a
				href="https://github.com/zentra-chat"
				target="_blank"
				rel="noopener noreferrer"
				class="p-2 text-text-secondary hover:text-text-primary transition-colors"
				aria-label="GitHub"
			>
				<Github size={24} />
			</a>
			{#if $isLoggedIn}
				<a href="/app">
					<Button>
						Open App
						<ArrowRight size={18} />
					</Button>
				</a>
			{:else}
				<a href="/login">
					<Button variant="secondary">Login</Button>
				</a>
				<a href="/register">
					<Button>
						Get Started
						<ArrowRight size={18} />
					</Button>
				</a>
			{/if}
		</div>
	</nav>

  <main class="relative z-10 flex-1 px-6 py-12 md:py-16">
		<div class="max-w-6xl mx-auto w-full space-y-8">
			<section class="rounded-2xl border border-border bg-surface/55 backdrop-blur-md p-7 md:p-10 text-center">
				<h1 class="text-4xl md:text-6xl font-bold text-gradient glow-text mb-3">Download Zentra Desktop</h1>
				<p class="text-text-secondary text-lg md:text-xl max-w-3xl mx-auto mb-6">{primaryCta.subtitle}</p>

				<div class="mt-6 flex flex-col sm:flex-row gap-3 justify-center items-center">
					<a href={primaryDownloadUrl} target="_blank" rel="noopener noreferrer">
						<Button size="lg" class="glow-primary min-w-[16rem]">
							{isLoadingAssets ? 'Preparing Download…' : primaryCta.label}
							<ArrowRight size={20} />
						</Button>
					</a>
					<a href={releaseUrl} target="_blank" rel="noopener noreferrer">
						<Button size="lg" variant="secondary">All Release Assets</Button>
					</a>
				</div>

				{#if primaryCta.os === 'linux'}
					<div class="mt-5 max-w-md mx-auto rounded-xl border border-border bg-background/55 px-4 py-3 text-left">
						<p class="text-xs uppercase tracking-wide text-text-muted mb-1">AUR</p>
						<code class="text-sm text-text-primary">{aurPackage}</code>
					</div>
				{/if}
			</section>

			<section class="grid grid-cols-1 md:grid-cols-3 gap-6">
				<article class="rounded-xl border border-border bg-surface/50 backdrop-blur-sm p-6 hover:border-primary/35 transition-colors">
					<div class="w-11 h-11 mb-4 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
						<img src={linuxIcon} alt="Linux logo" class="w-6 h-6" loading="lazy" />
					</div>
					<h2 class="text-xl font-semibold text-text-primary mb-2">Linux</h2>
					<p class="text-text-secondary mb-4">AppImage or deb selected automatically from the latest release assets.</p>
					<a href={downloadLinks.linux} target="_blank" rel="noopener noreferrer">
						<Button class="w-full">Download Linux</Button>
					</a>
				</article>

				<article class="rounded-xl border border-border bg-surface/50 backdrop-blur-sm p-6 hover:border-primary/35 transition-colors">
					<div class="w-11 h-11 mb-4 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
						<img src={appleIcon} alt="Apple logo" class="w-6 h-6" loading="lazy" />
					</div>
					<h2 class="text-xl font-semibold text-text-primary mb-2">macOS</h2>
					<p class="text-text-secondary mb-4">Matches your architecture first and falls back to the best available installer.</p>
					<a href={downloadLinks.macos} target="_blank" rel="noopener noreferrer">
						<Button class="w-full">Download macOS</Button>
					</a>
				</article>

				<article class="rounded-xl border border-border bg-surface/50 backdrop-blur-sm p-6 hover:border-primary/35 transition-colors">
					<div class="w-11 h-11 mb-4 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
						<img src={windowsIcon} alt="Windows logo" class="w-6 h-6" loading="lazy" />
					</div>
					<h2 class="text-xl font-semibold text-text-primary mb-2">Windows</h2>
					<p class="text-text-secondary mb-4">Selects a direct installer link from the latest GitHub release assets.</p>
					<a href={downloadLinks.windows} target="_blank" rel="noopener noreferrer">
						<Button class="w-full">Download Windows</Button>
					</a>
				</article>
			</section>
		</div>
	</main>

  <footer class="relative z-10 border-t border-border/60 mt-auto">
		<div class="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-text-muted">
			<p>© 2026 Zentra / Abstractmelon</p>
			<div class="flex items-center gap-4">
				<a href="/download" class="hover:text-text-secondary">Download</a>
				<a href="/privacy" class="hover:text-text-secondary">Privacy Policy</a>
				<a href="/terms" class="hover:text-text-secondary">Terms of Service</a>
			</div>
		</div>
	</footer>
</div>