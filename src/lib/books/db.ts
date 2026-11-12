import { getSql, withTransaction, type Sql } from "@/lib/db";
import type { BookDb, Queryable } from "./service.ts";

function asQueryable(sql: Sql): Queryable {
  return { query: (text, params) => sql.query(text, params) };
}

export async function getBookDb(): Promise<BookDb> {
  const sql = await getSql();
  return {
    query: (text, params) => sql.query(text, params),
    transaction: (fn) => withTransaction((tx) => fn(asQueryable(tx))),
  };
}
