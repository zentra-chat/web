<script lang="ts">
	let { html = '' }: { html: string } = $props();

	function setHtml(node: HTMLElement, htmlContent: string) {
		node.innerHTML = htmlContent;
		return {
			update(newHtml: string) {
				node.innerHTML = newHtml;
			}
		};
	}
</script>

<div use:setHtml={html}></div>
