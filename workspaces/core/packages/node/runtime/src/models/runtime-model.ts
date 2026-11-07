import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamResult,
} from '@ai-sdk/provider';
import { WORKFLOW_DESERIALIZE, WORKFLOW_SERIALIZE } from '@workflow/serde';
import { modelReferenceSchema } from './model-reference.ts';
import type { ModelReference } from './model-reference.ts';

export class RuntimeModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4';
  readonly provider = 'openrouter';
  readonly supportedUrls: LanguageModelV4['supportedUrls'] = {};
  readonly modelId: string;
  readonly #reference: ModelReference;

  constructor(reference: ModelReference) {
    this.#reference = modelReferenceSchema.parse(reference);
    this.modelId = reference.modelId;
  }

  static [WORKFLOW_SERIALIZE](model: RuntimeModel): ModelReference {
    return model.#reference;
  }

  static [WORKFLOW_DESERIALIZE](value: unknown): RuntimeModel {
    const reference = modelReferenceSchema.parse(value);

    return new RuntimeModel(reference);
  }

  async doStream(options: LanguageModelV4CallOptions): Promise<LanguageModelV4StreamResult> {
    const { executeModelStream } = await import('./model-request.ts');

    return await executeModelStream({ reference: this.#reference, options });
  }

  async doGenerate(options: LanguageModelV4CallOptions): Promise<LanguageModelV4GenerateResult> {
    const { executeModelGenerate } = await import('./model-request.ts');

    return await executeModelGenerate({ reference: this.#reference, options });
  }
}
