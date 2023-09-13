# WORK IN PROGRESS
The documentation is **unfinished.**
If you don't need an in-depth explanation about how everything works, you can just check the [reference](./REFERENCE.md).

# Getting Started

## Installation

The compiler is currently written in TypeScript, using [Bun](https://bun.sh) as a runtime.
You also need to install `fasm` and make sure it's available in `$PATH`.

## Hello, World!

Let's write your first **Hello, World** program and run it!
```
proc main
  "Hello, world!\n" puts
end
```
```bash
$ ./stck run example.stck
Hello, World!
```
You can also compile to a native executable:
```bash
$ ./stck build example.stck
$ ./example
Hello, World!
```

#