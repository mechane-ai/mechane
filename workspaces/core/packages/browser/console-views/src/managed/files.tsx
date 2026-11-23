import { Button, IconButton, Row, Stack, Status } from '@mechane-ai/elements';
import { DataTable, DataTablePlaceholder, DataTableText } from '@mechane-ai/elements/collections';
import type { DataTableColumnLayout } from '@mechane-ai/elements/collections';
import { EmptyState, Notice } from '@mechane-ai/elements/feedback';
import { Field, FilePicker } from '@mechane-ai/elements/forms';
import { AlertDialog } from '@mechane-ai/elements/overlays';
import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';
import { ManagedTimestamp } from './timestamp.tsx';

const BYTES_PER_KIBIBYTE = 1024;
const BYTES_PER_MEBIBYTE = BYTES_PER_KIBIBYTE * BYTES_PER_KIBIBYTE;
const FIXED_DECIMALS = 1;
const MAX_UPLOAD_MEBIBYTES = 32;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MEBIBYTES * BYTES_PER_MEBIBYTE;

type WorkspaceFile = {
  readonly id: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
  readonly isDownloadable: boolean;
  readonly scopeId: string | null;
};

const fileColumns = [
  { id: 'file', label: 'File', role: 'primary' },
  { id: 'type', label: 'Type', role: 'text', isSecondary: true },
  { id: 'scope', label: 'Scope', role: 'status', width: 132 },
  { id: 'size', label: 'Size', role: 'number', width: 112 },
  { id: 'created', label: 'Created', role: 'timestamp', width: 216, isSecondary: true },
  { id: 'actions', label: 'Actions', role: 'actions', width: 120 },
] as const satisfies ReadonlyArray<DataTableColumnLayout>;

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes >= BYTES_PER_MEBIBYTE) {
    return `${(sizeBytes / BYTES_PER_MEBIBYTE).toFixed(FIXED_DECIMALS)} MiB`;
  }

  if (sizeBytes >= BYTES_PER_KIBIBYTE) {
    return `${(sizeBytes / BYTES_PER_KIBIBYTE).toFixed(FIXED_DECIMALS)} KiB`;
  }

  return `${sizeBytes} B`;
}

export function ManagedFileListPlaceholder(): ReactNode {
  return <DataTablePlaceholder caption="Files" columns={fileColumns} />;
}

export function UploadFileForm({
  isPending,
  error,
  onCancel,
  onUpload,
}: {
  readonly isPending: boolean;
  readonly error?: string | undefined;
  readonly onCancel: () => void;
  readonly onUpload: (file: File) => void;
}): ReactNode {
  const [selected, setSelected] = useState<File>();

  function submit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (selected !== undefined && !isPending) {
      onUpload(selected);
    }
  }

  return (
    <form onSubmit={submit}>
      <Stack>
        <Field.Root name="file" disabled={isPending}>
          <Field.Label>File</Field.Label>
          <FilePicker required maxSize={MAX_UPLOAD_BYTES} onValueChange={(files) => setSelected(files[0])} />
          <Field.Description>Upload a file up to 32 MiB to mount in sessions.</Field.Description>
        </Field.Root>
        {error !== undefined && <Notice hasError>{error}</Notice>}
        <Row>
          <Button
            type="submit"
            variant="solid"
            disabled={selected === undefined}
            isPending={isPending}
            pendingLabel="Uploading…"
          >
            Upload
          </Button>
          <Button type="button" disabled={isPending} onClick={onCancel}>
            Cancel
          </Button>
        </Row>
      </Stack>
    </form>
  );
}

function DeleteFileControl({
  filename,
  isPending,
  error,
  onDelete,
}: {
  readonly filename: string;
  readonly isPending: boolean;
  readonly error?: string | undefined;
  readonly onDelete: (close: () => void) => void;
}): ReactNode {
  const [isOpen, setOpen] = useState(false);

  return (
    <AlertDialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!isPending) {
          setOpen(open);
        }
      }}
    >
      <AlertDialog.Trigger render={<IconButton variant="ghost" aria-label={`Delete ${filename}`} />}>
        <Trash2 size={16} aria-hidden />
      </AlertDialog.Trigger>
      <AlertDialog.Backdrop />
      <AlertDialog.Popup>
        <AlertDialog.Title>Delete {filename}?</AlertDialog.Title>
        <AlertDialog.Description>
          This file will be permanently removed from this workspace and can no longer be downloaded or mounted.
        </AlertDialog.Description>
        {error !== undefined && <Notice hasError>{error}</Notice>}
        <Row>
          <AlertDialog.Close render={<Button disabled={isPending} />}>Cancel</AlertDialog.Close>
          <Button
            tone="danger"
            data-agent-confirm={`Delete file ${filename}?`}
            variant="solid"
            disabled={isPending}
            isPending={isPending}
            pendingLabel="Deleting…"
            onClick={() => onDelete(() => setOpen(false))}
          >
            Delete file
          </Button>
        </Row>
      </AlertDialog.Popup>
    </AlertDialog.Root>
  );
}

export function ManagedFileList({
  files,
  downloadingId,
  deletingId,
  deleteError,
  onDownload,
  onDelete,
}: {
  readonly files: ReadonlyArray<WorkspaceFile>;
  readonly downloadingId?: string | undefined;
  readonly deletingId?: string | undefined;
  readonly deleteError?: string | undefined;
  readonly onDownload: (file: WorkspaceFile) => void;
  readonly onDelete: (fileId: string, close: () => void) => void;
}): ReactNode {
  return (
    <DataTable
      query={{ mode: 'static', reason: 'Workspace files are cursor-paged by creation time without server search.' }}
      caption="Files"
      hideCaption
      rows={files}
      getRowId={(file) => file.id}
      columns={[
        { ...fileColumns[0], cell: (file) => <DataTableText>{file.filename}</DataTableText> },
        { ...fileColumns[1], cell: (file) => <DataTableText>{file.mimeType}</DataTableText> },
        {
          ...fileColumns[2],
          cell: (file) => <Status>{file.scopeId === null ? 'Workspace' : 'Session output'}</Status>,
        },
        { ...fileColumns[3], cell: (file) => formatFileSize(file.sizeBytes) },
        { ...fileColumns[4], cell: (file) => <ManagedTimestamp value={file.createdAt} /> },
        {
          ...fileColumns[5],
          cell: (file) => (
            <Row>
              <IconButton
                variant="ghost"
                aria-label={`Download ${file.filename}`}
                disabled={!file.isDownloadable || deletingId === file.id}
                isPending={downloadingId === file.id}
                onClick={() => onDownload(file)}
              >
                <Download size={16} aria-hidden />
              </IconButton>
              <DeleteFileControl
                filename={file.filename}
                isPending={deletingId === file.id}
                error={deletingId === file.id ? deleteError : undefined}
                onDelete={(close) => onDelete(file.id, close)}
              />
            </Row>
          ),
        },
      ]}
      empty={
        <EmptyState title="No files in this workspace">Upload a file or run a session that writes outputs.</EmptyState>
      }
    />
  );
}
