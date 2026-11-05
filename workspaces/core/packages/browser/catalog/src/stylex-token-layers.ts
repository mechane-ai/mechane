import type { LayerBlockRule, Visitor } from 'lightningcss';

const TOKEN_LAYER = 'priority1';

/** Separate builds must give token defaults and themes the same cascade priority. */
export function stylexTokenLayers(): Visitor<never> {
  const layers: Array<LayerBlockRule> = [];

  return {
    Rule: (rule) => {
      if (rule.type === 'layer-block') {
        layers.push(rule.value);
      }
    },
    RuleExit: (rule) => {
      if (rule.type === 'layer-block') {
        layers.pop();

        return;
      }

      if (rule.type !== 'style' || layers.length > 0) {
        return;
      }

      const declarations = rule.value.declarations;
      const values = [...declarations.declarations, ...declarations.importantDeclarations];

      const isTokenRule =
        values.length > 0 &&
        values.every((declaration) => declaration.property === 'custom' && declaration.value.name.startsWith('--'));

      if (!isTokenRule) {
        return;
      }

      return { type: 'layer-block', value: { name: [TOKEN_LAYER], rules: [rule], loc: rule.value.loc } };
    },
  };
}
