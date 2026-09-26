import type { Component, ComponentProps } from 'svelte';
import { render } from 'vitest-browser-svelte';
import type { Unit, User } from '$lib/api/types';
import WithApp from './WithApp.svelte';

/** Renders a component inside the app context (user, units) and tooltip provider. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function renderApp<C extends Component<any>>(
	component: C,
	props: ComponentProps<C> = {} as ComponentProps<C>,
	options: { user?: User; units?: Unit } = {}
) {
	return render(WithApp, { props: { component, props, ...options } });
}
