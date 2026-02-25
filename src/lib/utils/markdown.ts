import MarkdownIt from 'markdown-it';
import markdownItIns from 'markdown-it-ins';

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

export function renderMarkdown(content: string, resolver?: MentionResolver): string {
	const rendered = markdown.render(content);
	return postProcessMentions(rendered, resolver);
}

