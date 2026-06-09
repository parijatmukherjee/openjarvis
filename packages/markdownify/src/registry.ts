import type { Converter, ConvertInput, MarkdownResult } from "./types.js";
import { extOf, sniff } from "./detect.js";
import { asString } from "./converters/text.js";

/**
 * Picks a converter by mime → extension → content sniff (falling back to the
 * supplied fallback converter) and runs it. `convert` NEVER throws: a converter that
 * fails degrades to the fallback plus a warning, so a bad document can't fail a turn.
 */
export class ConverterRegistry {
  private readonly converters: Converter[] = [];

  constructor(private readonly fallback: Converter) {}

  register(c: Converter): this {
    this.converters.push(c);
    return this;
  }

  /** Resolve a converter for the given hints + raw data. */
  pick(input: ConvertInput): Converter {
    const ext = extOf(input.filename);
    const byHint = this.converters.find((c) =>
      c.accepts({
        ...(input.mime !== undefined ? { mime: input.mime } : {}),
        ...(ext !== undefined ? { ext } : {}),
      }),
    );
    if (byHint) {
      return byHint;
    }
    const sniffed = sniff(asString(input.data));
    if (sniffed !== undefined) {
      const bySniff = this.converters.find((c) => c.format === sniffed);
      if (bySniff) {
        return bySniff;
      }
    }
    return this.fallback;
  }

  async convert(input: ConvertInput): Promise<MarkdownResult> {
    const converter = this.pick(input);
    const warnings: string[] = [];
    try {
      const out = await converter.convert(input.data);
      return {
        markdown: out.markdown,
        format: converter.format,
        warnings,
        ...(out.title !== undefined ? { title: out.title } : {}),
      };
    } catch (err) {
      warnings.push(
        `converter "${converter.format}" failed: ${err instanceof Error ? err.message : String(err)}; treated as text`,
      );
      const fb = await this.fallback.convert(input.data);
      return { markdown: fb.markdown, format: this.fallback.format, warnings };
    }
  }
}
