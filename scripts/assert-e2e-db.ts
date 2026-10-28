const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required for the E2E API.');
  process.exit(1);
}

const parsed = new URL(databaseUrl);
if (parsed.searchParams.get('schema') !== 'roadsense_e2e') {
  console.error(
    'Refusing to reset a non-E2E database. DATABASE_URL must use schema=roadsense_e2e.',
  );
  process.exit(1);
}

console.log(`E2E API using isolated schema "${parsed.searchParams.get('schema')}".`);
