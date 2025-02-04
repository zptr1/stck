# Changelog

This is the changelog for **stck**.

## 0.1.5 - 2025-02-01
Welp, back to working on this language I guess!

### Added
- Added FFI support!!! Some stuff might not work because this is a stack based language but oh well!
- Strings now support unicode characters. Obviously, unicode escape sequences are now also a thing.
- Added raw strings using the `r"..."` syntax. For example, `r"\n\"\u0069"` will output `\n\"\u0069`
- Added `override`, which can be used to override a previously defined object (constant, procedure, memory region, etc)
- Added `mmap`, `munmap` and `readfile` procedures to the standard library
- Added some useful constants and enums to std
- New library `libc` containing libc headers to use for stck
- Added hexadecimal numbers

### Changed
- Improved the way call and data stacks work.
- `reset` and `offset` can now be used at runtime
- The call stack is now allocated on the regular stack instead of being allocated in the executable using `rb`
- The call and data stacks are now swapped more efficiently, using two `mov`s now instead of three.
- Optimized infinite loops

### Removed
- `memcpy` procedure from std

### Fixed
- Fixed `dump-stack` not being usable more than once in one procedure
- The CLI now appends a random string to temporary files when running to avoid possible conflicts when running multiple stck programs at the same time
- The CLI now deletes temporary files
- Fixed `read64` and `write64` being 32-bit instead of 64-bit

## 0.1.4 - 2023-10-10

### Added

- Added compile-time assertions
- `exit` is now a built-in intrinsic
- The main procedure can now optionally return an integer, which will be used as an exit code

### Changed

- Improved the codegen
- Reduced the callstack size from 640KB (±80k call depth) to 80KB (±10k call depth)

### Fixed

- The main procedure was able to have any signature defined which lead to undefined behavior

## 0.1.3 - 2023-10-07

### Added

- Added the `return` keyword
- Added `std/mem` and `std/math` to the standard library
- Added the `min` and `max` intrinsics
- Added the `%del` preprocessor directive to delete already defined macros
- Codegen optimizations for stack operations such as `swap drop`

### Changed

- Empty strings are now allowed
- Moved `std/rand` to `std/math`
- Refactored the compiler and the codegen

### Fixed

- Fixed the tokenization of C-strings

## 0.1.2 - 2023-09-28

### Added

- Added a debug intrinsic `dump-stack` which outputs the data on the stack when called at runtime
- Added missing syscalls to `std/sys/linux`
- Added a `str-chop-left` procedure to `std/str`
- Added comments to procedures from the standard library

### Changed

- Error messages are now more consistent/accurate/clearer
- Untyped pointers are now displayed as `ptr` instead of `ptr(?)` in the error messages
- Booleans have been moved to the prelude and are now not a special token
- The compile-time intrinsic `<dump-stack>` has been renamed to `?stack-types`
- Did some improvements to the lexer. Should be quite faster now

### Removed

- Removed the `--verbose` flag from the CLI
- Removed `?here`

### Fixed

- Fixed wording in some type errors (e. g. "unexpected data" -> "unexpected types")
- `div` and `idiv` erroring in SIGFPE when used multiple times

## 0.1.1 - 2023-09-24

### Added

- Added new Rust-like error messages, which are more detailed and look much better than the old messages
- Added variables
- Added `div`, `mod` and `idiv`, `imod`, which are like `divmod`/`idivmod` but output one value instead

### Changed

- Changed the syntax of typed pointers from postfix to prefix
- The built-in `2dup` intrinsic has been moved to a built-in procedure in the prelude

### Fixed

- Improved the lexer
- Improved the performance of the compiled programs
- Improved type-related errors
- The parser now reports some additional information for some errors
- Fixed some bugs in the standard library
- Fixed the compiler skipping all words in unsafe procedures

## 0.1.0 - 23-09-20

### Added

- [Advanced Type Casting](doc/REFERENCE.md#advanced-type-casting)
- Typed pointers
- Unsafe procedures can now use the `unknown` type
- Added a `check` subcommand to the CLI which typechecks the program but does not run or compile it
- Compile-time expressions can now use the `print` intrinsic to output integers at compile-time for debugging purposes
- The compiler now generates intermediate representation first, which then gets converted to the compilation target (e. g. FASM)
- Added various optimizations for the compiled programs

### Changed

- The `add` and `sub` intrinsics now accept only integers
- Changed the syntax of [conditions](doc/REFERENCE.md#conditions)
- Rewrote the preprocessor, the parser, the type checker and the compiler.
- Preprocessor directives (macro and include) are now prefixed with a percentage symbol
- Preprocessor now does not check for the position of the tokens, meaning macros can now be defined or used anywhere, as well as imports.
- Overhauled the type system, allowing for more advanced types and generics
- Changed the assembly output of the FASM compiler

### Removed

- Constants can no longer contain strings. Use macros instead
- Removed the `2swap` intrinsic
- Removed the `--unsafe` flag from the CLI
- Removed type inference. Procedures are now required to provide the signature.
- **Temporarily** removed the virtual machine and the bytecode (will be added back later)
- **Temporarily** removed compile-time assertions (will be added back later)

### Fixed

- Some parsing errors related to macros
- Error reporting now shows more accurate positions for certain errors
- Typechecker now also reports more accurate locations of the types on the stack
- Improved type names in error reporting

## 0.0.1 - 23-08-16

Started working on the language. This version is undocumented