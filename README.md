# stck

**stck** is a statically typed stack-based concatenative programming language

- [Documentation](doc/00_INTRODUCTION.md)
- [Reference](doc/REFERENCE.md)
- [Examples](examples/)

# Work In Progress

This language is currently being developed by only one person as just a hobby.
While I would really appreciate if people were using this language, the language is not cross platform at all yet and might be unstable or unsafe. Anything can change at any moment.

TL;DR: **Not for production use!**

# Using

**Requirements:** `bun`, `fasm`, `gcc` and `mold`

Use `stck run file.stck` to run a stck program, or `stck build file.stck` to compile it to an ELF64 executable.
For now, **stck** supports Linux x86_64 only.

# Roadmap / To-Do

- [x] Statically typed
- [x] Compiler into own bytecode
- [x] Compiler into native
- [x] FFI
- [ ] **More Features** (in progress)
- [ ] **Optimized** (in progress)
- [ ] **More Examples and Documentation** (in progress)
- [ ] Self-Hosted
- [ ] Package Manager
- [ ] Cross Platform
