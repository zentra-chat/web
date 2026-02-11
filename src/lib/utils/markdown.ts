import MarkdownIt from 'markdown-it';
import markdownItIns from 'markdown-it-ins';

const markdown = new MarkdownIt({
	html: false,
	linkify: true,
	breaks: true,
	typographer: true
});

markdown.use(markdownItIns);

export function renderMarkdown(content: string): string {
	return markdown.render(content);
}
