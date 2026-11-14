import type { User, UserRole, UserStatus } from '$lib/api/types';

/** The admin user list's filter. `all` sends no `status` query param. */
export type UserFilter = 'all' | UserStatus;

export const USER_FILTERS: { value: UserFilter; label: string }[] = [
	{ value: 'all', label: 'All' },
	{ value: 'active', label: 'Active' },
	{ value: 'blocked', label: 'Blocked' }
];

/** Query params for `GET /api/v1/admin/users`. */
export function userListQuery(filter: UserFilter): { status?: UserStatus } {
	return filter === 'all' ? {} : { status: filter };
}

export const ROLE_LABELS: Record<UserRole, string> = {
	user: 'User',
	admin: 'Admin',
	unauthenticated: 'Unauthenticated'
};

export const STATUS_LABELS: Record<UserStatus, string> = {
	active: 'Active',
	blocked: 'Blocked'
};

/** "First Last", whichever parts are set, or null if neither is. */
export function fullName(user: Pick<User, 'first_name' | 'last_name'>): string | null {
	const name = [user.first_name, user.last_name]
		.map((part) => part?.trim())
		.filter(Boolean)
		.join(' ');
	return name || null;
}

/** An API timestamp in the viewer's locale and time zone, or null when it isn't set. */
export function formatTimestamp(
	iso: string | null | undefined,
	{ time = false }: { time?: boolean } = {}
): string | null {
	if (!iso) return null;
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return null;
	return date.toLocaleString(undefined, {
		dateStyle: 'medium',
		...(time ? { timeStyle: 'short' } : {})
	});
}
