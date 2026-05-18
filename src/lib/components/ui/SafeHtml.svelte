<script lang="ts">
	let { html = '' }: { html: string } = $props();

	function setHtml(node: HTMLElement) {
		node.innerHTML = html;
		return {
			update(newHtml: string) {
				node.innerHTML = newHtml;
			}
		};
	}
</script>

<div use:setHtml></div>
