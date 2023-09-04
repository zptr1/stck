# stck

**stck** is a statically typed stack-based concatenative programming language

## Roadmap / To-Do

- [x] Parser
- [x] Type Checker
- [x] Type Inference
- [x] Compiler into own bytecode
- [x] Virtual Machine
- [ ] **Compiler into native** (in progress)
- [ ] **More Examples and Documentation** (in progress)
- [ ] Package Manager
- [ ] Bootstrapped

# Usage

First of all, you need to have [Bun](https://bun.sh/) installed. Bun will be replaced with node.js in the future for more cross platform support, but for now, the compiler is usable only on platforms supported by bun.

## Hello, World!

```
include "std.stck"

proc main
  "Hello, World!\n" puts
end
```

## Running

```bash
$ ./stck.ts hello_world.stck
Hello, World!
```

## Building

The stck compiler currently supports two targets: its own bytecode and Linux FASM.
The bytecode is used by default, but you can provide the target using the `--target` (`-t`) parameter.

```bash
$ ./stck.ts hello_world.stck -t fasm
Hello, World!
```

You can specify the `--buld` (`-b`) parameter to compile the program without running it.

```bash
$ ./stck.ts --build hello_world.stck
$ ./stck.ts hello_world.stbin
Hello, World!
$ # or, you can compile to a native executable using fasm!
$ ./stck.ts hello_world.stck -bt fasm
$ ./hello_world
Hello, World!
```

## More examples

WIP

# Guide

WIP
