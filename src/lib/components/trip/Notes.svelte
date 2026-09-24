<script lang="ts">
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import type { Trip } from '$lib/api/types';
	import ConfirmDelete from '$lib/components/ConfirmDelete.svelte';
	import OnlineButton from '$lib/components/OnlineButton.svelte';
	import { Textarea } from '$lib/components/ui/textarea';
	import { addNote, deleteNote, updateNote } from '$lib/data/mutations';
	import { attempt } from '$lib/errors';

	let { trip }: { trip: Trip } = $props();

	const notes = $derived([...trip.notes].sort((a, b) => a.created_at.localeCompare(b.created_at)));
	let draft = $state('');

	async function add() {
		const content = draft.trim();
		if (!content) return;
		if (await attempt(() => addNote(trip.id, content))) draft = '';
	}
</script>

<section class="grid grid-cols-1 gap-3">
	<h2 class="text-lg font-semibold">Notes</h2>
	{#each notes as note (note.id)}
		<div class="flex items-start gap-2">
			<Textarea
				class="min-h-16 flex-1"
				value={note.content}
				onchange={(e) => {
					const content = e.currentTarget.value.trim();
					if (content && content !== note.content)
						void attempt(() => updateNote(trip.id, note.id, content));
				}}
			/>
			<ConfirmDelete
				label="Delete note"
				title="Delete this note?"
				onconfirm={() => deleteNote(trip.id, note.id)}
			>
				<Trash2Icon />
			</ConfirmDelete>
		</div>
	{/each}
	<div class="grid grid-cols-1 gap-2">
		<Textarea placeholder="Add a note: shuttle phone number, water report…" bind:value={draft} />
		<div>
			<OnlineButton size="sm" variant="outline" disabled={!draft.trim()} onclick={add}
				>Add note</OnlineButton
			>
		</div>
	</div>
</section>
