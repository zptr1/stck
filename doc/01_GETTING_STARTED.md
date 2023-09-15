# Getting Started

Please note that this documentation is work in progress, as well as the language - everything is subject to change.

If you don't need an in-depth explanation, you can just check out the [reference](./REFERENCE.md).

## Installation

The compiler is currently written in TypeScript, using [Bun](https://bun.sh) as a runtime.

You also need to install [fasm](https://flatassembler.net/) and make sure it's available in `$PATH`.

**Note:** This language is not cross-platform yet and works only on Linux-x86_64 machines. In case you want to try out this language on other systems, you can use the language's virtual machine instead.

## Hello, World!

Let's write your first **Hello World** program and run it!
```
proc main
  "Hello, world!\n" puts
end
```
You run a program using the `run` subcommand:
```bash
$ ./stck run example.stck
Hello, World!
```
You can also compile to a native executable using the `build` subcommand:
```bash
$ ./stck build example.stck
$ ./example
Hello, World!
```

**stck** currently has two targets -- **FASM**, which is used by default, and **its own bytecode**.

Since this language is not cross platform yet and works properly only on Linux, you can use the bytecode instead of native if you're using a different operating system, but please note that the virtual machine is limited in terms of interacting with the system.

You can specify the compilation target using the `--target` (or `-t`) argument when running or building a program
```bash
$ ./stck run example.stck --target bytecode
Hello, World!
$ # you can also compile to a .stbin binary file, like that:
$ ./stck build example.stck -t bytecode
$ ./stck run example.stbin
Hello, World!
```

---

### [⟶ Basics](./02_BASICS.md)
