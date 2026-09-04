/** Public, dependency-free contracts for the local file converter. */

export type FormatCategory =
  | "documents-pdf"
  | "images"
  | "audio"
  | "video"
  | "archives"
  | "structured-data-spreadsheets"
  | "code-text"
  | "binary-encodings";

export type AdapterAvailability = "enabled" | "disabled";

export interface AdapterDependency {
  name: string;
  version?: string;
  bundled: boolean;
  available: boolean;
  reason?: string;
}

export interface PackagedProof {
  status: "verified" | "missing" | "stale" | "unverified";
  executable?: string;
  packagePath?: string;
  commit?: string;
  sha256?: string;
  checkedAt?: string;
  reason?: string;
}

export interface AdapterDescriptor {
  id: string;
  label: string;
  category: FormatCategory;
  sourceFormats: readonly string[];
  targetFormats: readonly string[];
  sourceSignatures: readonly string[];
  bundled: boolean;
  packagedProof: PackagedProof;
  dependencies: readonly AdapterDependency[];
  lossiness: "lossless" | "lossy" | "metadata-change" | "unknown";
  metadataBehavior: string;
  resourceLimits: {
    maxInputBytes: number;
    maxOutputBytes: number;
    maxItems: number;
  };
  availability: AdapterAvailability;
  unavailableReason?: string;
}

export interface SignatureDetection {
  format: string;
  mime: string;
  confidence: "exact" | "strong" | "heuristic";
  category: FormatCategory;
  details: string;
}

export interface ConversionSource {
  id: string;
  path: string;
  name: string;
  sizeBytes: number;
  detected?: SignatureDetection;
}

export interface ConversionTarget {
  adapterId: string;
  format: string;
  destinationPath: string;
  overwrite: boolean;
}

export interface LossDisclosure {
  required: boolean;
  title: string;
  changes: readonly string[];
  acknowledged: boolean;
}

export interface ConversionResult {
  sourceId: string;
  status: "converted" | "skipped" | "cancelled" | "failed";
  outputPath?: string;
  outputBytes?: number;
  error?: string;
  lossDisclosure?: LossDisclosure;
}

export interface StoragePreflight {
  destination: string;
  requiredBytes: number;
  availableBytes: number;
  sufficient: boolean;
  reason?: string;
}

export interface OutputValidation {
  valid: boolean;
  format?: string;
  sizeBytes: number;
  reason?: string;
}

export type QueueItemStatus =
  | "queued"
  | "running"
  | "paused"
  | "converted"
  | "skipped"
  | "cancelled"
  | "failed";

export interface QueueItem<T = unknown> {
  id: string;
  input: T;
  status: QueueItemStatus;
  attempts: number;
  result?: ConversionResult;
  updatedAt: string;
}

export interface QueueSummary {
  totalSeen: number;
  completed: number;
  converted: number;
  skipped: number;
  cancelled: number;
  failed: number;
  running: number;
  paused: boolean;
}

export interface QueueStore<T> {
  get(id: string): Promise<QueueItem<T> | undefined>;
  put(item: QueueItem<T>): Promise<void>;
  list(): Promise<QueueItem<T>[]>;
}

export interface PdfDocumentInfo {
  pageCount: number | null;
  encrypted: boolean;
  signed: boolean;
  metadata: Record<string, string>;
}

export type PdfOperation =
  | { kind: "inspect" }
  | { kind: "split"; pages: readonly number[] }
  | { kind: "merge"; inputs: readonly string[] }
  | { kind: "extract"; pages: readonly number[] }
  | { kind: "reorder"; pages: readonly number[] }
  | { kind: "rotate"; pages: readonly { page: number; degrees: 0 | 90 | 180 | 270 }[] }
  | { kind: "metadata"; values: Readonly<Record<string, string>> };

export interface PdfEngine {
  execute(operation: PdfOperation, input: Uint8Array): Promise<Uint8Array | PdfDocumentInfo>;
}
