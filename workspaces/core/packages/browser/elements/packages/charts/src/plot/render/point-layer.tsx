import * as stylex from '@stylexjs/stylex';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { chartToneColors } from '../../../../foundations/src/chart-tones.ts';
import type { ChartTone } from '../../../../foundations/src/chart-tones.ts';
import type { PlotBox } from '../plot-layout.ts';
import type { ContinuousScale } from '../scale.ts';
import { columnExtent } from '../scale.ts';
import type { PointColumns } from './hit-index.ts';
import { resolveColors, unitColor, useDrawRevision } from './theme-colors.ts';
import type { DrawColor } from './theme-colors.ts';

/** How a point layer draws: canvas 2D for up to about a hundred thousand points, WebGL for up to about a million. */
export type PointRenderer = 'canvas' | 'webgl';

/** Where data values land on one axis: its domain and the CSS pixels it spans. A point layer maps both linearly. */
export type PointAxis = Pick<ContinuousScale, 'domain' | 'range'>;

/** What one finished draw reports: the renderer that drew, which is canvas when WebGL is unavailable, and its cost. */
export type PointDraw = {
  readonly renderer: PointRenderer;
  /** Main-thread time spent issuing the draw, in milliseconds. */
  readonly milliseconds: number;
  readonly points: number;
};

export type PointLayerProps = {
  /** The plot the layer covers. Points draw inside its axes only. */
  readonly box: PlotBox;
  /** The points in data units, with each point's group as an index into `tones`. */
  readonly points: PointColumns;
  readonly x: PointAxis;
  readonly y: PointAxis;
  /** One tone per group, at most 16. */
  readonly tones: ReadonlyArray<ChartTone>;
  /** A group drawn in its hue on top, while every other group recedes to gray context. */
  readonly highlight?: number | null | undefined;
  /** The radius of each point, in CSS pixels. */
  readonly radius?: number | undefined;
  /** The opacity of each point, from 0 to 1, so dense regions read darker than sparse ones. */
  readonly opacity?: number | undefined;
  readonly renderer: PointRenderer;
  /** Hears each finished draw, including which renderer drew it, so the chart can say when WebGL was unavailable. */
  readonly onDraw?: ((draw: PointDraw) => void) | undefined;
};

/** How many tones a point layer holds. */
const POINT_TONES_MAX = 16;

const POINT_RADIUS = 2;
const POINT_OPACITY = 0.7;
const CONTEXT_OPACITY = 0.35;
const POINTS_PER_FRAME = 100_000;
const FLOATS_PER_POINT = 3;
const BYTES_PER_FLOAT = 4;
const HALF = 0.5;
const CHANNELS = 4;
const CHANNEL_MAX = 255;
const NO_HIGHLIGHT = -1;
const NO_POINTS: PointColumns = { x: [], y: [], group: [] };

const styles = stylex.create({
  canvas: (width: number, height: number) => ({
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    pointerEvents: 'none',
  }),
});

type PointFrame = {
  readonly box: PlotBox;
  readonly ratio: number;
  readonly x: PointAxis;
  readonly y: PointAxis;
  readonly palette: ReadonlyArray<DrawColor>;
  readonly context: DrawColor;
  readonly highlight: number;
  readonly radius: number;
  readonly opacity: number;
};

type PointEngine = {
  readonly renderer: PointRenderer;
  readonly upload: (points: PointColumns) => void;
  readonly draw: (frame: PointFrame, done: (milliseconds: number) => void) => void;
  readonly destroy: () => void;
};

function sizeCanvas(canvas: HTMLCanvasElement, frame: PointFrame): void {
  const width = Math.round(frame.box.width * frame.ratio);
  const height = Math.round(frame.box.height * frame.ratio);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.setAttribute('width', String(width));
    canvas.setAttribute('height', String(height));
  }
}

function slope(axis: PointAxis): number {
  return (axis.range[1] - axis.range[0]) / (axis.domain[1] - axis.domain[0]);
}

type MaskPixel = { readonly dx: number; readonly dy: number; readonly coverage: number };

/** The pixels a round point covers around its center, with how much of each it covers, so its edge is smooth. */
function pointMask(radius: number): ReadonlyArray<MaskPixel> {
  const reach = Math.ceil(radius + HALF);
  const side = 2 * reach + 1;

  return Array.from({ length: side * side }, (_, cell) => {
    const dx = (cell % side) - reach;
    const dy = Math.floor(cell / side) - reach;

    return { dx, dy, coverage: Math.max(0, Math.min(1, radius + HALF - Math.hypot(dx, dy))) };
  }).filter((pixel) => pixel.coverage > 0);
}

type CanvasPass = { readonly start: number; readonly end: number; readonly isHighlight: boolean };

/** The drawing area in device pixels: where it starts on the canvas and its size. */
type PixelArea = { readonly left: number; readonly top: number; readonly width: number; readonly height: number };

function pixelArea(frame: PointFrame): PixelArea {
  const { box, ratio } = frame;
  const left = Math.round(box.left * ratio);
  const top = Math.round(box.top * ratio);

  return {
    left,
    top,
    width: Math.max(1, Math.round(box.right * ratio) - left),
    height: Math.max(1, Math.round(box.bottom * ratio) - top),
  };
}

/**
 * Canvas 2D without a draw call per point: each point is blended into a buffer of premultiplied color, which is then
 * copied to the canvas once per chunk. It costs the same with or without a GPU.
 */
function canvasEngine(canvas: HTMLCanvasElement): PointEngine {
  const columns: { current: PointColumns } = { current: NO_POINTS };
  const pending: { frame: number; last: PointFrame | undefined } = { frame: 0, last: undefined };
  const buffer: { current: Float32Array } = { current: new Float32Array(0) };

  function blend(frame: PointFrame, area: PixelArea, pass: CanvasPass): void {
    const { ratio, highlight } = frame;
    const mask = pointMask(frame.radius * ratio);
    const kx = slope(frame.x) * ratio;
    const ky = slope(frame.y) * ratio;
    const x0 = frame.x.range[0] * ratio - frame.x.domain[0] * kx - area.left;
    const y0 = frame.y.range[0] * ratio - frame.y.domain[0] * ky - area.top;
    const isReceded = highlight >= 0 && !pass.isHighlight;
    const opacity = isReceded ? frame.opacity * CONTEXT_OPACITY : frame.opacity;
    const points = columns.current;
    const acc = buffer.current;

    for (const [step, x] of points.x.slice(pass.start, pass.end).entries()) {
      const index = pass.start + step;
      const group = points.group[index] ?? 0;
      const isDrawn = highlight < 0 || (group === highlight) === pass.isHighlight;
      const [red, green, blue] = isReceded ? frame.context : (frame.palette[group] ?? frame.context);
      const column = Math.round(x0 + x * kx);
      const row = Math.round(y0 + (points.y[index] ?? 0) * ky);

      for (const pixel of isDrawn ? mask : []) {
        const px = column + pixel.dx;
        const py = row + pixel.dy;

        const isInsideAcross = px >= 0 && px < area.width;
        const isInsideDown = py >= 0 && py < area.height;

        if (isInsideAcross && isInsideDown) {
          const alpha = opacity * pixel.coverage;
          const keep = 1 - alpha;
          const at = (py * area.width + px) * CHANNELS;

          acc[at] = red * alpha + (acc[at] ?? 0) * keep;
          acc[at + 1] = green * alpha + (acc[at + 1] ?? 0) * keep;
          acc[at + 2] = blue * alpha + (acc[at + 2] ?? 0) * keep;
          acc[at + CHANNELS - 1] = alpha + (acc[at + CHANNELS - 1] ?? 0) * keep;
        }
      }
    }
  }

  function present(area: PixelArea): void {
    const context = canvas.getContext('2d');

    if (context === null) {
      return;
    }

    const image = context.createImageData(area.width, area.height);
    const acc = buffer.current;

    for (const [at, alpha] of acc.entries()) {
      if (at % CHANNELS === CHANNELS - 1 && alpha > 0) {
        image.data[at - CHANNELS + 1] = (acc[at - CHANNELS + 1] ?? 0) / alpha;
        image.data[at - CHANNELS + 2] = (acc[at - CHANNELS + 2] ?? 0) / alpha;
        image.data[at - 1] = (acc[at - 1] ?? 0) / alpha;
        image.data[at] = alpha * CHANNEL_MAX;
      }
    }

    context.putImageData(image, area.left, area.top);
  }

  function draw(frame: PointFrame, done: (milliseconds: number) => void): void {
    cancelAnimationFrame(pending.frame);

    pending.last = frame;

    sizeCanvas(canvas, frame);
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);

    const area = pixelArea(frame);
    const count = columns.current.x.length;
    const chunks = Array.from({ length: Math.ceil(count / POINTS_PER_FRAME) }, (_, chunk) => chunk * POINTS_PER_FRAME);

    const passes = [false, ...(frame.highlight >= 0 ? [true] : [])].flatMap((isHighlight) =>
      chunks.map((start) => ({ start, end: Math.min(count, start + POINTS_PER_FRAME), isHighlight })),
    );

    const spent = { milliseconds: 0 };

    if (buffer.current.length === area.width * area.height * CHANNELS) {
      buffer.current.fill(0);
    } else {
      buffer.current = new Float32Array(area.width * area.height * CHANNELS);
    }

    function run(step: number): void {
      const pass = passes[step];

      if (pass === undefined) {
        done(spent.milliseconds);

        return;
      }

      const started = performance.now();

      blend(frame, area, pass);
      present(area);

      spent.milliseconds += performance.now() - started;
      pending.frame = requestAnimationFrame(() => run(step + 1));
    }

    run(0);
  }

  function restore(): void {
    if (pending.last !== undefined) {
      draw(pending.last, () => undefined);
    }
  }

  canvas.addEventListener('contextrestored', restore);

  return {
    renderer: 'canvas',
    upload: (points) => {
      columns.current = points;
    },
    draw,
    destroy: () => {
      cancelAnimationFrame(pending.frame);
      canvas.removeEventListener('contextrestored', restore);
    },
  };
}

const VERTEX_SHADER = `
attribute vec2 position;
attribute float group;
uniform vec2 scale;
uniform vec2 offset;
uniform float size;
uniform float highlight;
uniform float pass;
uniform vec4 palette[${POINT_TONES_MAX}];
uniform vec4 context;
varying vec4 color;
varying float edge;

void main() {
  bool hasHighlight = highlight >= 0.0;
  bool isHighlighted = abs(group - highlight) < 0.5;
  bool isHidden = hasHighlight && (pass > 0.5) != isHighlighted;

  gl_Position = isHidden ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(position * scale + offset, 0.0, 1.0);
  gl_PointSize = isHidden ? 0.0 : size;
  color = hasHighlight && !isHighlighted ? context : palette[int(group + 0.5)];
  edge = 2.0 / size;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
varying vec4 color;
varying float edge;

void main() {
  float distance = length(gl_PointCoord * 2.0 - 1.0);
  float coverage = 1.0 - smoothstep(1.0 - edge, 1.0, distance);

  if (coverage <= 0.0) {
    discard;
  }

  float alpha = color.a * coverage;

  gl_FragColor = vec4(color.rgb * alpha, alpha);
}
`;

type GlProgram = {
  readonly program: WebGLProgram;
  readonly buffer: WebGLBuffer;
  readonly position: number;
  readonly group: number;
  readonly uniform: (name: string) => WebGLUniformLocation | null;
};

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);

  if (shader === null) {
    throw new Error('The point layer could not create a WebGL shader.');
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true && !gl.isContextLost()) {
    throw new Error(`The point layer's shader did not compile: ${gl.getShaderInfoLog(shader) ?? ''}`);
  }

  return shader;
}

function link(gl: WebGLRenderingContext): GlProgram {
  const program = gl.createProgram();
  const buffer = gl.createBuffer();

  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);

  if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true && !gl.isContextLost()) {
    throw new Error(`The point layer's shaders did not link: ${gl.getProgramInfoLog(program) ?? ''}`);
  }

  const locations = new Map<string, WebGLUniformLocation | null>();

  return {
    program,
    buffer,
    position: gl.getAttribLocation(program, 'position'),
    group: gl.getAttribLocation(program, 'group'),
    uniform: (name) => {
      if (!locations.has(name)) {
        locations.set(name, gl.getUniformLocation(program, name));
      }

      return locations.get(name) ?? null;
    },
  };
}

/** The points as one interleaved buffer, centered on their mean extent so 32-bit floats keep their precision. */
function interleave(points: PointColumns): { readonly data: Float32Array; readonly center: readonly [number, number] } {
  const [left = 0, right = 0] = columnExtent(points.x) ?? [];
  const [bottom = 0, top = 0] = columnExtent(points.y) ?? [];
  const center = [(left + right) * HALF, (bottom + top) * HALF] as const;
  const data = new Float32Array(points.x.length * FLOATS_PER_POINT);

  for (const [index, x] of points.x.entries()) {
    data[index * FLOATS_PER_POINT] = x - center[0];
    data[index * FLOATS_PER_POINT + 1] = (points.y[index] ?? 0) - center[1];
    data[index * FLOATS_PER_POINT + 2] = points.group[index] ?? 0;
  }

  return { data, center };
}

const softwareRenderers = /swiftshader|llvmpipe|softpipe|software/i;

/**
 * Whether WebGL here rasterizes on the CPU, as headless browsers and machines without a GPU do. A million points then
 * take most of a second, so the layer draws them over several frames instead of in one call.
 */
function isSoftwareGl(canvas: HTMLCanvasElement): boolean {
  const probe = canvas.ownerDocument.createElement('canvas').getContext('webgl');

  if (probe === null) {
    return false;
  }

  const info = probe.getExtension('WEBGL_debug_renderer_info');
  const name = String(probe.getParameter(info === null ? probe.RENDERER : info.UNMASKED_RENDERER_WEBGL));

  probe.getExtension('WEBGL_lose_context')?.loseContext();

  return softwareRenderers.test(name);
}

function webglEngine(canvas: HTMLCanvasElement): PointEngine | undefined {
  const isSoftware = isSoftwareGl(canvas);

  const gl = canvas.getContext('webgl', {
    antialias: false,
    premultipliedAlpha: true,
    alpha: true,
    preserveDrawingBuffer: isSoftware,
  });

  if (gl === null) {
    return undefined;
  }

  const state: {
    program: GlProgram;
    points: PointColumns;
    center: readonly [number, number];
    count: number;
    last: PointFrame | undefined;
    frame: number;
  } = { program: link(gl), points: NO_POINTS, center: [0, 0], count: 0, last: undefined, frame: 0 };

  function upload(points: PointColumns): void {
    const { data, center } = interleave(points);

    state.points = points;
    state.center = center;
    state.count = points.x.length;

    gl?.bindBuffer(gl.ARRAY_BUFFER, state.program.buffer);
    gl?.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  }

  function prepare(frame: PointFrame): void {
    if (gl === null) {
      return;
    }

    const { program, uniform } = state.program;
    const { box, ratio } = frame;
    const kx = slope(frame.x);
    const ky = slope(frame.y);
    const pixelX = frame.x.range[0] + (state.center[0] - frame.x.domain[0]) * kx;
    const pixelY = frame.y.range[0] + (state.center[1] - frame.y.domain[0]) * ky;

    sizeCanvas(canvas, frame);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(
      Math.floor(box.left * ratio),
      Math.floor((box.height - box.bottom) * ratio),
      Math.ceil(box.innerWidth * ratio),
      Math.ceil(box.innerHeight * ratio),
    );
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.program.buffer);
    gl.enableVertexAttribArray(state.program.position);
    gl.vertexAttribPointer(state.program.position, 2, gl.FLOAT, false, FLOATS_PER_POINT * BYTES_PER_FLOAT, 0);
    gl.enableVertexAttribArray(state.program.group);
    gl.vertexAttribPointer(
      state.program.group,
      1,
      gl.FLOAT,
      false,
      FLOATS_PER_POINT * BYTES_PER_FLOAT,
      2 * BYTES_PER_FLOAT,
    );
    gl.uniform2f(uniform('scale'), (2 * kx) / box.width, (-2 * ky) / box.height);
    gl.uniform2f(uniform('offset'), (2 * pixelX) / box.width - 1, 1 - (2 * pixelY) / box.height);
    gl.uniform1f(uniform('size'), 2 * frame.radius * ratio + 1);
    gl.uniform1f(uniform('highlight'), frame.highlight);

    const palette = Array.from({ length: POINT_TONES_MAX }, (_, index) => {
      const [red, green, blue] = unitColor(frame.palette[index] ?? frame.context);

      return [red, green, blue, frame.opacity];
    }).flat();

    const [red, green, blue] = unitColor(frame.context);

    gl.uniform4fv(uniform('palette'), palette);
    gl.uniform4f(uniform('context'), red, green, blue, frame.opacity * CONTEXT_OPACITY);
  }

  function draw(frame: PointFrame, done: (milliseconds: number) => void): void {
    cancelAnimationFrame(state.frame);

    state.last = frame;

    if (gl === null || gl.isContextLost()) {
      return;
    }

    const chunk = isSoftware ? POINTS_PER_FRAME : Math.max(1, state.count);
    const starts = Array.from({ length: Math.ceil(state.count / chunk) }, (_, index) => index * chunk);
    const steps = (frame.highlight >= 0 ? [0, 1] : [0]).flatMap((pass) => starts.map((first) => ({ pass, first })));
    const spent = { milliseconds: 0 };
    const started = performance.now();

    prepare(frame);

    spent.milliseconds = performance.now() - started;

    function run(index: number): void {
      const step = steps[index];

      if (gl === null || step === undefined) {
        done(spent.milliseconds);

        return;
      }

      const begun = performance.now();

      gl.uniform1f(state.program.uniform('pass'), step.pass);
      gl.drawArrays(gl.POINTS, step.first, Math.min(chunk, state.count - step.first));

      spent.milliseconds += performance.now() - begun;

      if (index + 1 < steps.length) {
        state.frame = requestAnimationFrame(() => run(index + 1));
      } else {
        run(index + 1);
      }
    }

    run(0);
  }

  function lose(event: Event): void {
    event.preventDefault();
  }

  function restore(): void {
    if (gl === null) {
      return;
    }

    state.program = link(gl);

    upload(state.points);

    if (state.last !== undefined) {
      draw(state.last, () => undefined);
    }
  }

  canvas.addEventListener('webglcontextlost', lose);
  canvas.addEventListener('webglcontextrestored', restore);

  return {
    renderer: 'webgl',
    upload,
    draw,
    destroy: () => {
      cancelAnimationFrame(state.frame);
      canvas.removeEventListener('webglcontextlost', lose);
      canvas.removeEventListener('webglcontextrestored', restore);
      gl.deleteBuffer(state.program.buffer);
      gl.deleteProgram(state.program.program);
    },
  };
}

function PointCanvas({
  box,
  points,
  x,
  y,
  tones,
  highlight = null,
  radius = POINT_RADIUS,
  opacity = POINT_OPACITY,
  renderer,
  onDraw,
}: PointLayerProps): ReactNode {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const engine = useRef<PointEngine | null>(null);
  const revision = useDrawRevision(canvas);

  useEffect(() => {
    if (canvas === null) {
      return;
    }

    const created = renderer === 'webgl' ? (webglEngine(canvas) ?? canvasEngine(canvas)) : canvasEngine(canvas);

    engine.current = created;

    return () => {
      created.destroy();

      engine.current = null;
    };
  }, [canvas, renderer]);

  useEffect(() => {
    engine.current?.upload({ x: points.x, y: points.y, group: points.group });
  }, [canvas, renderer, points.x, points.y, points.group]);

  const paint = useEffectEvent((current: PointEngine, element: HTMLCanvasElement) => {
    const colors = resolveColors(element, [...tones.map((tone) => chartToneColors[tone]), chartToneColors.neutral]);

    const frame: PointFrame = {
      box,
      ratio: element.ownerDocument.defaultView?.devicePixelRatio ?? 1,
      x,
      y,
      palette: colors.slice(0, -1),
      context: colors.at(-1) ?? [0, 0, 0, 0],
      highlight: highlight ?? NO_HIGHLIGHT,
      radius,
      opacity,
    };

    current.draw(frame, (milliseconds) =>
      onDraw?.({ renderer: current.renderer, milliseconds, points: points.x.length }),
    );
  });

  const frameKey = [
    box.width,
    box.height,
    box.left,
    box.top,
    box.right,
    box.bottom,
    ...x.domain,
    ...x.range,
    ...y.domain,
    ...y.range,
    ...tones,
    highlight,
    radius,
    opacity,
  ].join(' ');

  useEffect(() => {
    if (engine.current !== null && canvas !== null) {
      paint(engine.current, canvas);
    }
  }, [canvas, renderer, frameKey, points.x, points.y, points.group, revision]);

  return <canvas ref={setCanvas} aria-hidden {...stylex.props(styles.canvas(box.width, box.height))} />;
}

/**
 * Many points drawn on a canvas over a plot: up to about a hundred thousand with canvas 2D, up to about a million with
 * WebGL in one draw call. Put it in `PlotSurface`'s `overlay`, beside the SVG axes. Its colors follow the theme, and
 * when WebGL is unavailable it draws with canvas and says so through `onDraw`.
 */
export function PointLayer(props: PointLayerProps): ReactNode {
  return <PointCanvas key={props.renderer} {...props} />;
}
