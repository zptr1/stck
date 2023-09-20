# Changelog

This is the changelog for **stck**.

## [unreleased]

### Added

- Added new Rust-like error messages, which are more detailed and look much better than the old messages. [Screenshot](https://cdn.discordapp.com/attachments/994971483040395374/1154149784593117234/image.png)

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
- Removed the `--unsafe` flag
- **Temporarily** removed the virtual machine and the bytecode (will be added back later)
- **Temporarily** removed compile-time assertions (will be added back later)

### Fixed

- Some parsing errors related to macros
- Error reporting now shows more accurate positions for certain errors
- Typechecker now also reports more accurate locations of the types on the stack
- Improved type names in error reporting

## 0.0.1 - 23-08-16

Started working on the language. This version is undocumented