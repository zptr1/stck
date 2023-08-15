import { Location, Span } from "../shared/location";
import lineColumn from "line-column";
import chalk from "chalk";
import plib from "path";

function printLine(line: string, lineno?: number, padding: number = 2) {
  const lno = (lineno || "").toString().padStart(padding, " ");
  console.log(lno, chalk.gray("|"), line);
}

function printLines(lines: string[], lineno: number) {
  const padding = (lineno + lines.length).toString().length + 1;

  for (let i = 0; i < lines.length; i++) {
    printLine(lines[i], lineno + i, padding - (lineno + i).toString().length);
  }
}

function printLoc(source: string, span: Span) {
  const lines = source.split("\n");

  const col = lineColumn(source);
  const start = col.fromIndex(span[0]);
  const end = col.fromIndex(span[1]);

  if (start && end) {
    if (start.line == end.line) {
      const line = lines[start.line - 1] || lines.at(-1)!;

      printLine(
        line.slice(0, start.col - 1)
        + chalk.red.underline(line.slice(start.col - 1, end.col - 1))
        + line.slice(end.col - 1),
        start.line
      );
    } else {
      const startLine = lines[start.line - 1] || lines.at(-1)!;
      const endLine = lines[end.line - 1] || lines.at(-1)!;

      printLines(
        [
          startLine.slice(0, start.col - 1)
          + chalk.red.underline(startLine.slice(start.col - 1)),

          chalk.red.underline(endLine.slice(0, end.col - 1))
          + endLine.slice(end.col - 1)
        ],
        start.line
      );
    }
  }
}

export function reportError(message: string, loc: Location, notes: string[] = []): never {
  const source = loc.file.source + chalk.inverse("%");

  console.log();
  printLoc(source, loc.span);
  console.log();

  console.error(chalk.bold.redBright("error:"), chalk.whiteBright(message));

  const pos = lineColumn(source).fromIndex(loc.span[0]);
  console.error(
    chalk.gray("  ~ in"),
    chalk.gray.bold(plib.resolve(loc.file.path))
    + chalk.gray(`:${pos?.line}:${pos?.col}`)
  );

  for (const path of loc.file.parentStack()) {
    console.error(
      chalk.gray("  ~ in"),
      chalk.gray(plib.resolve(path))
    )
  }

  console.log();
  for (const note of notes) {
    console.error(chalk.bold.blue("note:"), chalk.whiteBright(note));
  }

  console.log();
  process.exit(1);
}