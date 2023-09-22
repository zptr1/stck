# A few ideas/plans for stck

Just a collection of my ideas/plans for the language.
These are currently not a part of the language and might change at any time, or not get implemented at all.

While I do have some plans and ideas for the language, I'm still not quite sure where to move to - so any feedback would be appreciated.

## Rename the language?

This is not directly related to the features of the language and rather optional, but I still want to think about it.

I don't really like the name of the language anymore, as **stck** was just a placeholder name for my small programming language I made an year ago and never shared anywhere. I didn't have any ideas how to name this language when creating it, so I used the same placeholder name. I was fine with the name at first but now its becoming a proper programming language, and just imo, this name sounds kinda weird and too generic, and might be hard to pronounce.

I don't have any ideas what would the new name be, but should I consider renaming this language?

## Better Type System

#### More Built-In Types

Currently, the only existing types are `int`, `ptr` and `bool`, which makes typechecking a bit pointless.
The integer type could be split into `u8`, `u16`, `u32`, `u64` and their signed alternatives (`i8`, `i16`, ...).

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
  a :: ptr-to u8
  b :: ptr-to Str
end

// while i like the above more, something like this would be easier/better to parse:
struct Example2
  ptr-to u8  :: a
  ptr-to Str :: b
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
  %include "windows"
%else
  %include "posix"
%end
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
%include "./example.asm"
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
