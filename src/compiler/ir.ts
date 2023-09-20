import { ExpansionStackElement, Instruction, Location } from "../shared";

export interface CompilerContext {
  inlineExpansionStack: ExpansionStackElement[];
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