import chalk from "chalk";

let timeitStart = 0;

export const log = {
  verbose: false,
  info(message: string) {
    if (this.verbose) {
      console.log(chalk.bold("[INFO]"), message);
    }
  },
  timeit(message: string) {
    if (timeitStart) this.end();
    if (!this.verbose) return;

    process.stdout.write(`${
      chalk.bold("[INFO]")
    } ${message} ${
      chalk.gray("...")
    }`);

    timeitStart = Date.now();
  },
  end() {
    if (!timeitStart || !this.verbose) return;

    const took = Date.now() - timeitStart;
    timeitStart = 0;

    process.stdout.moveCursor(-3, 0);
    process.stdout.write(
      chalk.gray(`(${took / 1000}s)`) + "\n"
    );
  }
}