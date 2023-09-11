import { StackElement } from "../errors";

export * from "./typechecker";
export * from "./bytecode";
export * from "./encoder";
export * from "./fasm";

export interface CompilerContext {
  inlineExpansionStack: StackElement[];
  bindings: Map<string, number>;
}