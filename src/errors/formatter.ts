import { Context, File, Location, formatLoc, frameToString } from "../shared";
import { Err, ErrorFile, ErrorSpan } from ".";
import chalk, { ChalkInstance } from "chalk";
import plib from "path";

function errColor(kind: Err) {
  if (kind == Err.Error) {
    return chalk.red.bold;
  } else if (kind == Err.Note) {
    return chalk.blue.bold;
  } else {
    return chalk.dim.bold;
  }
}

function errArrow(kind: Err, size: number) {
  if (kind == Err.Error) {
    return "^" + "=".repeat(size - 1);
  } else {
    return "^" + "-".repeat(size - 1);
  }
}

export class StckError {
  private readonly files: Map<File, ErrorFile> = new Map();
  private _lastFile?: ErrorFile;

  constructor(
    public readonly message: string,
  ) {}

  private getLastLoc() {
    return {
      line: this._lastFile!.lines.length,
      col: this._lastFile!.lines.at(-1)!.length - 1
    }
  }

  public add(kind: Err, loc: Location, text?: string) {
    if (!this.files.has(loc.file)) {
      const file: ErrorFile = {
        lines: loc.file.source.split("\n"),
        hints: [], spans: [],
        loc,
      };

      this.files.set(loc.file, file);
      this._lastFile = file;
    }

    const startLc = loc.file.lineColumn(loc.span[0]) ?? this.getLastLoc();
    const endLc = loc.file.lineColumn(loc.span[1]) ?? this.getLastLoc();

    this._lastFile!.spans.push({
      kind, loc, text,
      start: { line: startLc.line - 1, col: startLc.col - 1 },
      end:   { line: endLc.line - 1, col: endLc.col - 2 },
    });

    return this;
  }

  public addHint(note: string) {
    this._lastFile!.hints.push(note);
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

  private formatFile(out: string[], file: ErrorFile, color: ChalkInstance = chalk.blue.bold) {
    const maxLn = Math.max(...file.spans.map((x) => x.end.line)) + 1;
    const padding = maxLn.toString().length;

    const emptyLineNo = ` ${" ".repeat(padding)} ${color("|")}`;

    const lines: [string, ErrorSpan[]][] = Object.entries(
      file.spans.reduce((p: any, c) => {
        p[c.start.line] ??= [];
        p[c.start.line].push(c);
        return p;
      }, {})
    ).sort(
      (a, b) => Number(a[0]) - Number(b[0])
    ) as any;

    const path = plib.relative(process.cwd(), formatLoc(file.loc));
    out.push(`${" ".repeat(padding)} ${color("-->")} ${chalk.gray(path)}`);
    out.push(emptyLineNo);

    for (const line of lines){
      const lineno = parseInt(line[0]);
      const src = file.lines[lineno];
      const spans = line[1].sort((a, b) => a.start.col - b.start.col);

      const num = (lineno + 1).toString().padStart(padding, " ");
      out.push(` ${color(num)} ${color("|")} ${src}`);

      const lines: string[] = [];
      const arrows: string[] = [];

      let lastSpanEnd = 0;
      for (const span of spans) {
        if (span.end.col < span.start.col || span.end.line != span.start.line) {
          span.end.col = src.length - 1;
          span.end.line = lineno;
        }

        const clr = errColor(span.kind);
        const size = Math.max(span.end.col - span.start.col, 0);
        const padding = " ".repeat(Math.max(span.start.col - lastSpanEnd, 0));

        lines.push(padding + clr(errArrow(span.kind, size)));

        if (span.text) {
          arrows.push(padding + clr("|") + " ".repeat(size - 1));
        } else {
          arrows.push(padding + " ".repeat(size));
        }

        lastSpanEnd = span.end.col;
      }

      spans.reverse();

      const span = spans.shift()!;
      if (span.text) {
        arrows.pop();

        if (span.end.col + span.text.length < 65) {
          lines.push(lines.pop()! + " " + errColor(span.kind)(span.text));
          out.push(`${emptyLineNo} ${lines.join("")}`);
        } else {
          out.push(`${emptyLineNo} ${lines.join("")}`);
          out.push(`${emptyLineNo} ${arrows.join("")} ${errColor(span.kind)(span.text)}`);
        }
      } else {
        out.push(`${emptyLineNo} ${lines.join("")}`);
      }

      for (const span of spans) {
        if (span.text) {
          out.push(`${emptyLineNo} ${arrows.join("")}`);

          const padding = arrows.pop()!.split("|")[0];
          const color = errColor(span.kind);

          out.push(`${emptyLineNo} ${arrows.join("")}${padding}${color(span.text)}`);
        } else {
          arrows.pop();
        }
      }
    }

    out.push(emptyLineNo);

    for (const hint of file.hints) {
      out.push(` ${" ".repeat(padding)} ${color("=")} ${chalk.bold("hint:")} ${hint}`);
    }

  }

  public format(): string {
    const out: string[] = [];

    out.push(`${chalk.red.bold("error:")} ${this.message}`);

    for (const file of this.files.values()) {
      this.formatFile(out, file);
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
