/**
 * The parser's node types the owned checks read: a name, an array such as a store's migrations, a call and a literal,
 * such as an `Effect.fn` and its span name. The normalizers read a module's statements and declarations, the
 * expressions that tell a constant's role, and the calls and overload signatures that a blank line sets apart or not.
 */
export const NodeType = {
  Identifier: 'Identifier',
  ArrayExpression: 'ArrayExpression',
  CallExpression: 'CallExpression',
  Literal: 'Literal',
  ImportDeclaration: 'ImportDeclaration',
  ImportSpecifier: 'ImportSpecifier',
  ExportNamedDeclaration: 'ExportNamedDeclaration',
  VariableDeclaration: 'VariableDeclaration',
  ModuleDeclaration: 'TSModuleDeclaration',
  TypeAliasDeclaration: 'TSTypeAliasDeclaration',
  InterfaceDeclaration: 'TSInterfaceDeclaration',
  ClassDeclaration: 'ClassDeclaration',
  QualifiedName: 'TSQualifiedName',
  FunctionDeclaration: 'FunctionDeclaration',
  EnumDeclaration: 'TSEnumDeclaration',
  MemberExpression: 'MemberExpression',
  AsExpression: 'TSAsExpression',
  SatisfiesExpression: 'TSSatisfiesExpression',
  TemplateLiteral: 'TemplateLiteral',
  ObjectExpression: 'ObjectExpression',
  ConstructorCall: 'NewExpression',
  UnaryExpression: 'UnaryExpression',
  ExpressionStatement: 'ExpressionStatement',
  ChainExpression: 'ChainExpression',
  YieldExpression: 'YieldExpression',
  FunctionSignature: 'TSDeclareFunction',
} as const;

export type NodeType = (typeof NodeType)[keyof typeof NodeType];

/** An entry point's file name: a library's one entry when its manifest exports it, and a barrel anywhere else. */
export const ENTRY_FILE = 'index.ts';

/** An executable's file name, whose top level runs `main` and nothing else. */
export const PROGRAM_FILE = 'main.ts';

/** The extension of the TypeScript files the programs read: the checks', the normalizers' and the rename's. */
export const TYPESCRIPT_EXTENSION = '.ts';

/** Whether a statement imports names into its file or re-exports them from it, by the keyword that starts it. */
export const StatementKind = { Import: 'import', Reexport: 'export' } as const;

export type StatementKind = (typeof StatementKind)[keyof typeof StatementKind];
