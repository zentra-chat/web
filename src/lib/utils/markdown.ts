import MarkdownIt from 'markdown-it';
import markdownItIns from 'markdown-it-ins';
import { resolveShortcode } from './emoji';

const markdown = new MarkdownIt({
	html: false,
	linkify: true,
	breaks: true,
	typographer: true
});

markdown.use(markdownItIns);

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export interface MentionResolver {
	getUserName?: (id: string) => string | null | undefined;
	getRoleName?: (id: string) => string | null | undefined;
}

export interface EmojiResolver {
	getCustomEmoji?: (id: string) => { name: string; imageUrl: string } | null | undefined;
}

/**
 * Post-processes markdown-rendered HTML to replace escaped mention tokens with
 * styled inline spans.
 *
 * markdown-it (html: false) escapes `<@UUID>` as `&lt;@UUID&gt;` so we work
 * with the already-rendered HTML.
 */
function postProcessMentions(html: string, resolver?: MentionResolver): string {
	// Role mentions: &lt;@&amp;UUID&gt;
	html = html.replace(
		new RegExp(`&lt;@&amp;(${UUID_PATTERN})&gt;`, 'gi'),
		(_, id) => {
			const name = resolver?.getRoleName?.(id) ?? id.slice(0, 8);
			return `<span class="mention mention-role" data-mention-id="${id}">@${name}</span>`;
		}
	);

	// User mentions: &lt;@UUID&gt;
	html = html.replace(
		new RegExp(`&lt;@(${UUID_PATTERN})&gt;`, 'gi'),
		(_, id) => {
			const name = resolver?.getUserName?.(id) ?? id.slice(0, 8);
			return `<span class="mention mention-user" data-mention-id="${id}">@${name}</span>`;
		}
	);

	// @everyone / @here
	html = html.replace(/@everyone\b/g, '<span class="mention mention-everyone">@everyone</span>');
	html = html.replace(/@here\b/g, '<span class="mention mention-here">@here</span>');

	return html;
}

/**
 * Replaces custom emoji tokens &lt;:name:UUID&gt; with inline images,
 * and standard :shortcode: with native unicode emojis.
 */
function postProcessEmojis(html: string, emojiResolver?: EmojiResolver): string {
	// Custom emojis: <:name:UUID> (HTML-escaped by markdown-it)
	html = html.replace(
		new RegExp(`&lt;:([a-zA-Z0-9_]{2,32}):(${UUID_PATTERN})&gt;`, 'gi'),
		(match, name, id) => {
			const emoji = emojiResolver?.getCustomEmoji?.(id);
			if (emoji) {
				return `<img class="custom-emoji" src="${emoji.imageUrl}" alt=":${emoji.name}:" title=":${emoji.name}:" draggable="false" />`;
			}
			// Fall back to showing the shortcode if we can't resolve it
			return `:${name}:`;
		}
	);

	// Standard shortcodes like :smile: — only match 2+ word chars between colons
	// Avoid matching things inside URLs or already-processed HTML attributes
	html = html.replace(
		/(?<!=["'])(?::([a-zA-Z0-9_+-]{2,})::skin-tone-(\d):|:([a-zA-Z0-9_+-]{2,}):)/g,
		(match, _skinName, _skinTone, shortcode) => {
			const code = shortcode || _skinName;
			if (!code) return match;
			const native = resolveShortcode(code);
			return native ?? match;
		}
	);

	return html;
}

export function renderMarkdown(content: string, resolver?: MentionResolver, emojiResolver?: EmojiResolver): string {
	const rendered = markdown.render(content);
	const withMentions = postProcessMentions(rendered, resolver);
	return postProcessEmojis(withMentions, emojiResolver);
}

