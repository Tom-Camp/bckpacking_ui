import { describe, expect, it } from 'vitest';
import { formatTimestamp, fullName, userListQuery } from './admin';

describe('userListQuery', () => {
	it('sends no status for "all"', () => {
		expect(userListQuery('all')).toEqual({});
	});

	it('passes a status filter through', () => {
		expect(userListQuery('active')).toEqual({ status: 'active' });
		expect(userListQuery('blocked')).toEqual({ status: 'blocked' });
	});
});

describe('fullName', () => {
	it('joins whichever parts are set', () => {
		expect(fullName({ first_name: 'Sam', last_name: 'Ridge' })).toBe('Sam Ridge');
		expect(fullName({ first_name: 'Sam', last_name: null })).toBe('Sam');
		expect(fullName({ first_name: ' ', last_name: 'Ridge' })).toBe('Ridge');
	});

	it('is null when no name is set', () => {
		expect(fullName({ first_name: null, last_name: undefined })).toBeNull();
		expect(fullName({ first_name: '', last_name: '  ' })).toBeNull();
	});
});

describe('formatTimestamp', () => {
	const iso = '2026-03-04T15:30:00Z';

	it('formats a date in the viewer’s locale', () => {
		expect(formatTimestamp(iso)).toBe(
			new Date(iso).toLocaleString(undefined, { dateStyle: 'medium' })
		);
	});

	it('adds the time when asked', () => {
		expect(formatTimestamp(iso, { time: true })).toBe(
			new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
		);
	});

	it('is null for a missing or unparseable value', () => {
		expect(formatTimestamp(null)).toBeNull();
		expect(formatTimestamp(undefined)).toBeNull();
		expect(formatTimestamp('not a date')).toBeNull();
	});
});
