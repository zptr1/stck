import plib from "path";

export * from "./codegen";
export * from "./compiler";
export * from "./errors";
export * from "./lexer";
export * from "./misc";
export * from "./parser";
export * from "./shared";

export const ROOT_DIR = plib.dirname(import.meta.dir);
