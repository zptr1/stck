# stck language reference

For a more in-depth explanation, check out the [documentation](./01_GETTING_STARTED.md).

Please note that the language is a work in progress and anything can be changed at any time.

# Literals

Name        | Example   | Type        | Description
------------|-----------|-------------|--------------------------------
**Int**       | `69`       | `int`       | A signed 64-bit integer.
**Bool**      | `true`     | `bool`      | Boolean - either `true` (1) or `false` (0)
**Character** | `'E'`      | `int`       | A character.
**String**    | `"Hello"`  | `int` `ptr` | A string.
**C-String**  | `c"World"` | `ptr`       | A null-terminated string.

When a literal is encountered, it's value is pushed onto the data stack that can then be used to perform various operations.

A string literal is a bit different from other literals though - once encountered, the data of the string is stored in the memory instead, and the length of the string gets pushed onto the stack as well as the pointer to the beginning of the string in the memory

C-String is like a regular string but it does not push its length into the stack and ends with a [null terminator](https://en.wikipedia.org/wiki/Null-terminated_string). It is useful for performing syscalls or interacting with C code. (note: this language does not have FFI yet, but that is planned in the near future)

# Types

Name   | Description
-------|-------------
`int`  | Signed 64-bit integer
`ptr`  | Memory address
`bool` | Either `true` (1) or `false` (0)

**NOTE:** Types exist at compile-time only. Everything at runtime is just integers.

# Program

## Procedures
You can use the `proc` keyword to define a procedure.
```
proc main
  // code here
end
```
The name of the procedure can be anything that is not a literal and can have any special symbols. The procedure with the name `main` gets executed automatically once the program starts.

You can use the name of a procedure to call it. Procedures can also accept data from the stack and return data to the stack. Example:
```
proc print-sum
  add print
end

proc main
  34 35 print-sum
end
```

#### Signatures

A signature is a list of input and output types - input types determine what is needed on top of the stack to call the procedure, and output types determine what the procedure should return into the stack when it finishes executing.

To determine whether a procedure is used correctly and there are enough data on top of the stack to call it, the typechecker needs to know the procedure's signature. This language has type inference, which will attempt to automatically determine the signature of a procedure. Although, this might not work as intended sometimes and has some restrictions (e. g. no recursion). You can define the signature of the procedure manually:
```
proc add :: int int -> int do
  // code here
end
```
`::` is used to provide the input types, and `->` is used to provide the output types.
Both of them are optional, for example:
```
proc a :: int do
  // ... accepts an integer from the stack
end

proc b -> int do
  // ... returns an integer to the stack
end

proc c do
  // ... accepts nothing and returns nothing
end
```

## Imports
To import a library or a file, use the `include` keyword
```
include "std"
include "./example"
```
This will include all constants, procedures and other definitions from the provided file. The `.stck` extension gets added to the path automatically.

## Constants
You can use the `const` keyword to define a constant.
```
const NICE_NUMBER 69 end
```
Constants can contain expressions, which get evaluated at compile-time
```
const ANOTHER_NICE_NUMBER 34 35 add end
```
Using the constant from the example above will push `69` (integer) onto the stack.

Constants can be of any type - integers, booleans or strings.

#### `offset` / `reset`

This language offers [Go-like enums](https://go.dev/ref/spec#Iota).
```
const MONDAY    1 offset end  // 0
const TUESDAY   1 offset end  // 1
const WEDNESDAY 1 offset end  // 2
...
const DAYS_COUNT reset end    // 7
```
This feature can also be used to define "structures":
```
const Str.len     sizeof(int) offset end  // 0
const Str.data    sizeof(ptr) offset end  // 8
const sizeof(Str) reset end  // 16
```

## Compile-time assertions

Assertions will prevent the program from compiling unless the provided condition is met. An example would be:
```
assert "There must be 7 days in a week." DAYS_COUNT 7 eq end
```
From the example before, `DAYS_COUNT` is set to 7, but if the value of that constant changes (e. g. a new day gets added or a day gets removed), the compilation will fail, outputting an error.

## Memory Regions

Memory regions are a simple compile-time feature which improves memory management. Memory regions are defined similarly to constants, except a `memory` keyword is used instead and the value must be integer. The value will be used as a size of the memory region.
```
memory a 255 end
```
The example above will allocate 255 bytes in the memory.
You can use the name of the memory region to get the pointer to that region.

You can also use expressions as well. For example, this will allocate a memory region for 10 integers:
```
memory example sizeof(int) 10 mul end
```

Technically, only one memory region gets allocated, and memory regions just define the offsets. There are no restrictions, so be careful!

## Macros

TBD
```
macro print-sum
  add print
end

macro numbers
  34 35
end

proc main
  numbers print-sum
  // ... expands to
  //     34 35 add print
end
```
```
macro loop
  \ while true
end

proc main
  loop do "hello, world\n" puts end
  // ... expands to
  // while true do ... end
end
```

## Inline Procedures

Inline procedures are just like regular procedures, except calling them will insert the code of the procedure instead of calling it.
Making a procedure inline might save the overhead of a procedure call, improving the performance for cases when e. g. a small procedure is used a lot of times in the code.

```
inline proc print-sum do
  add print
end
```

While macros exist, they serve a different purpose, and they get expanded before the typechecking stage. Inline procedures are treated as regular procedures up until the compiler generates the assembly code, which improves typechecking and error reporting.

## Unsafe Procedures

Welcome to the world of undefined behavior and segfaults!
Unsafe procedures don't get typechecked, and you can even use `asm` blocks in them!

The assembly code inside of the assembly blocks gets inserted into the generated assembly source, which allows for performing much more advanced tasks that require high performance or doing something that the language can't.
```
unsafe proc add :: int int do
  asm
    pop rax
    pop rbx
    add rax, rbx
    push rax
  end
end
```
**Warning:** It is heavily recommended to avoid unsafe procedures unless absolutely necessarry.

Unsafe procedures can also be inline.

# Intrinsics (built-in procedures)

### Mathematical operations

Name | Signature | Description
-----|-----------|-------------
`add`     | `[a] [b] -> [a + b]`           | Takes two values from the top of the stack, adds them and pushes the result into the stack
`sub`     | `[a] [b] -> [a - b]`           | Subtracts two values
`mul`     | `[a: int] [b: int] -> [a * b: int]`     | Multiplies two unsigned integers
`divmod`  | `[a: int] [b: int] -> [a / b: int] [a % b: int]` | Performs [Euclidean division](https://en.wikipedia.org/wiki/Euclidean_division) on two unsigned integers
`imul`    | `[a: int] [b: int] -> [a * b: int]`     | Multiplies two signed integers
`idivmod` | `[a: int] [b: int] -> [a / b: int] [a % b: int]` | Performs Euclidean division on two signed integers

`add` and `sub` intrinsics accept any type, but the type of two values must be the same - e. g. you can add a pointer to a pointer, or an integer to an integer, but can't add a pointer to an integer. Note: You can use the `cast(int)`, `cast(ptr)` or `cast(bool)` intrinsics to convert one type to another.

### Comprasion

Name | Signature | Description
-----|-----------|-------------
`lt`  | `[a: int] [b: int] -> [a < b: bool]` | Checks if an integer is less than another
`gt`  | `[a: int] [b: int] -> [a > b: bool]` | Checks if an integer is greater than another
`eq`  | `[a: int] [b: int] -> [a == b: bool]` | Checks if two integers on top of the stack are equal
`neq` | `[a: int] [b: int] -> [a != b: bool]` | Checks if two integers on top of the stack are not equal

### Bitwise Operations

Name | Signature | Description
-----|-----------|-------------
`shl` | `[a: int] [b: int] -> [a << b: int]` | Performs a left bit shift
`shr` | `[a: int] [b: int] -> [a >> b: int]` | Performs a right bit shift
`not` | `[a: int] -> [~a: int]`     | Bitwise **NOT**
`or`  | `[a: int] [b: int] -> [a \| b: int]` | Bitwise **OR**
`and` | `[a: int] [b: int] -> [a & b: int]` | Bitwise **AND**
`xor` | `[a: int] [b: int] -> [a ^ b: int]` | Bitwise **XOR**

### Stack Manipulation

Name | Signature | Description
-----|-----------|-------------
`dup`   | `a -> a a`           | Duplicates the element on top of the stack
`drop`  | `a ->`               | Removes the element on top of the stack
`swap`  | `a b -> b a`         | Swaps two values on top of the stack
`rot`   | `a b c -> b c a`     | Rotates the top three elements on the stack
`over`  | `a b -> a b a`       | Copies the element below the top of the stack
`2dup`  | `a b -> a b a b`     | Duplicates the top two elements on the stack
`2swap` | `a b c d -> d c b a` | Swaps the top four elements on the stack

### Memory

Name | Signature | Description
-----|-----------|-------------
`write8`  | `int ptr`    | Writes a given 8-bit integer at the provided memory address
`write16` | `int ptr`    | Writes a 16-bit integer to the memory
`write32` | `int ptr`    | Writes a 32-bit integer to the memory
`write64` | `int ptr`    | Writes a 64-bit integer to the memory
`read8`   | `ptr -> int` | Reads a 8-bit integer from the provided memory address
`read16`  | `ptr -> int` | Reads a 16-bit integer from the memory
`read32`  | `ptr -> int` | Reads a 32-bit integer from the memory
`read64`  | `ptr -> int` | Reads a 64-bit integer from the memory

### Program

Name | Signature | Description
-----|-----------|-------------
`print` | `[n: int]`     | Outputs an integer to the standard output
`puts`  | `[str: int ptr]` | Outputs a string to the standard output

### Compile-time

Name | Signature | Description
-----|-----------|-------------
`cast(int)`    | `a -> int`   | Converts the element on top of the stack to an integer
`cast(ptr)`    | `a -> ptr`   | Converts the element on top of the stack to a pointer
`cast(bool)`   | `a -> bool`  | Converts the element on top of the stack to a boolean
`<dump-stack>` |              | A debug intrinsic that outputs the current types on the stack once encountered at compile time.
`<here>`       | `-> int ptr` | Pushes a string `"<path>:<row>:<col>"` representing a location where this intrinsic was called at, where `path` is the full path to the file, `row` is the line number and `col` is the column number. Useful for debug purposes.

# Standard Library

Note: The standard library is currently not finished. Anything can change at any time.

The standard library is separated into multiple different submodules, currently
- `io` - interacting with the standard input/output
- `sys` - interacting with the system
- `rand` - random number generation
- `str` - string-related utilities

You can include all modules at once by just importing the `std` library, or you can include only a single specific module like that:
```
include "std/io"
include "std/sys"
...
```
Please note that some modules might depend on another (e. g. `io` depends on `sys`), so importing each module separately is a bit pointless. It should be fine to just import the entire standard library.

## `std/io`

#### Constants

| Name | Value | Description
|------|-------|-------------
| `stdin`  | `0` | Standard input stream
| `stdout` | `1` | Standard output stream
| `stderr` | `2` | Standard error stream

#### Procedures

| Name | Signature | Description
|------|-----------|-------------
| `putu` | `[n: int]` | Outputs an unsigned integer without a newline to stdout
| `puti` | `[n: int]` | Outputs a signed integer without a newline to stdout
| `eputs` | `[str: int ptr]` | Outputs a string to stderr

## `std/str`

#### Enums

- **`Str`**
  * **`len`** - `int` - the length of the string
  * **`data`** - `ptr` - pointer to the data of the string

#### Procedures

| Name | Signature | Description
|------|-----------|-------------
| `is-digit` | `[char: int] -> bool` | Checks whether the provided charcode is a digit (`0`..`9`)
| `parse-uint` | `[str: int ptr] -> int` | Parses an unsigned integer. Any invalid characters are ignored.
| `parse-int` | `[str: int ptr] -> int` | Parses a signed integer. Any invalid characters are ignored.
| `cstr-to-str` | `[cstr: ptr] -> [str: int ptr]` | Converts a C-String to a regular string

**Warning:** `cstr-to-str` DOES NOT copy the data of the string, but actually just calculates the length of it and returns the same pointer.

## `std/sys`

Internally, `sys` is divided into multiple sub-modules for different system compatibility. Currently, only Linux is supported.

### `std/sys/linux`

#### Constants

| Name | Value | Description
|------|-------|-------------
| `O_*`   | | Flags for the [`openat`](https://linux.die.net/man/2/openat) Linux syscall
| `S_*`   | | Modes for the [`openat`](https://linux.die.net/man/2/openat) Linux syscall
| `sys_*` | | All Linux syscalls. List taken from [here](https://filippo.io/linux-syscall-table/)

#### Structures

- **`timespec`**
  * **`tv_sec`** - `int` - whole seconds
  * **`tv_nsec`** - `int` - nanoseconds

#### Procedures

| Name | Signature | Description
|------|-----------|-------------
| `write` | `[str: int ptr] [fd: int] -> int` | Writes a string to the provided `fd`
| `read`  | `[size: int] [ptr] [fd: int] -> int` | Reads `size` bytes to `ptr` from `fd`
| `fstat` | `[ptr] [fd: int] -> int` | Gets stats of `fd` and saves them into `ptr`
| `close` | `[close: fd] -> int` | Closes `fd`
| `openat` | `[mode: int] [flags: int] [path: ptr]` | Opens a file at `path` (C-string) with the provided `flags` and `mode`
| `exit` | `[code: int]` | Exits the process with the provided code
| `gettime_s` | `-> int` | Gets the current UNIX timestamp in seconds
| `gettime_ms` | `-> int` | Gets the current UNIX timestamp in milliseconds
| `gettime_ns` | `-> int` | Gets the current UNIX timestamp in nanoseconds

## `std/rand`

**Note:** Uses the [LCG](https://en.wikipedia.org/wiki/Linear_congruential_generator) algorithm

#### Constants

| Name | Value | Description
|------|-------|-------------
| `LCG_MULTIPLIER` | `6364136223846793005` | The multiplier used for the LCG algorithm
| `LCG_INCREMENT`  | `1442695040888963407` | The increment used for the LCG algorithm

Uses parameters from MMIX by Donald Knuth

#### Memories

| Name | Size | Description
|------|-----------|--------------
| `lcg_seed` | `int` (8 bytes) | Stores the current seed

#### Procedures

| Name | Signature | Description
|------|-----------|-------------
| `rand`      | `-> int` | Generates a random 32-bit integer
| `randseed`  | `[seed: int]` | Sets the current seed
| `randrange` | `[min: int] [max: int] -> int` | Generates a random integer within the specified range

**Note:** Before using `rand` or `randrange`, a seed must be seed using `randseed`. A recommended approach is to use `gettime_ms` from `sys` as the current seed.