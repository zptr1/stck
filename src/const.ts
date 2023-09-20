import plib from "path";

export const ROOT_DIR = plib.dirname(import.meta.dir);

export const i32_MAX = 2 ** 31 - 1;
export const i32_MIN = ~i32_MAX;
export const i64_MAX = 2 ** 63 - 1;
export const i64_MIN = ~i64_MAX;