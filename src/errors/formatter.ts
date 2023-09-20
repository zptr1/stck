import { Context, Location, formatLoc, frameToString } from "../shared";
import { Err, ErrorSpan } from ".";
import chalk from "chalk";
import plib from "path";

export class StckError {
  private readonly spans: ErrorSpan[] = [];
  private readonly hints: string[] = [];

  private loc?: Location;
  private lines: string[] = [];

  constructor(
    public readonly message: string,
  ) {}

  private getLastLoc() {
    return {
      line: this.lines.length,
      col: this.lines.at(-1)!.length - 1
    }
  }

  public add(kind: Err, loc: Location, text?: string) {
    if (!this.loc) {
      this.loc = loc;
      this.lines = this.loc.file.source.split("\n");
    } else if (loc.file != this.loc.file) {
      // TODO: Show multiple files
      return this;
    }

    const startLc = loc.file.lineColumn(loc.span[0]) ?? this.getLastLoc();
    const endLc = loc.file.lineColumn(loc.span[1]) ?? this.getLastLoc();

    this.spans.push({
      kind, loc, text,
      start: { line: startLc.line - 1, col: startLc.col },
      end:   { line: endLc.line - 1, col: endLc.col - 1 },
    });

    return this;
  }

  public addHint(note: string) {
    this.hints.push(note);
    return this;
  }

  public addStackElements(
    ctx: Context,
    fmt: (element: string, index: number) => string,
    offset = 0
  ) {
    for (let i = offset; i < ctx.stack.length; i++) {
      this.add(Err.Note, ctx.stackLocations[i], fmt(frameToString(ctx.stack[i]), i - offset));
    }

    return this;
  }

  public format(): string {
    const out: string[] = [];
    const color = chalk.blue.bold;

    const maxLn = Math.max(...this.spans.map((x) => x.end.line)) + 1;
    const padding = maxLn.toString().length;

    const lines: [string, ErrorSpan[]][] = Object.entries(
      this.spans.reduce((p: any, c) => {
        p[c.start.line] ??= [];
        p[c.start.line].push(c);
        return p;
      }, {})
    ).sort(
      (a, b) => (a as any)[0] - (b as any)[0]
    ) as any;

    out.push(`${chalk.red.bold("error:")} ${this.message}`);
    out.push(`${" ".repeat(padding)} ${color("-->")} ${chalk.gray(plib.relative(process.cwd(), formatLoc(this.loc!)))}`);
    const emptyLineNo = ` ${" ".repeat(padding)} ${color("|")}`;
    out.push(emptyLineNo);

    for (const line of lines) {
      const lineno = parseInt(line[0]);
      const spans = line[1].sort((a, b) => b.start.col - a.end.col);
      const ln = this.lines[lineno];

      out.push(` ${color((lineno + 1).toString().padStart(padding, " "))} ${color("|")} ${ln}`);

      for (const span of spans) {
        if (span.end.line != span.start.line || span.end.col > ln.length) {
          // TODO: Multi-line spans
          span.end.col = ln.length;
        }

        const clr = (
          span.kind == Err.Error
            ? chalk.red.bold
          : span.kind == Err.Trace
            ? chalk.dim.bold
          : color
        );

        const padding = " ".repeat(span.start.col - 1);
        const size = Math.max(span.end.col - span.start.col, 0);

        const newline = !span.text || span.start.col + span.text.length + size > 50;
        const arrow = (
          span.kind == Err.Error
            ? newline ? "^".repeat(size + 1) : "^" + "=".repeat(size)
            : newline ? "-".repeat(size + 1) : "^" + "-".repeat(size)
        );

        if (newline) {
          out.push(`${emptyLineNo} ${padding}${clr(arrow)}`);
          if (span.text) {
            out.push(`${emptyLineNo} ${padding}${clr(span.text)}`)
          }
        } else {
          out.push(`${emptyLineNo} ${padding}${clr(arrow)} ${clr(span.text)}`);
        }
      }
    }

    out.push(emptyLineNo);

    for (const hint of this.hints) {
      out.push(` ${" ".repeat(padding)} ${color("=")} ${chalk.bold("hint:")} ${hint}`);
    }

    return out.join("\n");
  }

  public throw(): never {
    console.error();
    console.error(this.format());
    console.error();
    process.exit(1);
  }
}
