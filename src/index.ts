import plib from "path";

export const ROOT_DIR = plib.dirname(import.meta.dir);

export const i32_MAX = 2147483647;
export const i32_MIN = -2147483648;
export const i64_MAX = 9223372036854775807n;
export const i64_MIN = -9223372036854775808n;

export function assertNever(_: never): never {
  throw new Error("unreachable");
}