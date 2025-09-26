/********* RESULT MONAD *********/
export type Result<T> = {
    success: true;
    data: T;
} | {
    success: false;
    error: string;
};
export declare function success<T>(data: T): Result<T>;
export declare function failure<T>(error: string): Result<T>;
//# sourceMappingURL=result.d.ts.map