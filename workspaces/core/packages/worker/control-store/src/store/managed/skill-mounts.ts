import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import type { StoreContext } from '../context.ts';
import { StoredText } from '../row-values.ts';
import { isManagedDocument, managedDocument, ManagedStoreError } from './managed-record.ts';
import type { ManagedDocument } from './types.ts';

const SESSION_MAX_SKILLS = 500;
const Documents = Schema.Array(Schema.Record(StoredText, Schema.Unknown));
const Skill = Schema.Struct({ type: Schema.Literal('custom'), skill_id: StoredText, version: StoredText });
const parseSkills = Schema.decodeUnknownSync(Schema.Array(Skill));

function childAgents(agent: ManagedDocument): ReadonlyArray<ManagedDocument> {
  const coordinator = agent['multiagent'];

  if (isManagedDocument(coordinator) && coordinator['type'] === 'coordinator') {
    return Schema.decodeUnknownSync(Documents)(coordinator['agents']);
  }

  return [];
}

function mountReferences(agent: ManagedDocument): ReadonlyArray<typeof Skill.Type> {
  const roster = [agent, ...childAgents(agent)];
  const skills = roster.flatMap((member) => parseSkills(member['skills']));
  const versions = new Map(skills.map((skill) => [skill.version, skill]));

  return [...versions.values()];
}

export function workerSessionSkills(session: ManagedDocument): ManagedDocument {
  const agent = managedDocument(session['agent'], 'session agent');

  return { ...session, agent: { ...agent, skills: mountReferences(agent) } };
}

type CatalogEntry = { readonly version: string; readonly name: string; readonly description: string };
type MountedSkills = { readonly context: StoreContext; readonly workspaceId: string; readonly agent: ManagedDocument };

function describeMember(agent: ManagedDocument, catalog: ReadonlyMap<string, CatalogEntry>): string {
  const guides = parseSkills(agent['skills']).map(({ version }) => {
    const entry = catalog.get(version);

    if (entry === undefined) {
      throw new ManagedStoreError(HttpStatusCode.Conflict, 'Pinned skill content is unavailable');
    }

    return { name: entry.name, description: entry.description, path: `skills/${entry.name}/SKILL.md` };
  });

  if (guides.length === 0) {
    return '';
  }

  return [
    'The following skills are available. When a skill applies, read its SKILL.md in the working directory.',
    JSON.stringify(guides),
  ].join('\n');
}

export async function describeSkillMounts({ context, workspaceId, agent }: MountedSkills) {
  const skills = mountReferences(agent);
  const children: Record<string, string> = {};

  if (skills.length === 0) {
    return { primary: '', children };
  }

  if (skills.length > SESSION_MAX_SKILLS) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'A session supports at most 500 distinct skills');
  }

  const mounts = await context.client.query<CatalogEntry>(
    `SELECT s.name,v.description,v.id AS version FROM mechane.managed_skill_versions v
       JOIN mechane.managed_skills s ON s.id=v.skill_id
      WHERE s.workspace_id=$1 AND v.id=ANY($2::text[])`,
    [workspaceId, skills.map((skill) => skill.version)],
  );

  const names = new Set(mounts.rows.map(({ name }) => name));

  if (names.size !== mounts.rows.length) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Distinct skill versions cannot share a sandbox mount name');
  }

  const catalog = new Map(mounts.rows.map((entry) => [entry.version, entry]));

  for (const member of childAgents(agent)) {
    const id = Schema.decodeUnknownSync(StoredText)(member['id']);

    children[id] = describeMember(member, catalog);
  }

  return { primary: describeMember(agent, catalog), children };
}
