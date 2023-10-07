import { ExpansionStackElement, Instruction, Location } from "../shared";

export interface CompilerContext {
  inlineExpansionStack: ExpansionStackElement[];
  bindings: Map<string, number>;
  loc: Location;
  labelCount: number;
}

export interface IRProgram {
  procs: Map<number, Instruction[]>;
  strings: string[];
  memorySize: number;
}

export function createContext(loc: Location): CompilerContext {
  return {
    inlineExpansionStack: [],
    bindings: new Map(),
    labelCount: 0,
    loc,
  }
}