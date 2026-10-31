import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { db } from '$lib/data/db';
import { mockApi, respond } from '$lib/test/api';
import { note, trip } from '$lib/test/fixtures';
import { renderApp } from '$lib/test/render';
import Notes from './Notes.svelte';

const older = note({ content: 'Water at mile 4', created_at: '2026-01-01T00:00:00Z' });
const newer = note({ content: 'Shuttle 555-0100', created_at: '2026-01-02T00:00:00Z' });

async function setup() {
	const t = trip({ notes: [newer, older] });
	await db.trips.put(t);
	return renderApp(Notes, { trip: t });
}

describe('Notes', () => {
	it('lists notes oldest first', async () => {
		const screen = await setup();
		const values = screen
			.getByRole('textbox')
			.elements()
			.map((el) => (el as HTMLTextAreaElement).value);
		expect(values).toEqual(['Water at mile 4', 'Shuttle 555-0100', '']);
	});

	it('adds a note through the API and clears the draft', async () => {
		const added = note({ content: 'Permit in glovebox' });
		const requests = mockApi({ 'POST /api/v1/trips/trip-1/notes': () => added });
		const screen = await setup();

		const add = screen.getByRole('button', { name: 'Add note' });
		await expect.element(add).toBeDisabled();
		const draft = screen.getByPlaceholder(/Add a note/);
		await draft.fill('  Permit in glovebox ');
		await add.click();

		await expect.element(draft).toHaveValue('');
		expect(requests[0].body).toEqual({ content: 'Permit in glovebox' });
		expect((await db.trips.get('trip-1'))?.notes.map((n) => n.id)).toContain(added.id);
	});

	it('keeps the draft when adding fails', async () => {
		mockApi({ 'POST /api/v1/trips/trip-1/notes': () => respond(500, { detail: 'Boom' }) });
		const screen = await setup();
		const draft = screen.getByPlaceholder(/Add a note/);
		await draft.fill('Permit in glovebox');
		await screen.getByRole('button', { name: 'Add note' }).click();

		await expect.element(draft).toHaveValue('Permit in glovebox');
	});

	it('saves edits offline when the note loses focus', async () => {
		const screen = await setup();
		await screen.getByRole('textbox').first().fill('Water at mile 5');
		await userEvent.tab();

		await expect
			.poll(
				async () => (await db.trips.get('trip-1'))?.notes.find((n) => n.id === older.id)?.content
			)
			.toBe('Water at mile 5');
		expect((await db.outbox.toArray())[0].path).toBe(`/api/v1/trips/trip-1/notes/${older.id}`);
	});

	it('deletes a note after confirmation', async () => {
		const requests = mockApi({
			[`DELETE /api/v1/trips/trip-1/notes/${older.id}`]: () => respond(204)
		});
		const screen = await setup();
		await screen.getByRole('button', { name: 'Delete note' }).first().click();
		await screen.getByRole('button', { name: 'Delete', exact: true }).click();

		await expect
			.poll(async () => (await db.trips.get('trip-1'))?.notes.map((n) => n.id))
			.toEqual([newer.id]);
		expect(requests.map((r) => r.route)).toEqual([`DELETE /api/v1/trips/trip-1/notes/${older.id}`]);
	});
});
