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

Edit: probably in a different way

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

#### Quotes

sorry im too lazy to explain this

## Local Memory Regions

Implemented

## Assembly Imports

Importing files with an `.asm` extension would include them in the compiled `.asm` source.
```
%include "./example.asm"
```

## Special `_load_` procedure
This procedure is not callable and cannot take any parameters or output anything.

This procedure can be defined as many times, and will be called when the program starts before `main`.

## Special config constants

For example
```
const STCK_CALLSTACK_SIZE 10000 end
```

## Sized Pointers

Using integers
```
proc example :: ptr-of 16 do
  // the provided pointer should have at least 16 bytes available
end
```
Or constants
```
const MEM_SIZE 69 end

memory a_mem 69 end
memory b_mem 42 end

proc example -> ptr-of MEM_SIZE do
  // the procedure must return a pointer with at least MEM_SIZE bytes
  // a_mem will work, because it is 69 bytes, but b_mem won't, because it is only 42 bytes.
end
```
These will be the same type as regular pointers, but will contain size information.
Pointers with unknown size can be used anywhere, but pointers with known size will only be able to be used when they're at least the required amount of bytes.
For example, a pointer to 100 bytes can be used in a procedure that requires a pointer to 64 bytes, but a pointer to 50 bytes cannot.
