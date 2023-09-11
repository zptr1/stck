# A few ideas/plans for stck

Just a collection of my ideas/plans for the language.
These are currently not a part of the language and might change at any time, or not get implemented at all.

While I do have some plans and ideas for the language, I'm still not quite sure where to move to - so any feedback would be appreciated.

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

## `let` bindings

#### ✅ Implemented.

Since this language is stack-based, doing complex tasks could get really hard if you have a lot of data on the stack, and you'll likely end up thinking about operating with the stack much more than actually solving the problem. Doing a lot of operations with the stack also ruins readability, and doing small changes could result in you needing to rewrite the entire thing. Also, there's no way to access the 5th or more elements from the stack.

The `let` block will take elements from the stack and bind them to words, allowing you to access the elements from the stack by just using the word.
```
proc main
  34 35
  let a b do
    a b add print // prints 69
    a print       // prints 34
    b print       // prints 35
  end
end
```
The values from the stack will be moved to the call stack, and removed once the `let` block closes or the procedure stops executing.

## `offset`/`reset` (idea stolen from Porth)

#### ✅ Implemented.

These compile-time procedures could provide a neat way to do enums or structures using constants

`offset` will accept an integer, return the global increment and increment it by the provided integer, and `reset` will return the global increment and reset it to zero.
```
const MONDAY    1 offset end  // 0
const TUESDAY   1 offset end  // 1
const WEDNESDAY 1 offset end  // 2
...
const COUNT_DAYS reset end  // 7
```
This might also be used to define custom "structures", like that:
```
const Str.len     sizeof(int) offset end  // 0
const Str.data    sizeof(ptr) offset end  // 8
const sizeof(Str) reset end               // 16
```

## Structures

Managing large amounts of data manually might get quite hard, and manually defining everything for every structure is not really great either. Structures will be a simple compile-time feature that would get expanded into specific constants and procedures.

An example of how would a structure look like:
```
struct Str
  len  int
  data ptr
end
```
Each field will get expanded to a constant representing the offset of the field and a few inline procedures. For example, the `data` field in the `Str` struct from the example above will get expanded to:

- `Str.data` constant representing the offset of the field in bytes (8)
- `+Str.data` procedure that would accept a pointer to the `Str` structure and add the offset to it
- `@Str.data` procedure that would read the value of the field at a given pointer to the structure
- `!Str.data` procedure that would write the value instead

The structure will also declare a constant representing the size of the structure in bytes, so, the `Str` struct from the example above will declare a constant `sizeof(Str)` with the value 16.

Structure's fields will also be able to use other structures as a type, like this:
```
struct Human
  age  int
  name Str
end
```
However, the procedures for reading or writing the value of the field won't be declared for such fields, and you will need to offset the pointer instead. For example, you could do `+Human.name @Str.len` to get the length of the name (assuming you have a pointer to the `Human` structure on top of the stack)

## Make the builtin mathematical operations accept any types

#### ✅ Implemented.

That's a small idea but I'm putting it in this list since I'm not sure should I do this or not. Currently, the mathematical intrinsics (such as `add` or `sub`) accept only integers and return only integers. While this makes typechecking more strict and might somewhat be useful(?), casting pointers to integers and back every time you need to offset a pointer gets kinda annoying.

The signature of these intrinsics could be changed to either `a b -> a`, accepting two values of any types and returning a value with the first type (so, adding an integer to a pointer would result in a pointer), or to `a a -> a`, accepting two values of the same type and returning a value with the same type. The former sounds the best imo.

## Quotes

Quotes would be defined by surrounding the code with square brackets (`[` and `]`), like that:
```
[ "Hello, World!\n" puts ]
```
The code inside of quotes would not get executed immediately, but an address of the quote will be pushed on top of the stack instead, which can then be used with the `call` intrinsic to run the code inside of the quote. For example,
```
[ 123 print ]
dup call
dup call
call
```
will output the number 123 three times

Quotes would also accept or return specific values to the stack, and the needed types will get automatically inferred by the typechecker. Procedures could also accept an address to a specific quote, although they would need to explicitly provide the needed signature. The type of the quote will be specified by providing the quote's signature in the square brackets. Example:
```
// this procedure accepts an address to the quote, which accepts a pointer and returns a boolean,
// and returns a pointer.
proc find-where :: [ ptr -> bool ] -> ptr do
  // ...
end
```

This feature would indeed be useful for a lot of cases, but implementing it requires changing a lot of stuff related to the current data structure of the typechecking process, and might make the typechecking process much more complicated than it already is. I'll see if I want to implement this in the future.

## Compile-Time Statements

Compile-time statements would let you to make various operations at compile-time, such as including or excluding code during compilation depending on certain conditions or states of the constants or not letting the program compile at all if the certain condition failed.

#### Compile-time conditions
```
%if <condition> do
  ...
%elseif <condition> do
  ...
%else
  ...
%endif
```
(i'm not sure about the prefix yet - either `%`, `#`, `@` or something else)

#### Compile-time assertion (implemented)
```
assert "message" <condition> end
```

For example, the compiler could introduce a global `PLATFORM` constant that would be set to the current operating system the compiler is run on, which would allow you to do something like that:
```
%if PLATFORM "linux" eq do
  include "./syscalls/linux"
%elseif PLATFORM "windows" eq do
  include "./syscalls/windows"
%else
  assert "This platform is not supported, sorry..." false end
%endif
```

This should not be too hard to implement, since I already have compile-time evaluation for constants and memory sizes, and the structure of the preprocessor allows me to add more compile-time stuff to it pretty easily, but at the same time I don't want the language to get too complicated/bloated.

## Top-Level Assembly Blocks

Unsafe procedures can use the `asm` block to insert assembly code directly, allowing them to do tasks without the language's limitations, and sometimes even achieving much greater performance. And while this feature makes the language much more unsafe, the restrictions surrounding this feature should make it clear that it's up to the programmer to make sure their code is safe.

Top-level assembly blocks would get embedded before the instructions, which allows you to do even more stuff - such as defining another `.data` section and allocating own stuff here. But while this allows for even more extensibility and I would want to implement this, this breaks the compatibility even more, and there are no proper restrictions around it, making the language even more unsafe.

I'm not really sure if this feature should even be implemented, at least not in the way I planned.

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
