import { liveQuery } from 'dexie';

export interface Live<T> {
	readonly current: T | undefined;
	readonly loading: boolean;
}

/**
 * Subscribes to a Dexie query and re-runs it whenever the queried tables change.
 * `deps` is read inside an effect, so the query re-subscribes when reactive inputs
 * (e.g. a route param) change. Must be called during component initialisation.
 */
export function live<T, D = undefined>(
	query: (deps: D) => T | Promise<T>,
	deps: () => D = () => undefined as D
): Live<T> {
	let value = $state<T>();
	let loading = $state(true);

	$effect(() => {
		const d = deps();
		loading = true;
		const subscription = liveQuery(() => query(d)).subscribe({
			next: (v) => {
				value = v;
				loading = false;
			},
			error: (e) => {
				console.error('liveQuery failed', e);
				loading = false;
			}
		});
		return () => subscription.unsubscribe();
	});

	return {
		get current() {
			return value;
		},
		get loading() {
			return loading;
		}
	};
}
