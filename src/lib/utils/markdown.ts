import MarkdownIt from 'markdown-it';
import markdownItIns from 'markdown-it-ins';
import hljs from 'highlight.js/lib/common';
import { resolveShortcode } from './emoji';

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

const markdown = new MarkdownIt({
	html: false,
	linkify: true,
	breaks: true,
	typographer: true,
	highlight: (code: string, language: string) => {
		try {
			if (language && hljs.getLanguage(language)) {
				return hljs.highlight(code, { language, ignoreIllegals: true }).value;
			}
			return hljs.highlightAuto(code).value;
		} catch {
			return escapeHtml(code);
		}
	}
});

markdown.use(markdownItIns);

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export interface MentionResolver {
	getUserName?: (id: string) => string | null | undefined;
	getRoleName?: (id: string) => string | null | undefined;
}

export interface EmojiResolver {
	getCustomEmoji?: (id: string) => { name: string; imageUrl: string } | null | undefined;
	getCustomEmojiByName?: (name: string) => { name: string; imageUrl: string } | null | undefined;
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
		new RegExp(`&lt;:([a-zA-Z0-9_+-]{2,32}):(${UUID_PATTERN})&gt;`, 'gi'),
		(match, name, id) => {
			const emoji = emojiResolver?.getCustomEmoji?.(id);
			if (emoji) {
				return `<img class="custom-emoji" src="${emoji.imageUrl}" alt=":${emoji.name}:" title=":${emoji.name}:" draggable="false" />`;
			}
			// Fall back to showing the shortcode if we can't resolve it
			return `:${name}:`;
		}
	);

	// Standard shortcodes like :smile: — try custom emojis by name first, then native
	html = html.replace(
		/(?<!=["\'\u2019])(?::([a-zA-Z0-9_+-]{2,})::skin-tone-(\d):|:([a-zA-Z0-9_+-]{2,}):)/g,
		(match, _skinName, _skinTone, shortcode) => {
			const code = shortcode || _skinName;
			if (!code) return match;

			// Custom emoji by name takes priority over native shortcodes
			if (!_skinTone && emojiResolver?.getCustomEmojiByName) {
				const customEmoji = emojiResolver.getCustomEmojiByName(code);
				if (customEmoji) {
					return `<img class="custom-emoji" src="${customEmoji.imageUrl}" alt=":${customEmoji.name}:" title=":${customEmoji.name}:" draggable="false" />`;
				}
			}

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

