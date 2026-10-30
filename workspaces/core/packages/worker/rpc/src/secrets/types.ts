/** A secret binding is read again for each operation so provider rotations take effect without reopening an object. */
export type SecretReader<Value> = () => Promise<Value>;
