# @mechane/records

The shapes every stored and wire record is built from, and the rows an object's RPC and its store share.

Layer 0 · shared lane · data dialect · any consumer

## Surface

- Ids and texts: `RecordId`, `RandomId`, the entity id brands, `RecordText`, `RecordName`, `PrintableName` and
  `boundedText`.
- Units: the unit brands `Micros`, `Tokens`, `Bytes` and `Sequence`, and `BYTES_PER_KIBIBYTE` and `BYTES_PER_MEBIBYTE`.
- Spans: `DurationFromSeconds`, a `Duration` a wire writes in whole seconds, and the check `isBetweenDuration`.
- Wire shapes: `wireStruct`, `renamedWireStruct`, `wireKey`, `PAGE_RENAMES`, `listQuery`, `memberOrUnknown` and
  `unknownMember`.
- HTTP words: the closed sets `HttpMethod`, `HttpStatusCode`, `HttpHeader` and `MediaType`, each in its concept
  constants file, such as `http-method.constants.ts`.
- Shared rows, such as `CopyRows`, `DispatchRequest` and `BrowserSessionRow`.

## Use

Declare a wire struct with `wireStruct`, which derives each snake-case key from its field. Pass a key the derivation
cannot produce, such as another system's, through `renamedWireStruct`. Write an HTTP word as its set's member.

## Never

Import another `@mechane` package: records sits at layer 0, beside `deployment` and `utilities`, below every other.
