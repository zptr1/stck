import { ExpansionStackElement, Instruction, Location } from "../shared";

export interface IRContext {
  inlineExpansionStack: ExpansionStackElement[];
  bindings: Map<string, number>;
  memories: Map<string, number>;
  memorySize: number;
  labelCount: number;
}

export interface IRProc {
  name: string;
  argc: number;
  retc: number;
  instr: Instruction[];
  loc: Location;
}

export interface IRProgram {
  procs: Map<number, IRProc>;
  memorySize: number;
  strings: string[];
  libraries: string[];
  extern: string[];
}

export function createContext(): IRContext {
  return {
    inlineExpansionStack: [],
    bindings: new Map(),
    memories: new Map(),
    memorySize: 0,
    labelCount: 0
  };
}
