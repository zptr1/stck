# Getting Started

The compiler is currently written in **TypeScript**, using [Bun](https://bun.sh) as a runtime and [FASM](https://flatassembler.net/) as a compilation target. Install both on your system and make sure they're available in `$PATH`.

## Hello, World!

Let's write your first "Hello, World!" program and run it!

Enter the following code into a new file and save it as *`main.stck`*.
```
proc main do
  "Hello, world!\n" puts
end
```
You can then run the program using the `run` subcommand:
```console
$ ./stck run main.stck
Hello, World!
```
You can also compile the program to an executable using the `build` subcommand:
```console
$ ./stck build main.stck
$ ./main
Hello, World!
```

**Note:** This language is not cross platform yet and works properly only on Linux. However, you can use the bytecode instead of native if you're using a different operating system.

Use the `--target` (or `-t`) argument to specify the compilation target when running or building a program
```console
$ ./stck run main.stck --target bytecode
Hello, World!
```

Congratulations, you've just written your first **stck** program!

## Understanding the program

Let's review this "Hello, World!" program in detail.

The program begins with the line `proc main do` and ends with the line `end`.
These lines define a **procedure** named `main` - it's a special procedure that gets executed once you run a program.

The body of the procedure begins after `do` and ends at `end`, so, in this program, the body of the procedure would be
```
  "Hello, World\n" puts
```
This line does all the work in this tiny program. Let's see what happens here:

- `"Hello, World\n"` is a string literal, which gets pushed onto the stack when encountered;
- `puts` is a built-in word which takes the string from the stack and outputs it to the console.

...

---

### [⟶ Basics](./02_BASICS.md)
