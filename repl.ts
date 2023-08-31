import { readSync } from "fs";

// TODO: This is a proof-of-concept.
// The code needs to be rewritten properly, but its midnight and I want to sleep

export enum DataType {
  Int,
  Ptr,
  Bool
}

process.stdin.setRawMode(true);
function readChar() {
  const buf = Buffer.alloc(1);
  readSync(0, buf, {
    offset: 0,
    length: 1
  });
  return buf;
}

function updateSub(str: string, cursor: number) {
  process.stdout.moveCursor(0, 1);
  process.stdout.cursorTo(0);
  process.stdout.clearLine(0);
  process.stdout.write(`\x1b[30m${str}\x1b[0m`);
  process.stdout.moveCursor(0, -1);
  process.stdout.cursorTo(cursor);
}

function prompt() {
  let ln = "";
  let cursor = 0;
  let exit = false;

  process.stdout.write(">\n ");
  process.stdout.moveCursor(1, -1);

  // Backspace      127
  // Ctrl+Backspace 23
  // Ctrl+C         3
  // Ctrl+Z         26
  // Escape         27
  // Enter          13
  // PageUp         27 91 53 126
  // PageDn         27 91 54 126
  // Home           27 91 72
  // End            27 91 70
  // Left           27 91 68
  // Right          27 91 67
  a: while (true) {
    const [ch] = readChar();

    if (ch == 3) {
      if (exit) break;
      updateSub("Press Ctrl+C again to exit", cursor + 2);
      exit = true;
      continue;
    } else if (ch == 26) {
      process.stdin.setRawMode(false);
      process.exit(127);
    } else {
      exit = false;
    }

    if (ch == 127) {
      if (ln.length) {
        process.stdout.moveCursor(-1, 0);
        process.stdout.write(" ");
        process.stdout.moveCursor(-1, 0);
        ln = ln.slice(0, cursor - 1) + ln.slice(cursor + 1);
        cursor--;
      }
    } else if (ch == 13) {
      break;
    } else if (ch >= 32) {
      const char = String.fromCharCode(ch)
      process.stdout.write(char);
      ln += char;
      cursor++;
    }

    const stack: [DataType, string, number][] = [];
    let i = 0;

    function checkStack(req: DataType[]): boolean {
      const valid = (
        stack.length >= req.length
        && !stack.slice(-req.length).some(([x], i) => req[i] != x)
      );

      if (!valid) {
        if (stack.length) {
          updateSub(
            `\x1b[9;2;31m${
              stack.slice(-req.length).map((x) => x[1]).join(" ")
            }\x1b[0;31m ! \x1b[0;30m${
              req
                .map((x) => DataType[x].toLowerCase())
                .join(" ")
            }`,
            cursor + 2
          );
        } else {
          updateSub(
            `\x1b[0;31m! \x1b[0;30m${
              req
                .map((x) => DataType[x].toLowerCase())
                .join(" ")
            }`,
            cursor + 2
          );
        }
      }

      return valid;
    }

    for (const word of ln.split(/\s+/g)) {
      if (word.match(/^\d+$/)) {
        stack.push([DataType.Int, word, i++]);
      } else if (word.match(/^".+"$/)) {
        const j = i++;
        stack.push([DataType.Int, `int${j}`, j]);
        stack.push([DataType.Ptr, `ptr${j}`, j]);
      } else if (word == "swap") {
        stack.push(stack.pop()!, stack.pop()!);
      } else if (word == "drop") {
        stack.pop();
      } else if (word == "dup") {
        const a = stack.pop()!;
        stack.push(a, a);
      } else if (word == "over") {
        stack.push(stack.at(-2)!);
      } else if (word == "rot") {
        const a = stack.pop()!,
          b = stack.pop()!,
          c = stack.pop()!;
        stack.push(b, a, c);
      } else if (word == "add" || word == "sub" || word == "mul") {
        if (!checkStack([DataType.Int, DataType.Int]))
          continue a;
        const b = stack.pop()!, a = stack.pop()!;
        const ai = parseInt(a[1]), bi = parseInt(b[1]);
        if (isNaN(ai) || isNaN(bi)) {
          const op = word == "add" ? "+" : word == "sub" ? "-" : "*";
          stack.push([DataType.Int, `(${a[1]}${op}${b[1]})`, i++]);
        } else {
          const res =
            word == "add"
              ? ai + bi
            : word == "sub"
              ? ai - bi
            : ai * bi;
          stack.push([DataType.Int, res.toString(), i++]);
        }
      } else if (word == "puts") {
        if (!checkStack([DataType.Int, DataType.Ptr]))
          continue a;
        stack.pop(), stack.pop();
      }
    }

    updateSub(stack.map((x) => `\x1b[3${x[2]}m${x[1]}\x1b[0m`).join(" "), cursor + 2);
  }

  process.stdout.moveCursor(0, 1);
  process.stdout.cursorTo(0);
  process.stdout.clearLine(0);

  if (exit) {
    process.stdin.setRawMode(false);
    process.exit();
  }

  return ln;
}

console.log("stck repl");
while (true) prompt();
process.stdin.setRawMode(false);