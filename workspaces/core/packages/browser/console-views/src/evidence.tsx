import { Row, Stack, Subheading } from '@mechane-ai/elements';
import { MediaViewerPlaceholder } from '@mechane-ai/elements/content';
import { ButtonPlaceholder, SkeletonText } from '@mechane-ai/elements/feedback';
import { PageLayout, Workbench, WorkbenchScroll } from '@mechane-ai/elements/layout';
import type { ReactNode } from 'react';

export function EvidencePagePlaceholder(): ReactNode {
  return (
    <PageLayout
      showNavigation={false}
      title={<SkeletonText width="20ch" />}
      leading={<ButtonPlaceholder width="6ch" />}
    >
      <Workbench>
        <WorkbenchScroll label="Evidence">
          <EvidenceDetailsPlaceholder />
        </WorkbenchScroll>
      </Workbench>
    </PageLayout>
  );
}

export function EvidenceDetailsPlaceholder(): ReactNode {
  return (
    <Stack>
      <Row shouldSpaceBetween>
        <Subheading>
          <SkeletonText width="24ch" />
        </Subheading>
        <ButtonPlaceholder width="8ch" />
      </Row>
      <MediaViewerPlaceholder />
      <SkeletonText lines={4} />
    </Stack>
  );
}
