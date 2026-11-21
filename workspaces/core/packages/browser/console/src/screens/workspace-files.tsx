import { Notice } from '@mechane-ai/elements/feedback';
import { PageLayout, ToolbarAction, Workbench, WorkbenchScroll } from '@mechane-ai/elements/layout';
import { problemMessage } from '@mechane/console-data';
import type { ConsoleData, ManagedFile } from '@mechane/console-data';
import { ManagedFileList, ManagedFileListPlaceholder, SessionPagination, UploadFileForm } from '@mechane/console-views';
import { Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useManagedCommand } from '../managed-command.ts';
import { useManagedPaging } from '../managed-paging.ts';
import { useManagedFiles } from '../managed-reads.ts';
import { ResourceView } from '../resource.tsx';
import type { ConsoleLocation } from '../types.ts';

function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = filename;
  link.rel = 'noopener';

  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export function WorkspaceFiles({
  data,
  location,
}: {
  readonly data: ConsoleData;
  readonly location: ConsoleLocation;
}): ReactNode {
  const [isUploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string>();
  const [downloadError, setDownloadError] = useState<string>();
  const [deletingId, setDeletingId] = useState<string>();
  const uploadCommand = useManagedCommand();
  const deleteCommand = useManagedCommand();
  const request = useMemo(() => data.reads.managedFiles(location.page ?? null), [data, location.page]);
  const files = useManagedFiles(data, request);
  const paging = useManagedPaging(location, data.workspace.id);

  function downloadFile(file: Pick<ManagedFile, 'id' | 'filename'>): void {
    if (downloadingId !== undefined) {
      return;
    }

    setDownloadError(undefined);
    setDownloadingId(file.id);

    void data.managed.downloadFile(file.id).then(
      (blob) => {
        triggerBlobDownload(blob, file.filename);
        setDownloadingId(undefined);
      },
      (error: unknown) => {
        setDownloadError(problemMessage(error));
        setDownloadingId(undefined);
      },
    );
  }

  function deleteFile(fileId: string, close: () => void): void {
    setDeletingId(fileId);
    deleteCommand.run(
      'delete-file',
      () => data.managed.deleteFile(fileId),
      () => {
        setDeletingId(undefined);
        close();
      },
    );
  }

  return (
    <PageLayout
      title={isUploading ? 'Upload file' : 'Files'}
      actions={
        !isUploading && (
          <ToolbarAction icon={<Upload size={16} aria-hidden />} onClick={() => setUploading(true)}>
            Upload file
          </ToolbarAction>
        )
      }
    >
      <Workbench>
        <WorkbenchScroll label="Files" isFlush={!isUploading}>
          {isUploading ? (
            <UploadFileForm
              isPending={uploadCommand.pending !== undefined}
              error={uploadCommand.error}
              onCancel={() => setUploading(false)}
              onUpload={(file) =>
                uploadCommand.run(
                  'upload-file',
                  () => data.managed.uploadFile({ file }),
                  () => setUploading(false),
                )
              }
            />
          ) : (
            <ResourceView state={files} label="Loading files" placeholder={<ManagedFileListPlaceholder />}>
              {(page, notice) => (
                <>
                  {notice}
                  {downloadError !== undefined && <Notice hasError>{downloadError}</Notice>}
                  <ManagedFileList
                    files={page.items}
                    downloadingId={downloadingId}
                    deletingId={deleteCommand.pending === undefined ? undefined : deletingId}
                    deleteError={deleteCommand.error}
                    onDownload={downloadFile}
                    onDelete={deleteFile}
                  />
                  <SessionPagination onPrevious={paging.previous} onNext={paging.next(page.next)} />
                </>
              )}
            </ResourceView>
          )}
        </WorkbenchScroll>
      </Workbench>
    </PageLayout>
  );
}
