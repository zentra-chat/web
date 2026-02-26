import { renderMarkdown } from '$lib/utils/markdown';

export interface DocHeading {
	level: 2 | 3;
	text: string;
	anchor: string;
}

export interface DocPage {
	slug: string;
	title: string;
	description: string;
	html: string;
	headings: DocHeading[];
	sourceFile: string;
}

export interface DocsSection {
	title: string;
	items: Array<{ slug: string; title: string; href: string }>;
}

const rawDocs = import.meta.glob('../../../../docs/**/*.md', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

const preferredOrder = [
	'index',
	'development/introduction',
	'development/local-setup',
	'installation',
	'self-hosting',
	'usage',
	'api',
	'faq',
	'about'
] as const;

const sectionOrder = [
	{
		title: 'Start',
		slugs: ['index', 'development/introduction', 'development/local-setup']
	},
	{
		title: 'Install & Deploy',
		slugs: ['installation', 'self-hosting']
	},
	{
		title: 'Reference',
		slugs: ['usage', 'api', 'faq', 'about']
	}
] as const;

function stripFrontmatter(markdown: string): string {
	return markdown.replace(/^---\n[\s\S]*?\n---\n?/m, '');
}

function normalizeSlug(input: string): string {
	const slug = input.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
	return slug === '' ? 'index' : slug;
}

function sourcePathToSlug(sourceFile: string): string {
	const marker = '/docs/';
	const idx = sourceFile.lastIndexOf(marker);
	const relative = idx >= 0 ? sourceFile.slice(idx + marker.length) : sourceFile;
	const withoutExt = relative.replace(/\.md$/i, '');
	if (withoutExt === 'index') return 'index';
	if (withoutExt.endsWith('/index')) return withoutExt.slice(0, -('/index'.length));
	return withoutExt;
}

function extractTitle(markdown: string, fallback: string): string {
	const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
	if (heading) return heading;
	return fallback
		.split('/')
		.pop()
		?.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ') ??
		fallback
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function extractDescription(markdown: string, fallbackTitle: string): string {
	const lines = markdown
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith('#') && !line.startsWith('```'));

	const paragraph = lines.find((line) => !line.startsWith('- ') && !line.startsWith('* '));
	if (paragraph) return paragraph.length > 160 ? `${paragraph.slice(0, 157)}...` : paragraph;
	return `${fallbackTitle} documentation`;
}

function slugifyHeading(text: string): string {
	return text
		.trim()
		.toLowerCase()
		.replace(/[`*_~]/g, '')
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-');
}

function extractHeadings(markdown: string): DocHeading[] {
	const headings: DocHeading[] = [];
	const lines = markdown.split('\n');
	for (const line of lines) {
		const match = line.match(/^(##|###)\s+(.+)$/);
		if (!match) continue;
		const level = match[1] === '##' ? 2 : 3;
		const text = match[2].trim();
		headings.push({
			level,
			text,
			anchor: slugifyHeading(text)
		});
	}
	return headings;
}

function rewriteDocLinks(html: string): string {
	let rewritten = html.replace(/href="\/(?!docs(?:\/|"))(.*?)"/g, (_full, path: string) => {
		const clean = path.replace(/^\/+|\/+$/g, '');
		if (!clean) return 'href="/docs"';
		return `href="/docs/${clean}"`;
	});

	rewritten = rewritten.replace(
		/href="(?!https?:|mailto:|#|\/|\.\/|\.\.\/)([^"#?]+)"/g,
		(_full, path: string) => {
			const clean = path.replace(/^\/+|\/+$/g, '').replace(/\.md$/i, '');
			if (!clean) return 'href="/docs"';
			return `href="/docs/${clean}"`;
		}
	);

	return rewritten;
}

function buildPages(): DocPage[] {
	const pages = Object.entries(rawDocs).map(([sourceFile, rawContent]) => {
		const baseSlug = normalizeSlug(sourcePathToSlug(sourceFile));
		const markdown = stripFrontmatter(rawContent);
		const title = extractTitle(markdown, baseSlug);
		const headings = extractHeadings(markdown);
		const description = extractDescription(markdown, title);
		const html = rewriteDocLinks(renderMarkdown(markdown));

		return {
			slug: baseSlug,
			title,
			description,
			html,
			headings,
			sourceFile
		};
	});

	const orderMap = new Map<string, number>(preferredOrder.map((slug, index) => [slug, index]));
	return pages.sort((a, b) => {
		const orderA = orderMap.get(a.slug) ?? Number.MAX_SAFE_INTEGER;
		const orderB = orderMap.get(b.slug) ?? Number.MAX_SAFE_INTEGER;
		if (orderA !== orderB) return orderA - orderB;
		return a.slug.localeCompare(b.slug);
	});
}

export const docsPages = buildPages();

export const docsNav = docsPages.map((doc) => ({
	slug: doc.slug,
	title: doc.title,
	href: doc.slug === 'index' ? '/docs' : `/docs/${doc.slug}`
}));

export const docsSections: DocsSection[] = sectionOrder
	.map((section) => ({
		title: section.title,
		items: section.slugs
			.map((slug) => docsNav.find((item) => item.slug === slug))
			.filter((item): item is { slug: string; title: string; href: string } => Boolean(item))
	}))
	.filter((section) => section.items.length > 0);

export function getDocBySlug(slugInput: string | undefined): DocPage | undefined {
	const slug = normalizeSlug(slugInput ?? 'index');
	return docsPages.find((doc) => doc.slug === slug);
}
