import { Location, Span } from "../shared/location";
import lineColumn from "line-column";
import chalk, { ChalkInstance } from "chalk";
import plib from "path";

function printLine(line: string, lineno?: number, padding: number = 2) {
  const lno = (lineno || "").toString().padStart(padding, " ");
  console.log(lno, chalk.gray("|"), line);
}

function printLines(lines: [number, string][]) {
  const padding = lines.at(-1)![0].toString().length + 1;

  for (const [lineno, line] of lines) {
    printLine(line, lineno, padding - lineno.toString().length);
  }
}

function printLoc(source: string, span: Span, highlight=chalk.red) {
  const lines = source.split("\n");

  const col = lineColumn(source);
  const start = col.fromIndex(span[0]);
  const end = col.fromIndex(span[1]);

  if (start && end) {
    if (start.line == end.line) {
      const line = lines[start.line - 1] || lines.at(-1)!;

      printLine(
        line.slice(0, start.col - 1)
        + highlight.underline(line.slice(start.col - 1, end.col - 1))
        + line.slice(end.col - 1),
        start.line
      );
    } else {
      const startLine = lines[start.line - 1] || lines.at(-1)!;
      const endLine = lines[end.line - 1] || lines.at(-1)!;

      printLines([
        [
          start.line,
          startLine.slice(0, start.col - 1)
          + highlight.underline(startLine.slice(start.col - 1)),
        ],
        [
          end.line,
          highlight.underline(endLine.slice(0, end.col - 1))
          + endLine.slice(end.col - 1)
        ]
      ]);
    }
  }
}

function report(
  color: ChalkInstance,
  type: string,
  message: string,
  loc: Location,
  notes: string[] = []
) {
  const source = loc.file.source + chalk.inverse("%");

  console.error();
  printLoc(source, loc.span, color);
  console.error();

  console.error(color.bold(`${type}:`), chalk.whiteBright(message));
  for (const note of notes) {
    console.error(chalk.bold.blue("note:"), chalk.whiteBright(note));
  }

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

  console.error();
}

export function reportError(message: string, loc: Location, notes: string[] = []): never {
  report(chalk.red, "error", message, loc, notes);
  process.exit(1);
}

export function reportWarning(message: string, loc: Location, notes: string[] = []) {
  report(chalk.yellow, "warn", message, loc, notes);
}