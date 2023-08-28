//# A small utility for testing the compiler
// Will remember the output of each file from `tests` in `tests/output` on the first run
// and compare the outputs in the next runs.

import chalk from "chalk";
import plib from "path";
import fs from "fs";

const tests = fs.readdirSync("./tests").filter((x) => x.endsWith(".stck"));
if (!fs.existsSync("./tests/output")) {
  fs.mkdirSync("./tests/output");
}

console.log("Loaded", tests.length, "tests");

const status = {
  success: 0,
  error: 0,
  new: 0
}

for (const test of tests) {
  process.stdout.write(` … ${chalk.bold(test)}`);

  const start = performance.now();

  const proc = Bun.spawnSync({
    cmd: ["bun", "stck.ts", plib.resolve(plib.join("tests", test))],
    stdout: null
  });

  const took = performance.now() - start;
  const output = [
    "--- STDOUT ---",
    proc.stdout,
    "--- STDERR ---",
    proc.stderr,
    "--- END ---",
    `Exited with code ${proc.exitCode}`
  ].join("\n");

  // bun does not support `process.stdout.moveCursor()` yet, so I have to move the cursor with ANSI codes manually
  // this moves the cursor to the beginning of the current line
  process.stdout.write("\x1b[0G");
  let success = true;

  if (fs.existsSync(`./tests/output/${test}`)) {
    const stored = fs.readFileSync(`./tests/output/${test}`, "utf-8");
    if (stored != output) {
      process.stdout.write(chalk.red.bold(" ✘ "));
      success = false;
      status.error++;
    } else {
      process.stdout.write(chalk.green.bold(" ✔ "));
      status.success++;
    }
  } else {
    process.stdout.write(chalk.yellow.bold(" + "));
    fs.writeFileSync(`./tests/output/${test}`, output);
    status.new++;
  }

  process.stdout.write(`${chalk.gray.bold(test)} ${chalk.gray(`(${took.toFixed(2)}ms)`)}\n`);

  if (!success) {
    console.error(`The program resulted in an unexpected output`);
    console.error(output);
  }
}

console.log();
console.log(chalk.green.bold(status.success), "tests passed,", chalk.red.bold(status.error), "tests failed");

if (status.new) {
  console.log(chalk.yellow.bold(status.new), "new tests have been stored");
}

process.exit();