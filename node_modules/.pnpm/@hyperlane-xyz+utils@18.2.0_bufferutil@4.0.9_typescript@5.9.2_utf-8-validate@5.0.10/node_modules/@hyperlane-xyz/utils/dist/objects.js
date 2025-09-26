import { cloneDeep, isEqual } from 'lodash-es';
import { stringify as yamlStringify } from 'yaml';
import { ethersBigNumberSerializer } from './logging.js';
import { isNullish } from './typeof.js';
import { assert } from './validation.js';
export function isObject(item) {
    return !!item && typeof item === 'object' && !Array.isArray(item);
}
export function deepEquals(v1, v2) {
    return isEqual(v1, v2);
}
export function deepCopy(v) {
    return cloneDeep(v);
}
// Useful for maintaining type safety when using Object.keys
export function objKeys(obj) {
    return Object.keys(obj);
}
export function objLength(obj) {
    return Object.keys(obj).length;
}
export function isObjEmpty(obj) {
    return objLength(obj) === 0;
}
export function objMapEntries(obj, func) {
    return Object.entries(obj).map(([k, v]) => [k, func(k, v)]);
}
// Map over the values of the object
export function objMap(obj, func) {
    return Object.fromEntries(objMapEntries(obj, func));
}
export function objFilter(obj, func) {
    return Object.fromEntries(Object.entries(obj).filter(([k, v]) => func(k, v)));
}
export function deepFind(obj, func, depth = 10) {
    assert(depth > 0, 'deepFind max depth reached');
    if (func(obj)) {
        return obj;
    }
    const entries = isObject(obj)
        ? Object.values(obj)
        : Array.isArray(obj)
            ? obj
            : [];
    return entries.map((e) => deepFind(e, func, depth - 1)).find((v) => v);
}
// promiseObjectAll :: {k: Promise a} -> Promise {k: a}
export function promiseObjAll(obj) {
    const promiseList = Object.entries(obj).map(([name, promise]) => promise.then((result) => [name, result]));
    return Promise.all(promiseList).then(Object.fromEntries);
}
// Get the subset of the object from key list
export function pick(obj, keys) {
    const ret = {};
    const objKeys = Object.keys(obj);
    for (const key of keys) {
        if (objKeys.includes(key)) {
            ret[key] = obj[key];
        }
    }
    return ret;
}
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
export function objMerge(a, b, max_depth = 10, mergeArrays = false) {
    // If we've reached the max depth, throw an error
    if (max_depth === 0) {
        throw new Error('objMerge tried to go too deep');
    }
    // If either A or B is not an object, return the other value
    if (!isObject(a) || !isObject(b)) {
        return (b ?? a);
    }
    // Initialize returned object with values from A
    const ret = { ...a };
    // Iterate over keys in B
    for (const key in b) {
        // If both A and B have the same key, recursively merge the values from B into A
        if (isObject(a[key]) && isObject(b[key])) {
            ret[key] = objMerge(a[key], b[key], max_depth - 1, mergeArrays);
        }
        // If A & B are both arrays, and we're merging them, concatenate them with B's values taking priority before A
        else if (mergeArrays && Array.isArray(a[key]) && Array.isArray(b[key])) {
            ret[key] = [...b[key], ...a[key]];
        }
        // If B has a value for the key, set the value to B's value
        // This better handles the case where A has a value for the key, but B does not
        // In which case we want to keep A's value
        else if (b[key] !== undefined) {
            ret[key] = b[key];
        }
    }
    // Return the merged object
    return ret;
}
/**
 * Return a new object with the fields in b removed from a
 * @param a Base object to remove fields from
 * @param b The partial object to remove from the base object
 * @param max_depth The maximum depth to recurse
 * @param sliceArrays If true, arrays will have values sliced out instead of being removed entirely
 */
export function objOmit(a, b, max_depth = 10, sliceArrays = false) {
    if (max_depth === 0) {
        throw new Error('objSlice tried to go too deep');
    }
    if (!isObject(a) || !isObject(b)) {
        return a;
    }
    const ret = {};
    const aKeys = new Set(Object.keys(a));
    const bKeys = new Set(Object.keys(b));
    for (const key of aKeys.values()) {
        if (bKeys.has(key)) {
            if (sliceArrays && Array.isArray(a[key]) && Array.isArray(b[key])) {
                ret[key] = a[key].filter((v) => !b[key].some((bv) => deepEquals(v, bv)));
            }
            else if (isObject(a[key]) && isObject(b[key])) {
                const sliced = objOmit(a[key], b[key], max_depth - 1, sliceArrays);
                if (Object.keys(sliced).length > 0) {
                    ret[key] = sliced;
                }
            }
            else if (!!b[key] == false) {
                ret[key] = objOmit(a[key], b[key], max_depth - 1, sliceArrays);
            }
        }
        else {
            ret[key] = a[key];
        }
    }
    return ret;
}
export function objOmitKeys(obj, keys) {
    return objFilter(obj, (k, _v) => !keys.includes(k));
}
export function invertKeysAndValues(data) {
    return Object.fromEntries(Object.entries(data)
        .filter(([_, value]) => value !== undefined && value !== null) // Filter out undefined and null values
        .map(([key, value]) => [value, key]));
}
// Returns an object with the keys as values from an array and value set to true
export function arrayToObject(keys, val = true) {
    return keys.reduce((result, k) => {
        result[k] = val;
        return result;
    }, {});
}
export function stringifyObject(object, format = 'yaml', space) {
    // run through JSON first because ethersBigNumberSerializer does not play nice with yamlStringify
    // so we fix up in JSON, then parse and if required return yaml on processed JSON after
    const json = JSON.stringify(object, ethersBigNumberSerializer, space);
    if (format === 'json') {
        return json;
    }
    return yamlStringify(JSON.parse(json), null, {
        indent: space ?? 2,
        sortMapEntries: true,
    });
}
/**
 * Merges 2 objects showing any difference in value for common fields.
 */
export function diffObjMerge(actual, expected, maxDepth = 10) {
    if (maxDepth === 0) {
        throw new Error('diffObjMerge tried to go too deep');
    }
    let isDiff = false;
    if (!isObject(actual) && !isObject(expected) && actual === expected) {
        return {
            isInvalid: isDiff,
            mergedObject: actual,
        };
    }
    if (isNullish(actual) && isNullish(expected)) {
        return { mergedObject: undefined, isInvalid: isDiff };
    }
    if (isObject(actual) && isObject(expected)) {
        const ret = {};
        const actualKeys = new Set(Object.keys(actual));
        const expectedKeys = new Set(Object.keys(expected));
        const allKeys = new Set([...actualKeys, ...expectedKeys]);
        for (const key of allKeys.values()) {
            if (actualKeys.has(key) && expectedKeys.has(key)) {
                const { mergedObject, isInvalid } = diffObjMerge(actual[key], expected[key], maxDepth - 1) ?? {};
                ret[key] = mergedObject;
                isDiff ||= isInvalid;
            }
            else if (actualKeys.has(key) && !isNullish(actual[key])) {
                ret[key] = {
                    actual: actual[key],
                    expected: '',
                };
                isDiff = true;
            }
            else if (!isNullish(expected[key])) {
                ret[key] = {
                    actual: '',
                    expected: expected[key],
                };
                isDiff = true;
            }
        }
        return {
            isInvalid: isDiff,
            mergedObject: ret,
        };
    }
    // Merge the elements of the array to see if there are any differences
    if (Array.isArray(actual) &&
        Array.isArray(expected) &&
        actual.length === expected.length) {
        const merged = actual.reduce((acc, curr, idx) => {
            const { isInvalid, mergedObject } = diffObjMerge(curr, expected[idx]);
            acc[0].push(mergedObject);
            acc[1] ||= isInvalid;
            return acc;
        }, [[], isDiff]);
        return {
            isInvalid: merged[1],
            mergedObject: merged[0],
        };
    }
    return {
        mergedObject: { expected: expected ?? '', actual: actual ?? '' },
        isInvalid: true,
    };
}
// Recursively visit all the fields in an object and keep
// only those that describe mismatches
export function keepOnlyDiffObjects(obj) {
    const result = {};
    if (Array.isArray(obj)) {
        return obj
            .map((item) => (isObject(item) ? keepOnlyDiffObjects(item) : {}))
            .filter((item) => !isObjEmpty(item));
    }
    else if (isObject(obj)) {
        const casted = obj;
        if (!isNullish(casted.expected) && !isNullish(casted.actual)) {
            return obj;
        }
        else {
            const filtered = Object.fromEntries(Object.entries(obj)
                .map(([key, value]) => [
                key,
                keepOnlyDiffObjects(value),
            ])
                .filter(([_key, value]) => !isObjEmpty(value)));
            // if this object has a type field we include to easily
            // identify the type of the hook or ism
            if (!isObjEmpty(filtered) && obj.type) {
                filtered.type = obj.type;
            }
            return filtered;
        }
    }
    return result;
}
export function mustGet(obj, key) {
    const value = obj[key];
    if (!value) {
        throw new Error(`Missing key ${key} in object ${JSON.stringify(obj)}`);
    }
    return value;
}
/**
 * Recursively applies `formatter` to the provided object
 *
 * @param obj
 * @param transformer a user defined function that takes an object and transforms it.
 * @param maxDepth the maximum depth that can be reached when going through nested fields of a property
 *
 * @throws if `maxDepth` is reached in an object property
 */
export function transformObj(obj, transformer, maxDepth = 15) {
    return internalTransformObj(obj, transformer, [], maxDepth);
}
function internalTransformObj(obj, transformer, propPath, maxDepth) {
    if (propPath.length > maxDepth) {
        throw new Error(`transformObj went too deep. Max depth is ${maxDepth}`);
    }
    if (Array.isArray(obj)) {
        return obj.map((obj) => internalTransformObj(obj, transformer, [...propPath], maxDepth));
    }
    else if (isObject(obj)) {
        const newObj = Object.entries(obj)
            .map(([key, value]) => {
            return [
                key,
                internalTransformObj(value, transformer, [...propPath, key], maxDepth),
            ];
        })
            .filter(([_key, value]) => value !== undefined && value !== null);
        return transformer(Object.fromEntries(newObj), propPath);
    }
    return transformer(obj, propPath);
}
export function sortArraysInObject(obj, sortFunction) {
    // Check if the current object is an array
    if (Array.isArray(obj)) {
        return obj
            .sort(sortFunction)
            .map((item) => sortArraysInObject(item, sortFunction));
    }
    // Check if it's an object and not null or undefined
    else if (isObject(obj)) {
        return Object.fromEntries(Object.entries(obj).map(([key, value]) => [
            key,
            sortArraysInObject(value, sortFunction),
        ]));
    }
    return obj;
}
//# sourceMappingURL=objects.js.map