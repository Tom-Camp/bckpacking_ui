import type { TripUpdate } from '$lib/api/types';

export type ShareSection = keyof Pick<
	TripUpdate,
	'share_gear' | 'share_food' | 'share_checklist' | 'share_emergency_contact'
>;

/** The optional sections a share link can show; trip details are always shared. */
export const SHARE_SECTIONS: { key: ShareSection; label: string }[] = [
	{ key: 'share_gear', label: 'Gear list' },
	{ key: 'share_food', label: 'Food plan' },
	{ key: 'share_checklist', label: 'Checklist status' },
	{ key: 'share_emergency_contact', label: 'Emergency contact' }
];

/** The public link for a share token. The token goes in the fragment so it never reaches a server. */
export function shareUrl(origin: string, token: string): string {
	return `${origin}/shared#${token}`;
}
