import { getContext, setContext } from 'svelte';
import type { Unit, User } from '$lib/api/types';

export interface AppContext {
	readonly user: User | undefined;
	/** Display unit system; imperial until the profile has loaded. */
	readonly units: Unit;
}

const KEY = Symbol('app');

export function setAppContext(ctx: AppContext) {
	setContext(KEY, ctx);
}

export function getAppContext(): AppContext {
	return getContext<AppContext>(KEY);
}
