export * from "./reader";

export function assertNever(_: never): never {
  throw new Error("unreachable");
}