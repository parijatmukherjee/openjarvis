import type { ConvertInput, MarkdownResult } from "./types.js";
import { ConverterRegistry } from "./registry.js";
import { textConverter } from "./converters/text.js";
import { htmlConverter } from "./converters/html.js";
import { csvConverter } from "./converters/csv.js";
import { jsonConverter } from "./converters/json.js";
import { xmlConverter } from "./converters/xml.js";
import type { Logger } from "./logger.js";
import { noopLogger } from "./logger.js";

/** The default registry with all built-in converters; text is the fallback. */
export function defaultRegistry(logger?: Logger): ConverterRegistry {
  return new ConverterRegistry(textConverter, undefined, logger ?? noopLogger)
    .register(htmlConverter)
    .register(csvConverter)
    .register(jsonConverter)
    .register(xmlConverter);
}

/** Convert a document to token-lean Markdown. Never throws. */
export function markdownify(input: ConvertInput, logger?: Logger): Promise<MarkdownResult> {
  return defaultRegistry(logger).convert(input);
}
