import { Checkpoint, S3Checkpoint, S3CheckpointWithId, SignatureLike } from './types.js';
export declare function isValidSignature(signature: any): signature is SignatureLike;
export declare function isS3Checkpoint(obj: any): obj is S3Checkpoint;
export declare function isS3CheckpointWithId(obj: any): obj is S3CheckpointWithId;
export declare function isCheckpoint(obj: any): obj is Checkpoint;
//# sourceMappingURL=checkpoints.d.ts.map