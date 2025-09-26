import { Rule } from 'eslint';
declare const _default: {
    meta: {
        type: string;
        docs: {
            description: string;
            category: string;
            recommended: boolean;
            url: null;
        };
        fixable: string;
        schema: {
            type: string;
            properties: {
                arrays: {
                    type: string;
                    items: {
                        type: string;
                        properties: {
                            path: {
                                type: string;
                            };
                            sortKey: {
                                type: string;
                            };
                        };
                        required: string[];
                    };
                };
            };
            additionalProperties: boolean;
        }[];
    };
    create(context: Rule.RuleContext): {
        Program(node: Rule.Node): void;
    };
};
export default _default;
//# sourceMappingURL=sort-yaml-arrays.d.ts.map