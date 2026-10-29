import type { catalog } from '@mechane/protocol';
import type { PrincipalId } from '@mechane/records';

/** A revision-checked update with the authenticated actor that its saved history records. */
export type DefinitionChange = typeof catalog.updateMech.body.Type & { readonly updaterId: PrincipalId };
