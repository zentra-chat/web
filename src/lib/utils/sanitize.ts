export function sanitizeHtml(html: string): string {
	return html
		.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
		.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
		.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
		.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
		.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
		.replace(/\bon\w+\s*=\s*"[^"]*"/gi, '')
		.replace(/\bon\w+\s*=\s*'[^']*'/gi, '')
		.replace(/href\s*=\s*"javascript:/gi, 'href="#"')
		.replace(/href\s*=\s*'javascript:/gi, "href='#'")
		.replace(/src\s*=\s*"javascript:/gi, 'src="#"')
		.replace(/src\s*=\s*'javascript:/gi, "src='#'");
}
