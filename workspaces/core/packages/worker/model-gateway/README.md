# @mechane/model-gateway

Model offer catalog, alias resolution, gateway credentials, OpenAI/Anthropic provider dispatch, document attachment
encoding, and per-attempt spend accounting.

Confines upstream model transport, provider pricing/usage measurement, and document payload normalization behind a
narrow structural control-store port so `@mechane/runtime` stays focused on session orchestration.
