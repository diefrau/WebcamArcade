import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
await db.exec(
  await readFile(
    new URL("../supabase/migrations/202610180001_arcade.sql", import.meta.url),
    "utf8",
  ),
);
await db.exec(
  await readFile(
    new URL(
      "../supabase/migrations/202610190001_achievement_counts.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
await db.query("insert into auth.users values($1),($2)", [a, b]);
const identity = async (id) => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
};
await identity(a);
await db.query("select public.arcade_join($1)", ["토끼"]);
const submit = (id, game, score, accuracy = 0, seconds = 0) =>
  db.query("select public.arcade_submit($1,$2,$3,$4,$5)", [
    id,
    game,
    score,
    accuracy,
    seconds,
  ]);
const one = "33333333-3333-4333-8333-333333333333";
await submit(one, "shoot", 100, 90);
await submit(one, "shoot", 100, 90);
assert.deepEqual(
  (await db.query("select public.arcade_progress() as value")).rows[0].value
    .counts,
  { plays: 1, games: 1 },
);
assert.equal(
  (await db.query("select * from public.arcade_runs")).rows.length,
  1,
  "duplicate UUID must not count twice",
);
for (const [game, score, seconds] of [
  ["circle", 800, 20],
  ["cham", 700, 0],
  ["rps", 300, 0],
  ["dodge", 300, 30],
])
  await submit(crypto.randomUUID(), game, score, 0, seconds);
const progress = (await db.query("select public.arcade_progress() as value"))
  .rows[0].value;
assert.ok(
  Object.entries(progress)
    .filter(([key]) => key !== "counts")
    .every(([, v]) => v === true),
  "server computes all achievements",
);
assert.deepEqual(progress.counts, { plays: 5, games: 3 });
await assert.rejects(submit(crypto.randomUUID(), "rps", 501));
await assert.rejects(submit(crypto.randomUUID(), "unknown", 100));
await assert.rejects(submit(crypto.randomUUID(), "shoot", -1));
await assert.rejects(submit(crypto.randomUUID(), "shoot", 100, 101));
await assert.rejects(
  db.query("select public.arcade_join($1)", ["x".repeat(17)]),
);
await assert.rejects(
  db.query(
    "insert into public.arcade_runs(id,user_id,game,score) values($1,$2,$3,$4)",
    [crypto.randomUUID(), a, "shoot", 500],
  ),
);
await identity(b);
await db.query("select public.arcade_join($1)", [""]);
assert.equal(
  (await db.query("select * from public.arcade_runs")).rows.length,
  0,
  "RLS hides another identity history",
);
assert.equal(
  (await db.query("select * from public.arcade_profiles")).rows.length,
  1,
  "RLS hides other profiles",
);
await submit(crypto.randomUUID(), "shoot", 200);
await submit(crypto.randomUUID(), "shoot", 150);
let rows = (await db.query("select * from public.arcade_board('shoot')")).rows;
assert.equal(rows.length, 2);
assert.equal(rows[0].score, 200);
assert.equal(rows[0].nickname, "익명");
assert.deepEqual(Object.keys(rows[0]), ["place", "nickname", "score"]);
await db.exec("reset role; set role anon");
await assert.rejects(submit(crypto.randomUUID(), "shoot", 999));
assert.equal(
  (await db.query("select * from public.arcade_board('shoot')")).rows.length,
  2,
  "public board works without authentication",
);
await db.exec("reset role");
await db.query("delete from auth.users where id=$1", [b]);
assert.equal(
  (await db.query("select * from public.arcade_board('shoot')")).rows.length,
  1,
  "deleting an identity cascades its scores",
);
await identity(a);
for (let i = 0; i < 15; i++) await submit(crypto.randomUUID(), "shoot", 0);
await assert.rejects(
  submit(crypto.randomUUID(), "shoot", 0),
  "rate limit rejects the 21st new submission",
);
await submit(one, "shoot", 100, 90);
assert.equal(
  (await db.query("select count(*)::int as n from public.arcade_runs")).rows[0]
    .n,
  20,
);
await db.close();
console.log(
  "PostgreSQL checks passed: migration, RLS, anonymous permissions, bounds, deduplication, rankings, achievements, deletion.",
);
