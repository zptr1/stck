import { Instruction, Location } from "../shared";
import { StackElement } from "../errors";

export interface CompilerContext {
  inlineExpansionStack: StackElement[];
  bindings: Map<string, number>;
  loc: Location
}

export interface IRProgram {
  instr: Instruction[];
  strings: Map<string, number>;
  memorySize: number;
}

export function createContext(loc: Location): CompilerContext {
  return {
    inlineExpansionStack: [],
    bindings: new Map(),
    loc
  }
}