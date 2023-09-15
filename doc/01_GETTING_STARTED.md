# Getting Started

Please note that this documentation is unfinished, as well as the language - everything is subject to change.

If you don't need an in-depth explanation, you can just check out the [reference](./REFERENCE.md).

## Installation

The compiler is currently written in **TypeScript**, using [Bun](https://bun.sh) as the runtime.

You also need to install [FASM](https://flatassembler.net/) and make sure it's available in **PATH**.

**Note:** This language is not cross-platform yet and works only on Linux-x86_64 machines. However, this language also has it's own bytecode, allowing you to use the language on other systems as well.

## Hello, World!

Let's write your first **Hello World** program and run it!
```
proc main
  "Hello, world!\n" puts
end
```
You can run a program using the `run` subcommand:
```bash
$ ./stck run example.stck
Hello, World!
```
You can also compile to an executable using the `build` subcommand:
```bash
$ ./stck build example.stck
$ ./example
Hello, World!
```

**stck** currently has two targets -- **FASM**, which is used by default, and its own **bytecode**.

Since this language is not cross platform yet and works properly only on Linux, you can use the bytecode instead of native if you're using a different operating system.

You can specify the compilation target using the `--target` (or `-t`) argument when running or building a program
```bash
$ ./stck run example.stck --target bytecode
Hello, World!
```

---

### [⟶ Basics](./02_BASICS.md)
