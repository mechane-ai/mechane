// Generated from @mechane/rules by `mise run fix`; change the registry, never this file.
// The worker lane's untyped boundaries answer `unknown`, which a schema then decodes (TD-11).
// A declaration file without imports declares globals, whose interfaces merge with the runtime's.
interface JSON {
  parse(text: string, reviver?: (this: unknown, key: string, value: unknown) => unknown): unknown;
}
interface Response {
  json(): Promise<unknown>;
}
interface Request<CfHostMetadata = unknown, Cf = CfProperties<CfHostMetadata>> {
  json(): Promise<unknown>;
}
interface R2ObjectBody {
  json(): Promise<unknown>;
}
