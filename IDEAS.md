# A few ideas/plans for stck

Just a collection of my ideas/plans for the language.
These are currently not a part of the language and might change at any time, or not get implemented at all.

While I do have some plans and ideas for the language, I'm still not quite sure where to move to - so any feedback would be appreciated.

## Rename the language?

This is not directly related to the features of the language and rather optional, but I still want to think about it.

I don't really like the name of the language anymore, as **stck** was just a placeholder name for my small programming language I made an year ago and never shared anywhere. I didn't have any ideas how to name this language when creating it, so I used the same placeholder name. I was fine with the name at first but now its becoming a proper programming language, and just imo, this name sounds kinda weird and too generic, and might be hard to pronounce.

I don't have any ideas what would the new name be, but should I consider renaming this language?

## Change the syntax of the `if` conditions

Currently, the `if` conditions have the following syntax:
```
[condition] if <body> else [condition] if* <body> else <body> end
```
This doesn't even treat condition as a separate part, as it just takes a boolean from the top of the stack.

This might be quite confusing and inconvenient.

This is also a bit inconsistent, considering that the `while` loops have the condition after the keyword, and compile-time conditions (that are not implemented yet) will also have the condition after the keyword.

The syntax of the `if` conditions could be changed to something like this instead:
```
if [condition] do
  <body>
elseif [condition] do
  <body>
else
  <body>
end
```

## Better Type System

#### More Built-In Types

Currently, the only existing types are `int`, `ptr` and `bool`, which makes typechecking a bit pointless.
The integer type could be split into `u8`, `u16`, `u32`, `u64` and their signed alternatives (`i8`, `i16`, ...).

#### Typed Pointers

A typed pointer would be defined as `<type> ptr-to`. Example:
```
proc read-int :: u64 ptr-to do
  // ...
end
```
The example above would enforce the pointer to point to an integer and would fail if you try providing the procedure a pointer to something else.

Typed pointers would not be allowed to be offset like untyped pointers, and would require using special elements instead (structures, variables, etc).

I'm unsure what to do about untyped pointers though. I could either
- prohibit passing untyped pointers to typed pointers, enforcing type casting
- allow that, but show a warning every time that happens
- allow that without any warnings

The first option sounds the best but at the same time it could get annoying in some cases, as you would need to do type casts every time when passing an untyped pointer to a procedure that requires a typed pointer.

The last option doesn't sound really good, as this makes typed pointers a bit pointless.
The second option could be a compromise between the other two, although having a lot of warnings every time you run or build a program would get annoying.

#### Structures

(not documented properly because i'm lazy)

```
struct Human
  age  u8
  name Str
end
```
Defines
- Procedure `@Human.age` that accepts a typed pointer to the `Human` struct and reads the `age` field, returning `u8`
- Procedure `!Human.age` - ditto, but writes a new value instead
- Procedure `+Human.age` - ditto, but just offets the typed pointer to a typed pointer to that field - returning a typed pointer to `u8` instead
- Procedure `+Human.name` - ditto. The `@` and `!` procedures will not be defined for fields that reference to other structures.

Structures can be used as types as well.

Problem: types can take more than one word! (typed pointers or quotes) Maybe use a separator for determining the name of the field?
```
struct Example
  a :: u8  ptr-to
  b :: Str ptr-to
end

// while i like the above more, something like this would be easier/better to parse:
struct Example2
  u8  ptr-to :: a
  Str ptr-to :: b
end
```

#### Better Generics

The current type system allows for basic generics, for example `swap :: a b -> b a`. But this system is not really extensible.

I want to remake the system, allowing for more advanced usages, for example this:
```
proc write :: n n ptr-to      do ... end
proc read  :: n ptr-to   -> n do ... end
```
In this example, the `write` procedure would accept a value of any type and a typed pointer which would be required to have the exact same type as the provided value. So, for example, calling `write` providing an integer would require a typed pointer to an integer, and providing any other pointer would result in a compilation error.

Same goes for `read` - it'd accept a typed pointer of any type, and return the value of the exact same type. For example, calling `read` providing a typed pointer to a boolean would return a boolean.

This will be restricted to primitive types only, and untyped pointers **will not** be allowed.

#### Variables

Variables will be somewhat similar to memory regions, except they will require to have a defined type instead of a defined size, and will be able to hold only one value instead.

Each variable defines the following things:
- A constant with the same name as the variable that would contain a typed pointer to the variable
- A procedure prefixed with `@` to read the value of the variable
- A procedure prefixed with `!` to write a value to the variable
- A `sizeof()` constant with the name of the variable inside of the parentheses that represents the size of the variable in bytes.

The `@` and `!` procedures are **omitted** if a structure is used as a type of the variable.

For example,
```
var num u64 end
```
would define `num`, `@num`, `!num` and `sizeof(num)`.

```
var inc u64 end
proc increment do
  @inc    // reads the variable, which results in u64
  1 add   // adds 1 to the number
  !inc    // saves the new number to the variable
end
```

#### Arrays

Arrays will be similar to variables, except they will be able to hold multiple values of a defined type. They would need to have both the type and the size defined.

I think incorporating arrays into `var` is much better than defining a new keyword like `array`, but I'm not sure how would that look.
Maybe something like this?
```
var numbers array-of 10 u64 end
```

Each array will define three procedures, each of them accepting an unsigned index of an element of the array.
Each array will also define two constants - `sizeof()` and `length()`, with the name of the array inside of the parentheses. The first constant will have the size of the array in bytes, and the second constant will have the amount of elements the array has.

So, in the example provided abouve, the `numbers` array would define:
- A `numbers` procedure, accepting an index and returning a typed pointer to an element in the array at the provided index.
- A `@numbers` procedure that reads the element at the provided index, which returns `u64` in our case.
- A `!numbers` procedure that writes a new value to the element at the provided index.
- A `sizeof(numbers)` constant which would have the value of `10 * 8` -> `80` in our case (8 is the size of u64)
- A `length(numbers)` constant which would have the value of `10` in our case

The `@` and `!` procedures are **omitted** if a structure is used as a type of the array.

#### Quotes

sorry im too lazy to explain this

#### Advanced Type Casting

Currently, type casting is implemented as just compile-time intrinsics that accept a value of any type and return the needed type (e. g. `cast(int)`). This wouldn't work well with the new type system. To fix this, a new `cast` block could be added for more advanced type casts. The contents of the `cast` block will be used as a type, and the value on top of the stack would be converted to that provided type.

An example:
```
0
cast u64 ptr-to end
```
Here, an integer gets pushed onto the stack, which then gets cast to a typed pointer to `u64`.

**Note:** The example above should not be used. It is used here as just an example, and using it in an actual code might lead to undefined behavior.

## Compile-Time Conditions

Compile-time conditions will let you to include or exclude code during compilation depending on certain conditions or states of the constants.

```
%if <condition> do
  ...
%elseif <condition> do
  ...
%else
  ...
%end
```

Compile-time conditions will also be able to use a special operation `def?` followed by a word to check if a specific constant, procedure or memory region has been defined, and `def!` to check if it is not defined.

The compiler could also automatically introduce specific constants depending on the platform, which would allow for additional cross-platform support, for example
```
%if def? _WIN32 do
  include "windows"
%else
  include "posix"
%end
```

## Better Consistency for Preprocessor Directives

#### ❔ Partially Implemented
- Macros are now prefixed with `%`. I'm a bit unsure about imports right now.

Imports, macros and compile-time conditions are handled entirely by the preprocessor and the existance of them is unknown for the stages after, which makes them preprocessor directives.

While compile-time conditions have a specific prefix before their keywords (`%`) so that they are different from the existing runtime conditions, imports and macros do not have that specific prefix, which makes this kinda inconsistent, and I don't like inconsistency. I also think that having preprocessor directives consistent makes it more convenient/clearer to the programmer.

An example
```
%include "std"

%macro numbers
  34 35
%end

proc main
  numbers add print
end
```

## Local Memory Regions

Currently, memory regions can be defined only globally, and the memory is allocated statically even if it is not used for most of the time. Local memory regions will be allocated only when the procedure is called and will be automatically deallocated when the procedure has finished executing.
```
proc main
  memory a 8 end

  6942 a write64
  a read64 print
end
```
Small local memory regions will be allocated on the callstack, but large memory regions will be allocated using syscalls instead.

## Assembly Imports

Importing files with an `.asm` extension would include them in the compiled `.asm` source.
```
include "./example.asm"
```

## FFI/Linking

Currently, the compiler outputs a native executable without any linking. Using a linker could improve the cross platform support and allow for even more functionality.

Here's an example:
```
// include the `puts` function from the C standard library
extern puts

// will automatically create 7 procedures - 'puts()', 'puts(1)', 'puts(2)', ...
// these procedures could then be used to call the included external function using the provided amount of arguments
// (no arguments for `puts()`, one argument for `puts(1)` and so on)

proc main
  c"Hello, World\n" puts(1) drop
end
```
(**TODO:** haven't thought about how would including custom external functions work yet)
