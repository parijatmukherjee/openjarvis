import type { Embedder } from "./embedder.js";

/** The slice of `@huggingface/transformers` we use (typed locally; the package is an
 *  optional peer dependency and may be absent at build time). */
interface FeatureExtractionPipeline {
  (
    text: string,
    opts: { pooling: "mean"; normalize: boolean },
  ): Promise<{ data: Float32Array | number[] }>;
}
interface TransformersModule {
  pipeline(task: "feature-extraction", model: string): Promise<FeatureExtractionPipeline>;
}

/**
 * A real, self-contained embedder backed by `@huggingface/transformers` (ONNX/WASM),
 * so it works in the shipped Bun binary with no external service and no native
 * extension. The package is an OPTIONAL peer dependency — install it to enable real
 * semantic recall. The pipeline is loaded lazily on first `embed`; a clear error is
 * thrown if the package is not installed.
 */
export class TransformersEmbedder implements Embedder {
  readonly dims: number;
  private readonly model: string;
  private pipe: FeatureExtractionPipeline | undefined;

  constructor(opts: { model?: string; dims?: number } = {}) {
    this.model = opts.model ?? "Xenova/all-MiniLM-L6-v2";
    this.dims = opts.dims ?? 384;
  }

  async embed(text: string): Promise<Float32Array> {
    const pipe = await this.ensurePipeline();
    const out = await pipe(text, { pooling: "mean", normalize: true });
    return out.data instanceof Float32Array ? out.data : Float32Array.from(out.data);
  }

  private async ensurePipeline(): Promise<FeatureExtractionPipeline> {
    if (this.pipe) {
      return this.pipe;
    }
    let mod: TransformersModule;
    try {
      // @ts-expect-error optional peer dependency, may not be installed at build time
      mod = (await import("@huggingface/transformers")) as TransformersModule;
    } catch {
      throw new Error(
        "TransformersEmbedder requires the optional peer dependency '@huggingface/transformers'. Install it to enable semantic recall.",
      );
    }
    this.pipe = await mod.pipeline("feature-extraction", this.model);
    return this.pipe;
  }
}
