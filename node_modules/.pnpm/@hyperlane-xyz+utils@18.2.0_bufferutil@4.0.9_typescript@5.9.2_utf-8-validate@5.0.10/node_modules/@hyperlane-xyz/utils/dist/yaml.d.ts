import { Node as YamlNode } from 'yaml';
import { Result } from './result.js';
export declare function tryParseJsonOrYaml<T = any>(input: string): Result<T>;
/**
 * Transforms YAML content by applying a custom transformer function while preserving comments.
 *
 * @param content - Original YAML content as a string
 * @param transformer - A function that transforms the parsed YAML data
 * @returns The transformed YAML content as a string with comments preserved
 */
export declare function transformYaml<T extends YamlNode = YamlNode>(content: string, transformer: (data: T) => T): string;
export type ArraySortConfig = {
    arrays: Array<{
        path: string;
        sortKey: string;
    }>;
};
/**
 * Sorts arrays nested within objects according to configuration
 */
export declare function sortNestedArrays<T>(data: T, config: ArraySortConfig, path?: string[]): T;
//# sourceMappingURL=yaml.d.ts.map