import { Button, ConfirmButton, Stack } from '@mechane-ai/elements';
import { Field, FormActions, FormStatus, Input } from '@mechane-ai/elements/forms';
import { DetailPage, PageLayout } from '@mechane-ai/elements/layout';
import { AlertDialog } from '@mechane-ai/elements/overlays';
import { useRef, useState } from 'react';
import type { SubmitEvent } from 'react';

type ArchiveRequest = { readonly projectId: string; readonly reason: string };

type ArchiveProps = {
  readonly projectId: string;
  readonly project: string;
  readonly onArchive: (request: ArchiveRequest) => Promise<void>;
};

/**
 * Build a form for a consequential mutation with validation, confirmation, progress, and retry. The application
 * authorizes the mutation and resolves it only after the server acknowledges success.
 */
export function ConsequentialForm(props: ArchiveProps) {
  return <ArchiveProject key={props.projectId} {...props} />;
}

function ArchiveProject({ projectId, project, onArchive }: ArchiveProps) {
  const [reason, setReason] = useState('');
  const [isInvalid, setInvalid] = useState(false);
  const [isOpen, setOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'pending' | 'error' | 'success'>('idle');
  const reasonInput = useRef<HTMLInputElement>(null);
  const reviewButton = useRef<HTMLButtonElement>(null);
  const receipt = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);

  function review(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (reason.trim().length === 0) {
      setInvalid(true);
      reasonInput.current?.focus();

      return;
    }

    setStatus('idle');
    setOpen(true);
  }

  async function archive() {
    if (submitting.current || reason.trim().length === 0) {
      return;
    }

    submitting.current = true;

    setStatus('pending');

    try {
      await onArchive({ projectId, reason: reason.trim() });
      setStatus('success');
      setOpen(false);
    } catch {
      setStatus('error');
    } finally {
      submitting.current = false;
    }
  }

  return (
    <PageLayout title="Archive project" showNavigation={false}>
      <DetailPage>
        {status === 'success' ? (
          <div ref={receipt} tabIndex={-1}>
            <FormStatus status="success" message={`${project} archived.`} />
          </div>
        ) : (
          <form noValidate onSubmit={review}>
            <Stack>
              <Field.Root name="reason" invalid={isInvalid}>
                <Field.Label>Reason for archiving {project}</Field.Label>
                <Input
                  ref={reasonInput}
                  required
                  value={reason}
                  onValueChange={(value) => {
                    setReason(value);

                    if (value.trim().length > 0) {
                      setInvalid(false);
                    }
                  }}
                />
                <Field.Error match={isInvalid}>Enter a reason.</Field.Error>
              </Field.Root>
              <FormActions>
                <Button ref={reviewButton} type="submit">
                  Review archive
                </Button>
              </FormActions>
            </Stack>
          </form>
        )}
        <AlertDialog.Root
          open={isOpen}
          onOpenChange={(open) => {
            if (!open && !submitting.current) {
              setOpen(false);
            }
          }}
        >
          <AlertDialog.Backdrop />
          <AlertDialog.Popup finalFocus={() => receipt.current ?? reviewButton.current}>
            <AlertDialog.Title>Archive {project}?</AlertDialog.Title>
            <AlertDialog.Description>Members will lose write access to this project.</AlertDialog.Description>
            {status === 'pending' && <FormStatus status="pending" message="Archiving project…" />}
            {status === 'error' && <FormStatus status="error" message="Could not archive the project. Try again." />}
            <FormActions>
              <AlertDialog.Close render={<Button disabled={status === 'pending'} />}>Keep project</AlertDialog.Close>
              <ConfirmButton
                tone="danger"
                confirmation={`Archive ${project}?`}
                isPending={status === 'pending'}
                onClick={archive}
              >
                Archive project
              </ConfirmButton>
            </FormActions>
          </AlertDialog.Popup>
        </AlertDialog.Root>
      </DetailPage>
    </PageLayout>
  );
}
