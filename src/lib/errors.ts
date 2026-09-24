import { toast } from 'svelte-sonner';
import { ApiError, OfflineError } from '$lib/api/client';

export function errorMessage(e: unknown): string {
	if (e instanceof OfflineError) return 'You’re offline. This needs a connection.';
	if (e instanceof ApiError) return e.message;
	if (e instanceof Error) return e.message;
	return 'Something went wrong.';
}

/** Runs an action and reports failure as a toast. Returns false if it failed. */
export async function attempt(action: () => Promise<unknown>, success?: string): Promise<boolean> {
	try {
		await action();
		if (success) toast.success(success);
		return true;
	} catch (e) {
		toast.error(errorMessage(e));
		return false;
	}
}
