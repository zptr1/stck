# stck reference

# Stack
**stck** uses two stacks: data stack and a call stack. The call stack is used for storing return addresses when calling procedures, and the data stack is used for the actual data. However, the call stack can also be used for temporarily allocating some memory. All cells on the data stack are 64-bit.

# Reverse Polish Notation
**stck** uses RPN as its syntax. Literals (such as integers or strings) push values onto the stack, and words call procedures which operate on the stack.
```
34 35 add print
```
This example pushes two integers, `34` and `35`, onto the stack, and then calls the `add` operation, which takes two values from the stack, adds them, and pushes the result back. `print` takes the integer from the top of the stack and prints it.

stck has various stack operations, such as `dup`, which duplicates the value on top of the stack, `swap`, which swaps two values on top of the stack, or `drop`, which deletes the value on top of the stack. The full list of operations can be found later in this reference.

# Literals

## Word
A word is any sequence of characters surrounded by whitespace.
A word is used as an indentifier when declaring something (e. g. a procedure, a constant, etc).
Words are also used to call these procedures, use constants and such. There is no syntatical difference between using a value or calling a procedure.

All these are valid words:
```
hello hello.world hello-world hello_world hello(world) + - = * / 123hello
```

## Comment
Anything after `//` is ignored until the next line. The comment must either be at the start of the line, or have a space before it.

## Integer
Pushes a 64-bit signed integer onto the stack. Hexadecimal integers are prefixed with `0x`. You can use underscores to separate large numbers.
```
123
-69
0xFF
1_000_000
```

## String
Pushes two values onto the stack: the length of the string and a pointer to the start of the string. The string is encoded in UTF-8. Unicode characters are supported. Use backslashes to escape a character. Special escape sequences are newline (`\n`), carriage return (`\r`), tab (`\t`) and unicode (`\u123A`).
```
"Hello, World!\n"
"Supported escape sequences: \n\r\t\"\u0D9E"
```
All strings are also null-terminated, but keep in mind that mutating them manually does not ensure that the string remains properly null-terminated.

While you could remove the length of the string from the stack if you don't need it, you should use **C-Strings** instead, which only push the pointer onto the stack:
```
c"This string is null-terminated"
```

**Raw strings** can be used to include all escape sequences (except `\"`)
```
r"Hello\n\"World"  // Hello\n"World
```

## Character
Has the same syntax as the string, but uses single quotes instead and allows only one character.
Pushes the numerical code of that character as an integer onto the stack.
```
'E'       // 69
'π'       // 960
'\u0D9E'  // 3486
```

## Boolean
`true` and `false` both push a boolean onto the stack, which can be used in conditions.

# Preprocessor

## Imports

You can include another stck program or library into yours by using the `%include` preprocessor directive.
```
// Includes a library from the `lib` folder of the compiler or the current working directory
%include "std"

// Includes a file relative to the current file.
%include "./other"

// Includes a file from an absolute path
%include "/somewhere/else"
```
The `.stck` extension is appended automatically.

## Macros

You can start a macro definition using the `%macro` preprocessor directive, followed by the name of the macro, and end it with `%end`. After defining a macro, using its name will insert the contents of the macro.
```
%macro example
  "Hello world"
%end

example  // Expands to "Hello World"
```
Macros can be re-defined and can use each other. If you use a macro while defining another, it will expand and its contents will be a part of the new macro. Using a macro before defining it will not expand it.
```
%macro first  second  %end
%macro second "hello" %end
%macro third  second  %end
%macro second "world" %end
```
In this case, `second` did not exist when `first` was defined, so using `first` expands to `second`, which will expand to its last definition, which would be "world". But `third` was defined after `second` was first defined as "hello", so using `third` will expand to "hello".

Currently, macros do not take any input. This will be changed in the future.

You can also define macros inside of macros, though, this is probably useless in most cases.
To remove a macro, use the `%del` processor directive followed by the name of the macro.

# Types

**stck** is statically typed. It has four types: integers, pointers, typed pointers, booleans.

- `int` - integer
- `ptr` - pointer
- `bool` - boolean
- `ptr-to [type]` - typed pointer

There are two more special types which typically cannot be used in a program: `unknown`, which accepts any type, and generics.

## Generics

Generics can be defined by enclosing a word in angle brackets, like `<a> <b> <c>`. These also accept any type, except that the type is preserved and can be referred to in the same context. For example, `<a> <a>` would require two values with identical types.
Stack operations such as `dup` or `swap` use these generics to allow you to work with any types while also properly preserving the structure of the stack.

Generics can also be used in typed pointers, for example, `<a> ptr-to <a>` will require a value and a pointer which points to a value with the same type.

## Type signatures

Type signatures are a list of types that represent the structure of the stack, with the last type being the one on top of the stack.
For example, `int ptr` means that the value on top of the stack must be a pointer, and the value below that must be an integer.
Strings are typically represented as `int ptr` (length and data).

## Casting

You can use the `cast ... end` block to cast types on the stack.
For example, if you were given two booleans, you can cast them to integers like this:
```
cast int int end
```
If you were given two pointers, but want to cast the first to a pointer to an integer, and the second to a pointer to a pointer:
```
cast ptr-to int ptr-to ptr end
```
The last type is the new type on top of the stack, the type below that is the new type below the top of the stack, and so on.

**stck** has a few built-in macros for quickly casting a single value to a type: `cast(int)`, `cast(ptr)` and `cast(bool)`.

# Definitions

## Procedures

A procedure can be defined with the `proc` keyword, followed by the name, optionally the procedure's signature and the body.
```
proc main do
  // procedure body here
end
```
This example defines the procedure called `main` with no signature. This is a special procedure, which will be called when the program starts.

### Procedure signatures

Procedure signatures consist of input types and output types. In order to call a procedure, the stack must match the procedure's input signature, and in order for the procedure to return, its stack must match the output signature.
```
proc strlen :: int ptr -> int do
  // Strings are stored as `int ptr`, with the integer being their length,
  // so we just have to discard the pointer:
  drop
end
```
Here, we define a procedure called `strlen` which accepts an integer and a pointer and outputs one integer.
In order to call the defined `strlen`, your stack must contain at least two values, with the value on the top being a pointer and the value below that being an integer. The program will not compile otherwise.
And, in order for the defined procedure to work, it must consume all unnecessary data, and return only one integer.

### Inline Procedures

Inline procedures are a useful optimization for small procedures. While it might slightly increase the size of the program, calling a small procedure a lot of times might be much more inefficient than just putting its contents in the place of a call.

To define an inline procedure, just add `inline` before `proc`:
```
inline proc strlen :: int ptr -> int do
  drop
end
```
Now, whenever you use `strlen`, it will get inlined to `drop`, instead of calling this procedure every time.

### Unsafe Procedures

You can define an unsafe procedure by adding `unsafe` before `proc`.
These allow you to use inline assembly blocks (`asm ... end`), use unknown types and generics, and skip any typechecking.
```
unsafe proc add-any :: <a> <b> -> <a> do
  asm
    pop rax
    pop rbx
    add rax, rbx
    push rax
  end
end
```
Please note that the compiled stck binaries use the `r14` and `r15` registers for switching between the call stack and the data stack, and store the end of the data stack in `rbp` to check for callstack overflow.
Make sure to restore them back to their original state if you need to use them.

## Constants

Constants can be defined using the `const` keyword followed by the name and the value of the constant.
```
const NUMBER 123456789 end
```
After defining this constnat, using `NUMBER` will push 123456789 onto the stack.

You can also put expressions instead of values, and they will be evaluated at compile-time:
```
const FOUR 2 2 add end
```

Constants cannot contain strings, conditions, loops or procedure calls.

You can, however, use casting.
For example, booleans and the null pointer are defined in the stck prelude like this:
```
const true  1 cast(bool) end
const false 0 cast(bool) end
const NULL  0 cast(ptr) end
```

### Enums and Structs

Currently, there's no separate way to create enums or structures in stck. stck has the `offset` and `reset` operations for that.
`offset` accepts an integer, outputs the global counter and then increments it by the provided integer. `reset` outputs the global counter and resets it to zero.
```
const ZERO  1 offset end
const ONE   1 offset end
const TWO   1 offset end
const THREE 1 offset end
const FOUR     reset end
```
You can create structures in a similar way:
```
const Str.len     sizeof(int) offset end
const Str.data    sizeof(ptr) offset end
const sizeof(Str)              reset end

const User.name    sizeof(Str) offset end
const User.age      sizeof(u8) offset end
const sizeof(User)              reset end
```
Then use pointer operations to access that specific field:
```
proc get-user-age :: ptr -> int do
  User.age ptr+ read8
end
```
(`ptr+` adds an integer to a pointer and `ptr-` subtracts an integer from a pointer.)

## Memory Regions

Memory regions are defined similarly to constants but using the `memory` keyword instead.
```
memory users 100 sizeof(User) mul end
```
This example allocates a memory region for 100 instances of the struct User, which was defined in the example earlier.
Memory regions are statically allocated.

Using the memory regions pushes a pointer to the start of that region, which you can then offset and write to or read from.

### Local Memory Regions

Not implemented yet.
~~Local memory regions are defined inside of a procedure, and instead of being statically allocated, they are allocated on the call stack when the procedure gets called, and automatically deallocated when the procedure returns.~~

## Variables

Variables are currently a bit useless. They are basically memory regions but for types, and since stck does not have structs yet, they can only hold an integer, a pointer or a boolean.
```
var num  int end
var num2 ptr-to int end
```

## Assertions

Assertions allow to check the values of constants at compile-time.
To make an assertion, use the `assert` keyword followed by a string and the compile-time expression that should evaluate to a boolean.
```
const NUMBER 123 end
assert "NUMBER must be 123" NUMBER 123 eq end
```
In this case, the program will only compile if the NUMBER constant is set to 123.

## let-bindings

let-bindings move values from the data stack to the call stack and allow you to refer to them using a word inside of them.
To use them, use the `let` keyword followed by a list of words, and then a `do ... end` block. The value on top of the stack will be assigned to the last word, the value below to the previous word, etc.
```
proc do-four-ops :: int int -> int int int int do
  let a b do
    a b add
    a b sub
    a b mul
    a b div
  end
end
```
In this example, if you provide 123 and 456 to the defined procedure, `a` will be 123 and `b` will be 456.

## FFI

You can use the `extern` keyword followed by the name of the library to link and a list of functions with their signatures to use foreign functions. The compiler will automatically link all provided libraries to the executable.
```
extern "c"
  proc malloc :: int -> ptr end
  proc free :: ptr end
end
```
This example includes libc and two foreign functions, `malloc` and `free`.

If you want to include a funtion but its name is already used, you can use `as`:
```
extern "c"
  proc puts as cputs :: ptr end
end
```

**Tip:** there is a built-in library `libc` that you can include into your project to have the most common functions from libc.

## `override`

Alternatively, if you want to re-define something that was already defined earlier, you can use the `override` keyword.
```
const NUMBER 1223 end
override const NUMBER 456 end
```
In this example, the constant `NUMBER` will equal 456.
Note that, unlike overriding macros, the old versions are not preserved:
```
const NUM 123 end
proc add-num :: int -> int do
  NUM add
end

override const NUM 456 end
```
In this case, even though `add-num` was defined while `NUM` was 123, it will use 456 because the constant was overriden.

You can override any definition *except* intrinsics (built-in procedures).

# Control flow

## Conditions

To make a condition, use the `if` keyword, followed by the condition and the body that will get executed if the condition is true.
Optionally, use `else` to execute something in case the condition was false.
```
proc is-even :: int do
  if 2 mod 0 eq do
    "The number is even.\n" puts
  else
    "The number is odd.\n" puts
  end
end
```
Note that all branches of the condition must result in the same types on the stack: if you remove something, both branches must remove it; if you add something both branches must add the same type; etc.

So, this **will** work:
```
if 2 mod 0 eq do
  "even"
else
  "odd"
end
```
And this **wont** work:
```
if 2 mod 0 eq do
  "even"
else
  123
end
```
If you have only one branch, it must not change any types on the stack at all.
The condition itself can modify the stack, since it always gets executed.

You can use `elif` to chain multple else/ifs:
```
proc fizz-buzz :: int do
  if dup 15 mod 0 eq do
    "FizzBuzz\n" puts
  elif dup 5 mod 0 eq do
    "Buzz\n" puts
  elif dup 3 mod 0 eq do
    "Fizz\n" puts
  else
    dup print
  end
  drop
end
```

## Loops

Use `while` followed by the condition and its body to make a loop.
```
0 while dup 10 lt do
  1 add
  dup print
end
```
This example prints numbers from 1 to 10.

Both the condition and the body must not change the types on the stack.

# Intrinsics

Intrinsics are built-in words baked into the compiler.

## Integer Operations
| Name | Signature | Description |
|------|-----------|--------------
| **add**     | `int int -> int`     | Adds two integers                                  |
| **sub**     | `int int -> int`     | Subtracts two integers                             |
| **mul**     | `int int -> int`     | Performs unsigned multiplication                   |
| **div**     | `int int -> int`     | Performs unsigned division                         |
| **mod**     | `int int -> int`     | Returns the result of the division of two integers |
| **divmod**  | `int int -> int int` | Performs both `div` and `mod` at the same time     |
| **max**     | `int int -> int`     | Returns the maximum value of the two integers      |
| **min**     | `int int -> int`     | Returns the minimum value of the two integers      |

stck also has signed variants of multiplication and division: `imul`, `idiv`, `imod` and `idivmod`

## Comparsion Operations
| Name | Signature | Description |
|------|-----------|--------------
| **eq**   | `int int -> bool` | Checks if the two integers are equal                         |
| **neq**  | `int int -> bool` | Checks if the two integers are not equal                     |
| **lt**   | `int int -> bool` | Checks if the second integer is smaller than the top integer |
| **gt**   | `int int -> bool` | Checks if the second integer is bigger than the top integer  |
| **lteq** | `int int -> bool` | `lt` or `eq` |
| **gteq** | `int int -> bool` | `gt` or `eq` |

## Bitwise Operations
| Name | Signature | Description |
|------|-----------|--------------
| **shl** | `int int -> int` | Performs a left bit shift on two integers  |
| **shr** | `int int -> int` | Performs a right bit shift on two integers |
| **or**  | `int int -> int` | Performs a bitwise OR on two integers      |
| **and** | `int int -> int` | Performs a bitwise AND on two integers     |
| **xor** | `int int -> int` | Performs a bitwise XOR on two integers     |
| **not** | `int -> int`     | Performs a bitwise NOT on an integer       |

## Stack Manipulation
| Name | Signature | Description |
|------|-----------|--------------
| **dup**  | `<a>         -> <a> <a>`     | Duplicates the value on top of the stack |
| **swap** | `<a> <b>     -> <b> <a>`     | Swaps two values on top of the stack     |
| **rot**  | `<a> <b> <c> -> <b> <c> <a>` | Rotates third value on the stack to top  |
| **over** | `<a> <b>     -> <a> <b> <a>` | Copies second value on the stack to top  |
| **drop** | `any -> void`                | Removes the value on top of the stack    |

## Memory

stck has four instructions for reading and four instruction for writing memory:
- `write8`, `write16`, `write32`, `write64` write the provided integer to the pointer with the appropriate size.
- `read8`, `read16`, `read32` and `read64` read an integer from the provided pointer with the appropriate size.

write intrinsics have a signature of `int ptr -> void`, and read intrinsics have a signature of `ptr -> int`

## Program
| Name | Signature | Description |
|------|-----------|--------------
| **puts**       | `int ptr`     | Prints the provided string to stdout                               |
| **print**      | `int`         | Prints the provided integer to stdout                              |
| **exit**       | `int`         | Finishes the execution with the provided exit code.                |
| **offset**     | `int -> int`  | Output the global counter and increment it by the specified value. |
| **reset**      | `void -> int` | Output the global counter and reset it to zero.                    |
| **dump-stack** |               | For debugging: Prints the contents of the entire data stack.       |

# Prelude

**stck** has two preludes: the stck prelude and the assembly prelude. Both are available in `prelude.stck` and `prelude.asm` in the `lib` folder in the compiler. They are automatically included in every stck program.

The assembly prelude defines an entry point and macros for the compiler.
The stck prelude defines some useful constants and operations.

**Macros:** `cast(int)`, `cast(ptr)`, `cast(bool)`

**Constants:** `true`, `false`, `NULL`, `sizeof(u8)`, `sizeof(u16)`, `sizeof(u32)`, `sizeof(u64)`, `sizeof(int)`, `sizeof(ptr)`, `sizeof(bool)`

**Procedures:**
| Name | Signature | Description |
|------|-----------|--------------
| `ptr+`  | `ptr int -> ptr`      | Adds an integer to a pointer
| `ptr-`  | `ptr int -> ptr`      | Subtracts an integer from a pointer
| `lnot`  | `bool -> bool`        | Performs a logical NOT on a boolean
| `land`  | `bool bool -> bool`   | Performs a logical AND on two booleans
| `lor`   | `bool bool -> bool`   | Performs a logical OR on two booleans
| `lxor`  | `bool bool -> bool`   | Performs a logical XOR on two booleans
| `!int`  | `int ptr-to int`      | Writes an integer to a typed pointer
| `!ptr`  | `ptr ptr-to ptr`      | Writes a pointer to a typed pointer
| `!bool` | `bool ptr-to bool`    | Writes a boolean to a typed pointer
| `@int`  | `ptr-to int -> int`   | Reads an integer from a typed pointer
| `@ptr`  | `ptr-to ptr -> ptr`   | Reads a pointer from a typed pointer
| `@bool` | `ptr-to bool -> bool` | Reads a boolean from a typed pointer

# Standard library

TBD
