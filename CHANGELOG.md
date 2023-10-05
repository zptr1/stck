# Changelog

This is the changelog for **stck**.

## [unreleased]

### Added

- Added `std/mem` and `std/math` to the standard library
- Codegen optimizations for stack operations such as `swap drop`
- Added a new `return` keyword
- Added `min` and `max` intrinsics
- Added a `%del` preprocessor directive to remove already defined macros

### Changed

- Moved `std/rand` to `std/math`

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

- Added new Rust-like error messages, which are more detailed and look much better than the old messages. [Screenshot](https://cdn.discordapp.com/attachments/994971483040395374/1154350814521999411/image.png)
- Added variables
- Added `div`, `mod` and `idiv`, `imod`, which are like `divmod`/`idivmod` but output one value instead.

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