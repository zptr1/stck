# Basics

This programming language is quite different from the usual programming languages you're used to. It does not have variables nor all that fancy stuff, and primarily uses something called a [stack](https://en.wikipedia.org/wiki/Stack_(abstract_data_type)) instead.

This language's syntax consists of literals - integers, strings, etc. - and words. A literal, when encountered, gets pushed onto the stack. A word, when encountered, calls a procedure with that specific name, which can then take values from the stack or add values to the stack.

A procedure is basically a function - it can accept values from the stack, execute some piece of code and return values onto the stack. For example, the `add` procedure, which is available everywhere, takes two integers from the stack, adds them together and pushes the result onto the stack.

For example, the following program
```
34 35 add
```
would first push `34` (an integer) onto the stack, then push `35`, and then would call the `add` procedure, taking both integers from the stack, summing them - which results in `69` - and pushing the result onto the stack. You can think of this as a [reverse polish notation](https://en.wikipedia.org/wiki/Reverse_Polish_notation).


#

**UNFINISHED**