# stck

**stck** is a statically typed stack-based concatenative programming language

## Roadmap / To-Do

- [x] Parser
- [x] Type Checker
- [x] Type Inference
- [x] Compiler into own bytecode
- [x] Virtual Machine
- [x] Compiler into native
- [ ] **More Examples and Documentation** (in progress)
- [ ] Cross Platform
- [ ] Package Manager
- [ ] Bootstrapped

# Usage

First of all, you need to have [Bun](https://bun.sh/) installed. Bun will be replaced with node.js in the future for more cross platform support, but for now, the compiler is usable only on platforms supported by bun.

## Hello, World!

```
include "std"

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

The stck compiler currently supports two targets: its own bytecode and FASM.
FASM is used by default, but you can provide the target using the `--target` (`-t`) parameter.

```bash
$ ./stck.ts hello_world.stck -t bytecode
Hello, World!
```

You can specify the `--build` (`-b`) parameter to compile the program without running it.

```bash
$ ./stck.ts --build hello_world.stck
$ ./hello_world
Hello, World!
```

## More examples

Check the [`examples`](examples) folder for more examples!

# Guide

WIP
