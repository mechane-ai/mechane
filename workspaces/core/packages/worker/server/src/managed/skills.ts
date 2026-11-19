import { ManagedStoreError } from '@mechane/control-store';
import { HttpHeader, HttpStatusCode, MediaType } from '@mechane/records';
import { managedPageQuery } from './page-query.ts';
import type { ManagedRequest } from './types.ts';

const MULTIPART_MAX_BYTES = 32_505_856;

const FILE_FIELDS: ReadonlySet<string> = new Set(['files', 'files[]']);

type Upload = {
  readonly files: ReadonlyArray<{ readonly path: string; readonly bytes: Uint8Array }>;
  readonly displayName?: string;
};

async function skillUpload(request: Request, allowDisplayName: boolean): Promise<Upload> {
  const contentType = request.headers.get(HttpHeader.ContentType);

  if (
    contentType === null ||
    !contentType.toLowerCase().startsWith(`${MediaType.MultipartFormData};`) ||
    request.body === null
  ) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Upload skill files as multipart/form-data');
  }

  const progress = { bytes: 0 };

  const bounded = request.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        progress.bytes += chunk.byteLength;

        if (progress.bytes > MULTIPART_MAX_BYTES) {
          throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Skill upload exceeds the allowed size');
        }

        controller.enqueue(chunk);
      },
    }),
  );

  const payload = new Response(bounded, { headers: { [HttpHeader.ContentType]: contentType } });

  const form = await payload.formData().catch(() => {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Malformed or oversized multipart skill upload');
  });

  const files: Array<Upload['files'][number]> = [];
  const labels: Array<string> = [];

  for (const [key, value] of form.entries()) {
    const expectsDisplayName = allowDisplayName && labels.length === 0;

    if (key === 'display_name' && expectsDisplayName && typeof value === 'string') {
      labels.push(value);
    } else if (FILE_FIELDS.has(key) && typeof value !== 'string') {
      const bytes = new Uint8Array(await value.arrayBuffer());

      files.push({ path: value.name, bytes });
    } else {
      throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Unexpected multipart field in skill upload');
    }
  }

  const displayName = labels[0];

  if (displayName !== undefined) {
    return { files, displayName };
  }

  return { files };
}

function pathParam(params: Readonly<Record<string, string>>, key: string): string {
  const value = params[key];

  if (value === undefined || value.length === 0) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, `Missing skill path parameter ${key}`);
  }

  return value;
}

function zipResponse(archive: Uint8Array, name: string): Response {
  return new Response(new Uint8Array(archive), {
    headers: {
      [HttpHeader.ContentType]: MediaType.Zip,
      [HttpHeader.ContentDisposition]: `attachment; filename="${name}.zip"`,
    },
  });
}

export async function handleSkills({
  operation,
  params,
  query,
  request,
  scope,
  store,
  workerSession,
}: ManagedRequest): Promise<unknown> {
  const skills = store.managed.skills;

  if (workerSession !== undefined) {
    const skillId = pathParam(params, 'skill_id');
    const version = pathParam(params, 'version');

    const includeArchive =
      operation === 'beta_download_skill_version_content_v1_skills__skill_id__versions__version__content_get';

    if (!includeArchive && operation !== 'beta_get_skill_version_v1_skills__skill_id__versions__version__get') {
      throw new ManagedStoreError(HttpStatusCode.Forbidden, 'Worker access is limited to its session skill version');
    }

    const { record, archive } = await skills.sessionVersion({ ...workerSession, skillId, version, includeArchive });

    if (archive !== null) {
      return zipResponse(archive, record.name);
    }

    return record;
  }

  const paging = managedPageQuery(query);

  function target() {
    return { scope, skillId: pathParam(params, 'skill_id') };
  }

  function versionTarget() {
    return { ...target(), version: pathParam(params, 'version') };
  }

  switch (operation) {
    case 'beta_create_skill_v1_skills_post':
    case 'create_skill_v1_skills_post': {
      const uploaded = await skillUpload(request, true);

      return await skills.create({ scope, ...uploaded });
    }
    case 'beta_list_skills_v1_skills_get':
    case 'list_skills_v1_skills_get':
      if (typeof query['source'] === 'string') {
        return await skills.list({ scope, ...paging, source: query['source'] });
      }

      return await skills.list({ scope, ...paging });
    case 'beta_get_skill_v1_skills__skill_id__get':
    case 'get_skill_v1_skills__skill_id__get':
      return await skills.get(target());
    case 'beta_delete_skill_v1_skills__skill_id__delete':
    case 'delete_skill_v1_skills__skill_id__delete':
      return await skills.delete(target());
    case 'beta_create_skill_version_v1_skills__skill_id__versions_post':
    case 'create_skill_version_v1_skills__skill_id__versions_post': {
      const uploaded = await skillUpload(request, false);

      return await skills.createVersion({ ...target(), files: uploaded.files });
    }
    case 'beta_list_skill_versions_v1_skills__skill_id__versions_get':
    case 'list_skill_versions_v1_skills__skill_id__versions_get':
      return await skills.listVersions({ ...target(), ...paging });
    case 'beta_get_skill_version_v1_skills__skill_id__versions__version__get':
    case 'get_skill_version_v1_skills__skill_id__versions__version__get':
      return await skills.getVersion(versionTarget());
    case 'beta_delete_skill_version_v1_skills__skill_id__versions__version__delete':
    case 'delete_skill_version_v1_skills__skill_id__versions__version__delete':
      return await skills.deleteVersion(versionTarget());
    case 'beta_download_skill_version_content_v1_skills__skill_id__versions__version__content_get': {
      const { archive, name } = await skills.content(versionTarget());

      return zipResponse(archive, name);
    }
    default:
      throw new ManagedStoreError(HttpStatusCode.NotFound, 'Unknown skills operation');
  }
}
