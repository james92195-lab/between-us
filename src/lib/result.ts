export type Ok<T> = { ok: true; value: T };
export type Err = { ok: false; code: string; error: string };
export type Result<T> = Ok<T> | Err;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err(code: string, error: string): Err {
  return { ok: false, code, error };
}
