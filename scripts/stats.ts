import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

const [totals] = await sql`
  WITH per_user AS (
    SELECT u.id, COUNT(r.title_id) FILTER (WHERE r.tier IS NOT NULL) AS ranked, COUNT(r.title_id) AS entries
    FROM users u LEFT JOIN ratings r ON r.user_id = u.id GROUP BY u.id
  )
  SELECT
    COUNT(*) FILTER (WHERE entries > 0)::int AS "visitors who rated",
    COUNT(*) FILTER (WHERE ranked >= 3)::int AS "tier lists (3+ titles)",
    COUNT(*) FILTER (WHERE ranked >= 10)::int AS "tier lists (10+ titles)",
    COALESCE(SUM(entries), 0)::int AS "ratings",
    ROUND(AVG(ranked) FILTER (WHERE ranked > 0), 1)::float AS "avg titles per list"
  FROM per_user
`;
console.log("Totals");
console.table(totals);

const days = await sql`
  SELECT d::date AS day,
    (SELECT COUNT(*) FROM users u WHERE u.created_at::date = d::date AND EXISTS (SELECT 1 FROM ratings r WHERE r.user_id = u.id))::int AS "new visitors who rated",
    (SELECT COUNT(*) FROM ratings r WHERE r.updated_at::date = d::date)::int AS "ratings changed"
  FROM generate_series(current_date - 13, current_date, interval '1 day') d
  ORDER BY day DESC
`;
console.log("Last 14 days");
console.table(days.map((d) => ({ ...d, day: d.day.toISOString().slice(0, 10) })));

const top = await sql`
  SELECT t.name, COUNT(*) FILTER (WHERE r.tier IN ('S', 'A'))::int AS loved, COUNT(*) FILTER (WHERE r.tier IS NOT NULL)::int AS ranked,
    COUNT(*) FILTER (WHERE r.state = 'want')::int AS "want to read"
  FROM ratings r JOIN titles t ON t.id = r.title_id
  GROUP BY t.name ORDER BY ranked DESC, loved DESC LIMIT 15
`;
console.log("Most ranked titles");
console.table(top);

await sql.end();
