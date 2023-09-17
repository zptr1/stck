# Ideas/plans for stck

- Multiple numeric types for different sizes - `u8`, `u16`, `u32`, `u64` - and their signed alternatives (`i8`, `i16`, etc).
- Get rid of type inference (or, since it is a rewrite, just not implement it)
- [Type Macros](#type-macros)
- [Typed Pointers](#typed-pointers)
- [Better Generics](#better-generics)
- [Variables and Arrays](#variables-and-arrays)
- [Structures](#structures)
- [Quotes](#quotes)
- [Advanced Type Casting](#advanced-type-casting)
- [Compilation Stages](#compilation-stages)
- [(extra) Think of a better name for the language?](#extra-think-of-a-better-name-for-the-language)

## Type Macros

A type macro would be declared with a `type` keyword, followed by the name and the list of types. The defined type macro could then be used in procedure signatures and it would be expanded to the defined list of types.

An example:
```
type str int ptr end

proc say-hi-to :: str do
  // ...
end
```
would get expanded to
```
proc say-hi-to :: int ptr do
  // ...
end
```

## Typed Pointers

A typed pointer would be defined as `<type> ptr-to`. Example:
```
proc read-int :: u64 ptr-to do
  // ...
end
```
The example above would enforce the pointer to point to an integer and would fail if you try providing the procedure a pointer to something else.

This system does not make memory management fully safe, as typechecking happens at compile-time only, and it is impossible to know the type of some pointers. Due to these limitations, you will be able to pass an untyped pointer to any typed pointer.

## Better Generics

The current type system allows for basic generics, for example `swap :: a b -> b a`. But this system is not really extensible.

The rewrite will overhaul this sytem and allow for more advanced generics.
Here's an example of how could it work combined with typed pointers:
```
proc write :: n n ptr-to      do ... end
proc read  :: n ptr-to   -> n do ... end
```
In this example, the `write` procedure accepts a value of any type, and a typed pointer, which would be required to have the exact same type as the value. So, for example, writing a boolean to a pointer to an integer would fail, but writing an integer to that pointer would be fine.

The `read` procedure accepts a typed pointer and would return a value with the exact same type as the typed pointer. This would fail if

## Variables and Arrays

Variables will be a bit similar to memory regions - they will require to have a defined type instead of a defined size, and would be able to hold only one value instead. Using the variable will push a typed pointer onto the stack.

An example:
```
var inc u64 end

proc increment do
  inc       // pushes a typed pointer to u64
  read      // pushes an u64
  1 add     // increments by one
  inc write // saves u64 to that variable
end
```

Arrays will allow to hold multiple values of a defined type. They would need to have the type and the size both defined, like this:
```
array numbers 10 u64 end
```

**TBD**

## Structures

**TBD**

## Quotes

**TBD**

## Advanced Type Casting

All these changes to the type system make type casting quite hard. Currently, type casting is implemented as just compile-time intrinsics that accept a value of any type and return the needed type (e. g. `cast(int)`).

These will remain, but a new `cast` block will be added for more advanced type casts. The contents of the `cast` block will be used as a type, and the value on top of the stack would be converted to that provided type.

An example:
```
0
cast u64 ptr-to end
```
Here, an integer gets pushed onto the stack, which then gets cast to a typed pointer to `u64`.

This also allows casting to custom structures or quotes.

## Compilation Stages

- **Lexer:** transforms the source code into a list of tokens
- **Preprocessor:** takes the list of tokens, handles imports and macros and returns the processed list of tokens
- **Parser:** parses the list of tokens into AST
- **Typechecker:** typechecks the AST and outputs something with some additional info idk
- **Compiler:**
  * First stage transforms the thing that the typechecker returned into some low representation (some kind of a bytecode)
  * Second stage does compile-time evaluation for constants and assertions
  * Third stage generates the outputting executable

**Problem #1:** how do i handle compile-time conditions? they should be handled by the preprocessor, but its impossible if the compile time evaluation is handled by the compiler. i could make it evaluate the list of tokens, but that would lead to duplicated code and some inconvenience

**Problem #2:** what should the typechecker even return?

**Problem #3:** idk aaaaaa my brain doesn't work rn

## (extra) Think of a better name for the language?

"stck" was a random placeholder name I had chosen an year ago when making a programming language similar to this one. But now that the language becomes more like an actual language, this name sounds too unoriginal and weird, since its just a shorter version of **st**a**ck**. I don't like renaming projects once they've been named, but I don't really like the current name of this language either, so I would like to rename this project.
