import { ExpansionStackElement, Instruction } from "../shared";

export interface CompilerContext {
  inlineExpansionStack: ExpansionStackElement[];
  bindings: Map<string, number>;
  memories: Map<string, number>;
  memorySize: number;
  labelCount: number;
}

export interface IRProgram {
  procs: Map<number, Instruction[]>;
  memorySize: number;
  strings: string[];
  libraries: string[];
  extern: string[];
}

export function createContext(): CompilerContext {
  return {
    inlineExpansionStack: [],
    bindings: new Map(),
    memories: new Map(),
    memorySize: 0,
    labelCount: 0
  };
}