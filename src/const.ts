import plib from "path";

export const MAGIC = Buffer.from([0x53, 0x54, 0x43, 0x4b, 0xFF]);
export const ROOT_DIR = plib.dirname(import.meta.dir);