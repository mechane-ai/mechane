import * as stylex from '@stylexjs/stylex';
import {
  FileInput,
  FileInputDropzone,
  FileInputItem,
  FileInputItemRemove,
  FileInputList,
  FileInputTrigger,
} from '@ui-sdk/react/file-input';
import { File as FileIcon, X } from 'lucide-react';
import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { IconButton } from '../../core/src/index.ts';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import type { ControlDensity } from '../../foundations/src/control-density.ts';
import {
  controlDensityStyles,
  controlStyles,
  singleLineControlDensityStyles,
} from '../../foundations/src/control-styles.ts';
import type { PlacementStyle } from '../../foundations/src/style-composition.ts';
import { colors, controls, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  root: { display: 'flex', flexDirection: 'column', gap: spacing.sm, minWidth: 0 },
  dropzone: {
    'display': 'flex',
    'alignItems': 'stretch',
    'paddingBlock': 0,
    'paddingInline': 0,
    'overflow': 'hidden',
    ':is([data-dragging])': { borderStyle: 'dashed', borderColor: colors.focus },
    ':is([data-drag-reject])': { borderColor: colors.danger },
    ':focus-within': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 1,
    },
  },
  trigger: {
    flexShrink: 0,
    paddingBlock: 0,
    borderWidth: 0,
    borderInlineEndWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    backgroundColor: {
      'default': colors.canvas,
      ':hover:not(:disabled)': { [conditions.hoverPointer]: colors.line },
      ':active:not(:disabled)': colors.line,
    },
    color: { 'default': colors.ink, ':disabled': colors.muted },
    fontFamily: typography.fontFamily,
    fontWeight: typography.regularWeight,
    fontSize: { default: typography.bodySize, [conditions.coarsePointer]: typography.touchInputSize },
    cursor: { 'default': 'pointer', ':disabled': 'not-allowed' },
    outlineStyle: 'none',
  },
  hint: {
    alignSelf: 'center',
    minWidth: 0,
    paddingInline: spacing.sm,
    color: colors.muted,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  list: {
    'display': 'flex',
    'flexDirection': 'column',
    'gap': spacing.xs,
    'minWidth': 0,
    ':empty': { display: 'none' },
  },
  item: {
    'display': 'flex',
    'alignItems': 'center',
    'gap': spacing.sm,
    'minWidth': 0,
    'paddingInlineStart': spacing.sm,
    'borderWidth': 1,
    'borderStyle': 'solid',
    'borderColor': colors.line,
    'borderRadius': radii.sm,
    'backgroundColor': colors.surface,
    'fontFamily': typography.fontFamily,
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    'outlineStyle': 'none',
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 1,
    },
  },
  icon: { flexShrink: 0, color: colors.muted },
  name: { flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  size: { flexShrink: 0, color: colors.muted, fontSize: typography.captionSize, fontVariantNumeric: 'tabular-nums' },
  rejected: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    color: colors.danger,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    overflowWrap: 'anywhere',
  },
});

const triggerDensityStyles = stylex.create({
  standard: { paddingInline: controls.paddingInline },
  compact: { paddingInline: controls.compactPaddingInline },
});

type SdkFileInputProps = ComponentProps<typeof FileInput>;
type Rejections = Parameters<NonNullable<SdkFileInputProps['onReject']>>[0];

export type FilePickerProps = Omit<SdkFileInputProps, 'children' | 'className' | 'style' | 'render'> & {
  readonly density?: ControlDensity;
  readonly xstyle?: PlacementStyle;
};

const KIBIBYTE = 1024;
const sizeUnits = ['bytes', 'KiB', 'MiB', 'GiB'] as const;

function formatSize(bytes: number): string {
  const unit = Math.min(sizeUnits.length - 1, Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(KIBIBYTE)));
  const amount = bytes / KIBIBYTE ** unit;

  if (unit === 0) {
    return bytes === 1 ? '1 byte' : `${bytes} bytes`;
  }

  return `${amount.toFixed(1)} ${sizeUnits[unit]}`;
}

const reasons: Readonly<Record<string, string>> = {
  'file-type': 'is not an accepted type',
  'file-too-large': 'is too large',
  'file-too-small': 'is too small',
  'too-many-files': 'is more than this field takes',
};

/**
 * Chooses files on the UI SDK file input: a button opens the picker, and the field also takes dropped and pasted files.
 * It lists the chosen files with a remove action and says why a file was refused. It never uploads or reads.
 */
export function FilePicker({
  density = 'standard',
  xstyle,
  multiple = false,
  onValueChange,
  onReject,
  ...props
}: FilePickerProps): ReactNode {
  const [rejected, setRejected] = useState<Rejections>([]);

  return (
    <FileInput
      {...props}
      multiple={multiple}
      onValueChange={(files, details) => {
        setRejected(details.rejected);
        onValueChange?.(files, details);
      }}
      onReject={(files, details) => {
        setRejected(files);
        onReject?.(files, details);
      }}
      {...stylex.props(styles.root, xstyle)}
    >
      <FileInputDropzone
        {...stylex.props(
          controlStyles.base,
          controlStyles.field,
          controlStyles.singleLineField,
          controlDensityStyles[density],
          singleLineControlDensityStyles[density],
          styles.dropzone,
        )}
      >
        <FileInputTrigger {...stylex.props(styles.trigger, triggerDensityStyles[density])}>
          {multiple ? 'Choose files' : 'Choose a file'}
        </FileInputTrigger>
        <span {...stylex.props(styles.hint)}>{multiple ? 'or drop files here' : 'or drop a file here'}</span>
      </FileInputDropzone>
      <FileInputList {...stylex.props(styles.list)}>
        <FileInputItem
          render={(item, { file }) => (
            <div {...item} {...stylex.props(styles.item)}>
              <FileIcon size={16} aria-hidden {...stylex.props(styles.icon)} />
              <span {...stylex.props(styles.name)}>{file.name}</span>{' '}
              <span {...stylex.props(styles.size)}>{formatSize(file.size)}</span>
              <FileInputItemRemove render={<IconButton aria-label={`Remove ${file.name}`} density="compact" />}>
                <X size={14} aria-hidden />
              </FileInputItemRemove>
            </div>
          )}
        />
      </FileInputList>
      {rejected.length > 0 && (
        <ul {...stylex.props(styles.rejected)}>
          {rejected.map(({ file, reasons: why }) => (
            <li key={`${file.name}-${file.size}`}>
              {file.name} {why.map((reason) => reasons[reason] ?? reason).join(' and ')}.
            </li>
          ))}
        </ul>
      )}
    </FileInput>
  );
}
