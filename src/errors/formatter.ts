import { Err, ErrSpanKind, ErrorFile, ErrorSpan, errSpanArrow, errSpanColor, errToStr } from ".";
import { Context, File, Location, formatLoc, frameToString } from "../shared";
import chalk, { ChalkInstance } from "chalk";
import plib from "path";

export class StckError {
  private readonly files: Map<File, ErrorFile> = new Map();
  private _lastFile?: ErrorFile;

  constructor(
    public readonly type: Err,
  ) {}

  private getLastLoc() {
    return {
      line: this._lastFile!.lines.length,
      col: this._lastFile!.lines.at(-1)!.length - 1
    }
  }

  private add(kind: ErrSpanKind, loc: Location, text?: string) {
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

    const existing = this._lastFile!.spans.find(
      (x) => x.start.line == startLc.line - 1
        && x.start.col >= startLc.col - 1
        && x.end.col <= endLc.col - 2
    );

    if (existing) {
      // TODO: Temporary fix
      existing.text ??= "";
      existing.text += `\n${errSpanColor(kind)(text)}`;
    } else {
      this._lastFile!.spans.push({
        kind, loc, text,
        start: { line: startLc.line - 1, col: startLc.col - 1 },
        end:   { line: endLc.line - 1, col: endLc.col - 2 },
      });
    }

    return this;
  }

  public addErr(loc: Location, text?: string) {
    return this.add(ErrSpanKind.Error, loc, text);
  }

  public addWarn(loc: Location, text?: string) {
    return this.add(ErrSpanKind.Warn, loc, text);
  }

  public addNote(loc: Location, text?: string) {
    return this.add(ErrSpanKind.Note, loc, text);
  }

  public addTrace(loc: Location, text?: string) {
    return this.add(ErrSpanKind.Trace, loc, text);
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
      this.add(ErrSpanKind.Note, ctx.stackLocations[i], fmt(frameToString(ctx.stack[i]), i - offset));
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
          span.end.col = src.length;
          span.end.line = lineno;
        }

        const clr = errSpanColor(span.kind);
        const size = Math.max(span.end.col - span.start.col, 0);
        const padding = " ".repeat(Math.max(span.start.col - lastSpanEnd, 0));

        lines.push(padding + clr(errSpanArrow(span.kind, size)));

        if (span.text) {
          arrows.push(padding + clr("|") + " ".repeat(Math.max(size - 1, 0)));
        } else {
          arrows.push(padding + " ".repeat(size));
        }

        lastSpanEnd = span.end.col;
      }

      spans.reverse();

      const span = spans.shift()!;
      if (span.text && !span.text.includes("\n")) {
        if (span.end.col + span.text.length < 65) {
          lines.push(lines.pop()! + " " + errSpanColor(span.kind)(span.text));
          out.push(`${emptyLineNo} ${lines.join("")}`);
          arrows.pop();
        } else {
          const pad = arrows.pop()!.split("|")[0];
          out.push(`${emptyLineNo} ${lines.join("")}`);
          out.push(`${emptyLineNo} ${arrows.join("")}${pad}${errSpanColor(span.kind)(span.text)}`);
        }
      } else {
        spans.push(span);
        out.push(`${emptyLineNo} ${lines.join("")}`);
      }

      for (const span of spans) {
        if (span.text) {
          out.push(`${emptyLineNo} ${arrows.join("")}`);

          const padding = arrows.pop()!.split("|")[0];
          const color = errSpanColor(span.kind);
          const s = `${emptyLineNo} ${arrows.join("")}${padding}`;

          for (const ln of span.text.split("\n")) {
            out.push(`${s}${color(ln)}`);
          }
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

    out.push(`${chalk.red.bold(`error:`)} ${errToStr(this.type)}`);

    for (const file of this.files.values()) {
      this.formatFile(out, file);
    }

    return out.join("\n");
  }
}
