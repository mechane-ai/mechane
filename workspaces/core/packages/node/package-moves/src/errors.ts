import { Schema } from 'effect';

/**
 * The move map asks for what the tree refuses: a step it does not hold, or a destination that already holds a file. Or
 * it moves a declaration its file cannot give up, or an import that cannot cross members.
 */
export class MoveRefused extends Schema.TaggedError<MoveRefused>()('MoveRefused', {
  path: Schema.String,
  reason: Schema.String,
}) {}
