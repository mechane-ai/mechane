import type { LiveTokenizer, ThemedToken } from '@pierre/highlights';
import { useEffect, useRef, useState } from 'react';
import { highlightTheme } from '../pierre-theme.ts';

type HighlightResult = {
  readonly code: string;
  readonly language: string;
  readonly lines: ReadonlyArray<ReadonlyArray<ThemedToken>>;
  readonly hasFailed: boolean;
};

type TokenizerSession = { readonly tokenizer: LiveTokenizer; readonly language: string; readonly source: string };
const HIGHLIGHT_MAX_CHARACTERS = 200_000;
const HIGHLIGHT_LINE_MAX_CHARACTERS = 4096;

export function useHighlightedCode(code: string, language: string): HighlightResult | undefined {
  const session = useRef<TokenizerSession | null>(null);
  const [result, setResult] = useState<HighlightResult>();

  useEffect(
    () => () => {
      if (session.current !== null) {
        session.current.tokenizer.dispose();

        session.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    let isCurrent = true;

    async function highlight(): Promise<void> {
      try {
        const highlights = await import('@pierre/highlights');

        if (!isCurrent || code.length > HIGHLIGHT_MAX_CHARACTERS || !highlights.isSupportedLanguage(language)) {
          return;
        }

        const previous = session.current;
        const isSameLanguage = previous !== null && previous.language === language;

        const active = isSameLanguage
          ? previous
          : {
              language,
              source: code,
              tokenizer: new highlights.LiveTokenizer({
                code,
                lang: language,
                theme: highlightTheme,
                tokenizeMaxLineLength: HIGHLIGHT_LINE_MAX_CHARACTERS,
              }),
            };

        if (isSameLanguage) {
          if (code.startsWith(previous.source)) {
            const line = active.tokenizer.lineCount - 1;
            const position = { line, character: active.tokenizer.getLineLength(line) };

            active.tokenizer.applyEdits([
              { range: { start: position, end: position }, newText: code.slice(previous.source.length) },
            ]);
          } else {
            active.tokenizer.reset(code);
          }
        } else if (previous !== null) {
          previous.tokenizer.dispose();
        }

        session.current = { ...active, source: code };
        const tokenizer = active.tokenizer;

        tokenizer.flush();

        const lines = Array.from({ length: tokenizer.lineCount }, (_, line) => tokenizer.getLineTokens(line).tokens);

        setResult({ code, language, lines, hasFailed: false });
      } catch {
        if (isCurrent) {
          setResult({ code, language, lines: [], hasFailed: true });
        }
      }
    }

    void highlight();

    return () => {
      isCurrent = false;
    };
  }, [code, language]);

  return result !== undefined && result.code === code && result.language === language ? result : undefined;
}
