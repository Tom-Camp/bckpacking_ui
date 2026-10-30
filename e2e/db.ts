import postgres from 'postgres';

// Direct access to the API's database, for steps a test can't do through the UI (such as
// clicking an emailed link). Uses the same POSTGRES_* variables as the API.

function env(name: string, fallback?: string): string {
	const value = process.env[name] ?? fallback;
	if (value === undefined) throw new Error(`${name} must be set to reach the API's database`);
	return value;
}

/** Marks a registered account's email as verified, as if its link had been opened. */
export async function markVerified(email: string): Promise<void> {
	const sql = postgres({
		host: env('POSTGRES_HOST', 'localhost'),
		port: Number(env('POSTGRES_PORT', '5432')),
		user: env('POSTGRES_USER'),
		password: env('POSTGRES_PASSWORD'),
		database: env('POSTGRES_DB'),
		max: 1
	});
	try {
		// `user` is a reserved word, so the table name is quoted.
		const result = await sql`UPDATE "user" SET email_verified_at = now() WHERE email = ${email}`;
		if (result.count !== 1) throw new Error(`No account registered for ${email}`);
	} finally {
		await sql.end();
	}
}
