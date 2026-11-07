import { renamedWireStruct } from '@mechane/records';
import { BrowserTab } from '@mechane/sandbox-wire';
import { Schema } from 'effect';

const ForeignFields = Schema.Record(Schema.String, Schema.Unknown);
const ProtocolError = Schema.StructWithRest(Schema.Struct({ message: Schema.String }), [ForeignFields]);
/** Identifies Chromium’s attachment to a target, independently of the target’s tab identity. */
export const DevtoolsSessionId = Schema.NonEmptyString.pipe(Schema.brand('DevtoolsSessionId'));
export type DevtoolsSessionId = typeof DevtoolsSessionId.Type;
const DevtoolsLoaderId = Schema.NonEmptyString.pipe(Schema.brand('DevtoolsLoaderId'));

/** Decodes command replies and unsolicited events while retaining foreign protocol fields. */
export const ProtocolMessage = Schema.StructWithRest(
  Schema.Struct({
    /** Absent on unsolicited events rather than replies to numbered commands. */
    id: Schema.optionalKey(Schema.Int),
    /** Absent when this message carries an error or an event instead of a successful command result. */
    result: Schema.optionalKey(Schema.Unknown),
    /** Absent when Chromium did not explicitly reject the numbered command. */
    error: Schema.optionalKey(ProtocolError),
    /** Absent on command replies rather than unsolicited protocol events. */
    method: Schema.optionalKey(Schema.String),
    /** Absent on replies or events with no parameters. */
    params: Schema.optionalKey(Schema.Unknown),
    /** Absent for browser-level replies and events outside an attached page session. */
    sessionId: Schema.optionalKey(DevtoolsSessionId),
  }),
  [ForeignFields],
);

export type ProtocolMessage = typeof ProtocolMessage.Type;

/** Accepts extension fields on commands whose reply carries no required application value. */
export const EmptyReply = Schema.Record(Schema.String, Schema.Unknown);
export type EmptyReply = typeof EmptyReply.Type;

/** Reads the page identity and display metadata needed to select a live Chromium tab. */
const TargetInfo = Schema.StructWithRest(
  Schema.Struct({ targetId: BrowserTab.fields.tabId, type: Schema.String, title: Schema.String, url: Schema.String }),
  [ForeignFields],
);

/** Carries Chromium’s live target inventory, including non-page targets filtered by the page adapter. */
export const TargetsReply = Schema.StructWithRest(Schema.Struct({ targetInfos: Schema.Array(TargetInfo) }), [
  ForeignFields,
]);

export type TargetsReply = typeof TargetsReply.Type;

/** Carries the target identity acknowledged by a successful create-target command. */
export const CreatedTarget = Schema.StructWithRest(Schema.Struct({ targetId: BrowserTab.fields.tabId }), [
  ForeignFields,
]);

export type CreatedTarget = typeof CreatedTarget.Type;
/** Carries the session used to address commands to one attached page. */
export const AttachedTarget = Schema.StructWithRest(Schema.Struct({ sessionId: DevtoolsSessionId }), [ForeignFields]);
export type AttachedTarget = typeof AttachedTarget.Type;

/** Distinguishes a new document load from same-document navigation and reported navigation failure. */
export const NavigationReply = Schema.StructWithRest(
  Schema.Struct({
    /** Absent when Chromium reports no navigation error. */
    errorText: Schema.optionalKey(Schema.String),
    /** Absent for a same-document navigation that has no new loader. */
    loaderId: Schema.optionalKey(DevtoolsLoaderId),
  }),
  [ForeignFields],
);

export type NavigationReply = typeof NavigationReply.Type;
/** Maps Chromium’s base64 payload to the capture adapter’s explicit encoding name. */
export const ScreenshotReply = renamedWireStruct({ fields: { base64: Schema.String }, renames: { base64: 'data' } });
export type ScreenshotReply = typeof ScreenshotReply.Type;

const AccessibleValue = Schema.StructWithRest(
  Schema.Struct({ value: Schema.optionalKey(Schema.Union([Schema.String, Schema.Number, Schema.Boolean])) }),
  [ForeignFields],
);

const AccessibleNode = Schema.StructWithRest(
  Schema.Struct({
    // Chromium CDP owns this field; the AX-tree adapter reads it as isIgnored.
    // ast-grep-ignore: boolean-names
    ignored: Schema.Boolean,
    role: Schema.optionalKey(AccessibleValue),
    name: Schema.optionalKey(AccessibleValue),
    value: Schema.optionalKey(AccessibleValue),
    backendDOMNodeId: Schema.optionalKey(Schema.Int),
  }),
  [ForeignFields],
);

/** Provides observed backend node identities without accepting selectors invented by an agent. */
export const AccessibilityReply = Schema.StructWithRest(Schema.Struct({ nodes: Schema.Array(AccessibleNode) }), [
  ForeignFields,
]);

export type AccessibilityReply = typeof AccessibilityReply.Type;

/** Provides rendered geometry for a previously observed backend node. */
export const ContentQuadsReply = Schema.StructWithRest(
  Schema.Struct({ quads: Schema.Array(Schema.Array(Schema.Number)) }),
  [ForeignFields],
);

export type ContentQuadsReply = typeof ContentQuadsReply.Type;

/** Captures scroll position and viewport dimensions used to reject stale coordinate targets. */
export const LayoutReply = Schema.StructWithRest(
  Schema.Struct({
    cssVisualViewport: Schema.StructWithRest(
      Schema.Struct({
        clientWidth: Schema.Number,
        clientHeight: Schema.Number,
        pageX: Schema.Number,
        pageY: Schema.Number,
      }),
      [ForeignFields],
    ),
  }),
  [ForeignFields],
);

export type LayoutReply = typeof LayoutReply.Type;

const RemoteValue = Schema.StructWithRest(
  Schema.Struct({ value: Schema.optionalKey(Schema.Unknown), description: Schema.optionalKey(Schema.String) }),
  [ForeignFields],
);

/** Reads browser console arguments without imposing an application schema on their values. */
export const ConsoleEvent = Schema.StructWithRest(
  Schema.Struct({ type: Schema.String, args: Schema.Array(RemoteValue) }),
  [ForeignFields],
);

export type ConsoleEvent = typeof ConsoleEvent.Type;

/** Captures page runtime exception text for the bounded diagnostic tail. */
export const ExceptionEvent = Schema.StructWithRest(
  Schema.Struct({
    exceptionDetails: Schema.StructWithRest(
      Schema.Struct({
        text: Schema.String,
        /** Absent when Chromium supplied only exception text, without a remote exception object. */
        exception: Schema.optionalKey(RemoteValue),
      }),
      [ForeignFields],
    ),
  }),
  [ForeignFields],
);

export type ExceptionEvent = typeof ExceptionEvent.Type;

/** Retains request URL, status, and media type without collecting response bodies or credentials. */
export const NetworkEvent = Schema.StructWithRest(
  Schema.Struct({
    response: Schema.StructWithRest(
      Schema.Struct({ url: Schema.String, status: Schema.Number, mimeType: Schema.String }),
      [ForeignFields],
    ),
  }),
  [ForeignFields],
);

export type NetworkEvent = typeof NetworkEvent.Type;
/** Captures Chromium’s network-failure description without retaining request headers. */
export const NetworkFailureEvent = Schema.StructWithRest(Schema.Struct({ errorText: Schema.String }), [ForeignFields]);
export type NetworkFailureEvent = typeof NetworkFailureEvent.Type;

/** Carries the native recording stream handle owned until its capture is encoded or fails. */
export const RecordingReply = Schema.StructWithRest(Schema.Struct({ stream: Schema.String }), [ForeignFields]);
export type RecordingReply = typeof RecordingReply.Type;

/** Maps Chromium stream chunks and their terminal marker to the bounded recording reader. */
export const StreamReply = renamedWireStruct({
  fields: {
    content: Schema.String,
    isFinished: Schema.Boolean,
    /** Absent for a UTF-8 stream chunk; true means content is base64 instead. */
    isBase64Encoded: Schema.optionalKey(Schema.Boolean),
  },
  renames: { content: 'data', isFinished: 'eof', isBase64Encoded: 'base64Encoded' },
});

export type StreamReply = typeof StreamReply.Type;

/** Reads an OS error code so missing processes can be distinguished from failed cleanup. */
export const BrowserFileError = Schema.StructWithRest(Schema.Struct({ code: Schema.String }), [ForeignFields]);
export type BrowserFileError = typeof BrowserFileError.Type;

/** Encodes viewport coordinates with Chromium’s required axis keys. */
export const DevtoolsCoordinates = renamedWireStruct({
  fields: { positionX: Schema.Number, positionY: Schema.Number },
  renames: { positionX: 'x', positionY: 'y' },
});

export type DevtoolsCoordinates = typeof DevtoolsCoordinates.Type;
