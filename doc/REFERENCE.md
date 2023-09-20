# stck language reference

For a more in-depth explanation, check out the [documentation](./00_INTRODUCTION.md).

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

Name      | Example   | Description
----------|-----------|-------------
`int`        | `69`          | Signed 64-bit integer
`bool`       | `true`        | Either `true` (1) or `false` (0)
`ptr`        | `ptr`         | A memory address
`<t> ptr-to` | `int ptr-to ` | A **typed** memory address to type `t`
`<t>`        | `<t>`         | Generic type
`unknown`    | `unknown`     | Unknown type

Built-in procedures use generic and unknown types, but you cannot use these outside of unsafe procedures.

**NOTE:** Types exist at compile-time only. Everything at runtime is just integers.

# Control Flow

## Conditions

Syntax
```
if <condition> do
  <body>
elif <condition2> do
  <body>
else
  <body>
end
```
Example
```
if 2 2 eq do
  // 2 equals 2
else
  // the laws of the universe no longer work
end
```

## Loops

Syntax
```
while <condition> do
  <body>
end
```
Example
```
// prints numbers from 1 to 10 incrementally
0 while dup 10 lt do
  1 add dup print
end
```

##

# Program

## Procedures
You can use the `proc` keyword to define a procedure.
```
proc main do
  // code here
end
```
The name of the procedure can be anything that is not a literal and can have any special symbols. The procedure with the name `main` gets executed automatically once the program starts.

You can use the name of a procedure to call it. Procedures can also accept data from the stack and return data to the stack. Example:
```
proc print-sum :: int int -> int do
  add print
end

proc main do
  34 35 print-sum
end
```

#### Signatures

A signature is a list of input and output types - input types determine what is needed on top of the stack to call the procedure, and output types determine what the procedure should return into the stack when it finishes executing.

Each procedure that takes something from the stack or returns something onto the stack needs to have a signature defined to ensure that everything is handled properly.

`::` is used to provide the input types, and `->` is used to provide the output types.
Both of them are optional, for example:
```
proc a :: int do
  // ... accepts an integer from the stack
end

proc b -> int do
  // ... returns an integer onto the stack
end

proc c do
  // ... accepts nothing and returns nothing
end
```

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

## Memory Regions

Memory regions are a simple compile-time feature which improves memory management. Memory regions are defined similarly to constants, except a `memory` keyword is used instead and the value must be an integer. The value will be used as a size of the memory region.
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

## Imports
To import a library or a file, use the `include` keyword
```
%include "std"
%include "./example"
```
This will include all constants, procedures and other definitions from the provided file. The `.stck` extension gets added to the path automatically.

## Advanced Type Casting

You can use the `cast` operation to cast elements on the stack from one type to another. (this is a compile-time only operation)
```
// will cast the element on top of the stack to a typed pointer to an integer
cast int ptr-to end
```
You can also cast multiple elements on the stack:
```
// will cast the element on top of the stack to an integer, and the element below the top of the stack to a boolean
cast bool int end
```

## Compile-time assertions

Assertions will prevent the program from compiling unless the provided condition is met. An example would be:
```
assert "There must be 7 days in a week." DAYS_COUNT 7 eq end
```
From the example before, `DAYS_COUNT` is set to 7, but if the value of that constant changes (e. g. a new day gets added or a day gets removed), the compilation will fail, outputting an error.

## Macros

TBD
```
%macro print-sum
  add print
%end

%macro numbers
  34 35
%end

proc main do
  numbers print-sum
  // ... expands to
  //     34 35 add print
end
```
```
%macro loop
  \ while true
%end

proc main do
  loop do "hello, world\n" puts end
  // ... expands to
  // while true do ... end
end
```

## Inline Procedures

Inline procedures are just like regular procedures, except calling them will insert the code of the procedure instead of calling it.
Making a procedure inline might save the overhead of a procedure call, improving the performance for cases when e. g. a small procedure is used a lot of times in the code.

```
inline proc print-sum :: int int -> int do
  add print
end
```

While macros exist, they serve a different purpose, and they get expanded before the typechecking stage. Inline procedures are treated as regular procedures up until the compiler generates the assembly code, which improves typechecking and error reporting.

## Unsafe Procedures

Welcome to the world of undefined behavior and segfaults!
Unsafe procedures don't get typechecked, and you can even use `asm` blocks in them!

The assembly code inside of the assembly blocks gets inserted into the generated assembly source, which allows for performing much more advanced tasks that require high performance or doing something that the language can't.
```
unsafe proc add :: int int -> int do
  asm
    pop rax
    pop rbx
    add rax, rbx
    push rax
  end
end
```
Unsafe procedures can also be inline.

It is heavily recommended to avoid unsafe procedures unless absolutely necessarry.

Unsafe procedures can also use the `unknown` type and generics, for example:
```
unsafe proc swap :: <a> <b> -> <b> <a> do
  asm
    pop rax
    pop rbx
    push rbx
    push rax
  end
end
```

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

### Comparison

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
`not` | `[a: int] -> [~a: int]`              | Bitwise **NOT**
`or`  | `[a: int] [b: int] -> [a \| b: int]` | Bitwise **OR**
`and` | `[a: int] [b: int] -> [a & b: int]`  | Bitwise **AND**
`xor` | `[a: int] [b: int] -> [a ^ b: int]`  | Bitwise **XOR**

### Stack Manipulation

Name | Signature | Description
-----|-----------|-------------
`dup`   | `a -> a a`           | Duplicates the element on top of the stack
`drop`  | `a ->`               | Removes the element on top of the stack
`swap`  | `a b -> b a`         | Swaps two values on top of the stack
`rot`   | `a b c -> b c a`     | Rotates the top three elements on the stack
`over`  | `a b -> a b a`       | Copies the element below the top of the stack
`2dup`  | `a b -> a b a b`     | Duplicates the top two elements on the stack

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

# Prelude

Prelude is a built-in library that is included into every program automatically.

### Constants

| Name | Value | Description
|------|-------|-------------
| `sizeof(u8)`   | `1` | Size of a 8-bit integer in bytes
| `sizeof(u16)`  | `2` | Size of a 16-bit integer in bytes
| `sizeof(u32)`  | `4` | Size of a 32-bit integer in bytes
| `sizeof(u64)`  | `8` | Size of a 64-bit integer in bytes
| `sizeof(int)`  | `8` | Size of an integer
| `sizeof(ptr)`  | `8` | Size of a pointer
| `sizeof(bool)` | `1` | Size of a boolean

**Note:** while the `sizeof(bool)` constant equals `1` (8-bit), all values in the stack stored as 64-bit integers. Such constants are provided only for memory management.

### Mathematical operations

| Name | Signature | Description
|------|-----------|-------------
| `ptr+` | `[a: ptr] [b: int] -> [a + b: ptr]` | Offsets a pointer by an integer by adding them
| `ptr-` | `[a: ptr] [b: int] -> [a - b: ptr]` | Offsets a pointer by an integer by subtracting them
| `div` | `[a: int] [b: int] -> [a / b: int]` | Same as `divmod`, but drops the remainder
| `mod` | `[a: int] [b: int] -> [a % b: int]` | Same as `divmod`, but drops the quotient
| `idiv` | `int int -> int` | Ditto, but for `idivmod`
| `imod` | `int int -> int` | Ditto, but for `idivmod`

### Logical operations

| Name | Signature | Description
|------|-----------|-------------
| `lnot` | `[a: bool] -> [!a: bool]` | Negates a boolean
| `land` | `[a: bool] [b: bool] -> [a && b: bool]` | Checks whether both booleans are `true`
| `lor`  | `[a: bool] [b: bool] -> [a || b: bool]` | Checks whether at least one of the booleans is `true`
| `lxor` | `[a: bool] [b: bool] -> [a ^^ b: bool]` | Checks whether only one of the booleans is `true`

### Memory Operations

| Name | Signature | Description
|------|-----------|-------------
| `!8`    | `int ptr`    | Alias for `write8`
| `!16`   | `int ptr`    | Alias for `write16`
| `!32`   | `int ptr`    | Alias for `write32`
| `!64`   | `int ptr`    | Alias for `write64`
| `@8`    | `ptr -> int` | Alias for `read8`
| `@16`   | `ptr -> int` | Alias for `read16`
| `@32`   | `ptr -> int` | Alias for `read32`
| `@64`   | `ptr -> int` | Alias for `read64`
| `!int`  | `int ptr`    | Writes an integer
| `!ptr`  | `ptr ptr`    | Writes a pointer
| `!bool` | `ptr ptr`    | Writes a boolean
| `@int`  | `ptr -> int` | Reads an integer
| `@ptr`  | `ptr -> ptr` | Reads a pointer
| `@bool` | `ptr -> ptr` | Reads a boolean

# Standard Library

Note: The standard library is currently not finished. Anything can change at any time.

The standard library is separated into multiple different submodules, currently
- `io` - interacting with the standard input/output
- `sys` - interacting with the system
- `rand` - random number generation
- `str` - string-related utilities

You can include all modules at once by just importing the `std` library, or you can include only a single specific module like that:
```
%include "std/io"
%include "std/sys"
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
| `streq`       | `[str1: int ptr] [str2: int ptr] -> [str1 == str2: bool]` | Checks whether both strings are equal
| `cstr-to-str` | `[cstr: ptr] -> [str: int ptr]` | Converts a C-String to a regular string
| `is-digit`    | `[char: int] -> bool`           | Checks whether the provided charcode is a digit (`0`..`9`)
| `parse-uint`  | `[str: int ptr] -> int`         | Parses an unsigned integer. Any invalid characters are ignored.
| `parse-int`   | `[str: int ptr] -> int`         | Parses a signed integer. Any invalid characters are ignored.

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