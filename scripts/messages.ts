import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 20);

const rows = await sql`
  SELECT id, created_at, subject, email, body FROM contact_messages ORDER BY created_at DESC LIMIT ${limit}
`;
if (rows.length === 0) console.log("No messages");
for (const r of rows.reverse()) {
  const date = (r.created_at as Date).toISOString().slice(0, 16).replace("T", " ");
  console.log(`#${r.id} · ${date} · ${r.subject}${r.email ? ` · ${r.email}` : ""}`);
  console.log(`${r.body}\n`);
}
await sql.end();
