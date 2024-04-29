import {Delta} from 'loro-crdt';
import {isEqual} from 'lodash-es';

export function assertEqual(a: Delta<string>[], b: Delta<string>[]): boolean {
    a = normQuillDelta(a);
    b = normQuillDelta(b);
    const equal = isEqual(a, b);
    console.assert(equal, a, b);
    return equal;
}

/**
 * Removes the ending '\n's if it has no attributes.
 *
 * Extract line-break to a single op
 *
 * Normalize attributes field
 */
export const normQuillDelta = (delta: Delta<string>[]) => {
    for (const d of delta) {
        for (const key of Object.keys(d.attributes || {})) {
            if (d.attributes![key] == null) {
                delete d.attributes![key];
            }
        }
    }

    for (const d of delta) {
        if (Object.keys(d.attributes || {}).length === 0) {
            delete d.attributes;
        }
    }

    if (delta.length > 0) {
        const d = delta[delta.length - 1];
        const insert = d.insert;
        if (
            d.attributes === undefined &&
            insert !== undefined &&
            insert.slice(-1) === "\n"
        ) {
            delta = delta.slice();
            let ins = insert.slice(0, -1);
            while (ins.slice(-1) === "\n") {
                ins = ins.slice(0, -1);
            }
            delta[delta.length - 1] = {insert: ins};
            if (ins.length === 0) {
                delta.pop();
            }
        }
    }

    const ans: Delta<string>[] = [];
    for (const span of delta) {
        if (span.insert != null && span.insert.includes("\n")) {
            const lines = span.insert.split("\n");
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.length !== 0) {
                    ans.push({...span, insert: line} as Delta<string>);
                }
                if (i < lines.length - 1) {
                    const attr = {...span.attributes};
                    const v: Delta<string> = {insert: "\n"};
                    for (const style of ["bold", "link", "italic", "underline"]) {
                        if (attr && attr[style]) {
                            delete attr[style];
                        }
                    }

                    if (Object.keys(attr || {}).length > 0) {
                        v.attributes = attr;
                    }
                    ans.push(v);
                }
            }
        } else {
            ans.push(span);
        }
    }

    return ans;
};