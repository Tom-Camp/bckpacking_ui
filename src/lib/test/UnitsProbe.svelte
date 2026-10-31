<script lang="ts">
	// Test harness: prints the unit system from the app context.
	import { getAppContext } from '$lib/app-context';

	const app = getAppContext();
</script>

<p data-testid="units">{app.units}</p>
