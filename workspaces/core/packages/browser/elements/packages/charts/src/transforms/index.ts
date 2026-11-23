export type { Bin2dInput, Bin2dResult, BinValuesInput, BinValuesResult, ValueBin } from './bins.ts';
export { bin2d, binLimits, binValues, describeBin2d, describeBins } from './bins.ts';
export type { DensityPoint, KernelDensityInput, KernelDensityResult } from './density.ts';
export { densityLimits, describeKernelDensity, kernelDensity, silvermanBandwidth } from './density.ts';
export type { LinearFitResult, PowerLawFitResult } from './fits.ts';
export { describeLinearFit, describePowerLawFit, linearFit, powerLawFit } from './fits.ts';
export type { ConfusionCountsResult, CorrelationMatrixResult } from './matrices.ts';
export { confusionCounts, correlationMatrix, describeConfusion, describeCorrelation } from './matrices.ts';
export type {
  BoxSummary,
  BoxSummaryResult,
  EcdfPoint,
  EcdfResult,
  FiveNumberResult,
  FiveNumberSummary,
  WhiskerRule,
} from './quantiles.ts';
export { boxSummary, describeBoxSummary, describeEcdf, ecdfPoints, fiveNumberSummary, quantile } from './quantiles.ts';
export type { RankedItem, RankOrder, RankSeriesResult, StageRank } from './ranks.ts';
export { describeRanks, rankSeries } from './ranks.ts';
export type { RunSeries, RunSummaryPoint, SummarizeRunsInput, SummarizeRunsResult } from './runs.ts';
export { describeRunSummary, summarizeRuns } from './runs.ts';
export type { DownsampleResult, SampleResult } from './sampling.ts';
export {
  describeDownsample,
  describeSample,
  downsample,
  reservoirIndices,
  sampleEvenly,
  seededUniforms,
} from './sampling.ts';
export type { ExponentialSmoothingResult, MovingAverageResult } from './smoothing.ts';
export {
  describeExponentialSmoothing,
  describeMovingAverage,
  exponentialSmoothing,
  movingAverage,
} from './smoothing.ts';
export type { ObservedPoint, SeriesPoint, TransformInvalid, TransformOk, TransformResult } from './values.ts';
