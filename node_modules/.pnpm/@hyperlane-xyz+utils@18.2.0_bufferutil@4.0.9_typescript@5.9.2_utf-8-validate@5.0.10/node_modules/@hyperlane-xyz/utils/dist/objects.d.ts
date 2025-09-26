export declare function isObject(item: any): boolean;
export declare function deepEquals(v1: any, v2: any): boolean;
export declare function deepCopy(v: any): any;
export type ValueOf<T> = T[keyof T];
export declare function objKeys<T extends string | number>(obj: Record<T, any>): T[];
export declare function objLength(obj: Record<any, any>): number;
export declare function isObjEmpty(obj: Record<any, any>): boolean;
export declare function objMapEntries<M extends Record<K, I>, K extends keyof M, O, I = ValueOf<M>>(obj: M, func: (k: K, v: I) => O): [K, O][];
export declare function objMap<M extends Record<K, I>, K extends keyof M, O, I = ValueOf<M>>(obj: M, func: (k: K, v: I) => O): Record<K, O>;
export declare function objFilter<K extends string, I, O extends I>(obj: Record<K, I>, func: (k: K, v: I) => v is O): Record<K, O>;
export declare function deepFind<I extends object, O extends I>(obj: I, func: (v: I) => v is O, depth?: number): O | undefined;
export declare function promiseObjAll<K extends string, V>(obj: {
    [key in K]: Promise<V>;
}): Promise<Record<K, V>>;
export declare function pick<K extends string, V = any>(obj: Record<K, V>, keys: K[]): Record<K, V>;
/**
 *  Returns a new object that recursively merges B into A
 *  Where there are conflicts, B takes priority over A
 *  If B has a value for a key that A does not have, B's value is used
 *  If B has a value for a key that A has, and both are objects, the merge recurses into those objects
 *  If B has a value for a key that A has, and both are arrays, the merge concatenates them with B's values taking priority
 * @param a - The first object
 * @param b - The second object
 * @param max_depth - The maximum depth to recurse
 * @param mergeArrays - If true, arrays will be concatenated instead of replaced
 */
export declare function objMerge<T = any>(a: Record<string, any>, b: Record<string, any>, max_depth?: number, mergeArrays?: boolean): T;
/**
 * Return a new object with the fields in b removed from a
 * @param a Base object to remove fields from
 * @param b The partial object to remove from the base object
 * @param max_depth The maximum depth to recurse
 * @param sliceArrays If true, arrays will have values sliced out instead of being removed entirely
 */
export declare function objOmit<T extends Record<string, any> = any>(a: Record<string, any>, b: Record<string, any>, max_depth?: number, sliceArrays?: boolean): T;
export declare function objOmitKeys<T extends Record<string, any> = any>(obj: Record<string, any>, keys: string[]): Partial<T>;
export declare function invertKeysAndValues(data: any): any;
export declare function arrayToObject(keys: Array<string>, val?: boolean): Record<string, boolean>;
export declare function stringifyObject(object: any, format?: 'json' | 'yaml', space?: number): string;
interface ObjectDiffOutput {
    actual: any;
    expected: any;
}
export type ObjectDiff = {
    [key: string]: ObjectDiffOutput | ObjectDiff;
} | ObjectDiff[] | undefined;
/**
 * Merges 2 objects showing any difference in value for common fields.
 */
export declare function diffObjMerge(actual: Record<string, any>, expected: Record<string, any>, maxDepth?: number): {
    mergedObject: ObjectDiff;
    isInvalid: boolean;
};
export declare function keepOnlyDiffObjects(obj: any): any;
export declare function mustGet<T>(obj: Record<string, T>, key: string): T;
export type TransformObjectTransformer = (obj: any, propPath: ReadonlyArray<string>) => any;
/**
 * Recursively applies `formatter` to the provided object
 *
 * @param obj
 * @param transformer a user defined function that takes an object and transforms it.
 * @param maxDepth the maximum depth that can be reached when going through nested fields of a property
 *
 * @throws if `maxDepth` is reached in an object property
 */
export declare function transformObj(obj: any, transformer: TransformObjectTransformer, maxDepth?: number): any;
export declare function sortArraysInObject(obj: any, sortFunction?: (a: any, b: any) => number): any;
export {};
//# sourceMappingURL=objects.d.ts.map