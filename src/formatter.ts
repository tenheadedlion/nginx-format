/* eslint-disable no-extend-native */
import { interpret, Node, Directive, Value } from './parser';

// The number of spaces at each indention is 4
const INDENT = "    ";
// One space between two words
const WORDGAP = "  ";
const WORDGAPSM = " "; // smaller wordgap for inline comments
const NEWLINE = "\n";

export function format(text: string): string {
    const node = interpret(text).value;
    let out = "";
    const result = formatNode(node);
    result.value.forEach(line => {
        out += line + NEWLINE;
    })
    return out;
}
export class FormatUnit {
    public value: string[] = [];
    public shouldStartInNewLine: boolean = false;
    public canBeAppendedTo: boolean = false;
    public pushLine(s: string) { this.value.push(s); }
}

export function concatForUnits(v1: FormatUnit, v2: FormatUnit): FormatUnit {
    if (v1.value.length === 0) return v2;
    const len = v2.value.length;
    if (len === 0) {
        return v1;
    }
    if (v1.canBeAppendedTo && !v2.shouldStartInNewLine) {
        const firstV2Line = v2.value[0];
        let lastV1Line = v1.value.pop()!;
        lastV1Line += (
            (firstV2Line.startsWith(';') || firstV2Line.startsWith('}'))
                ? ''
                : (/*firstV2Line.startsWith('{') ? WORDGAPSM : */WORDGAP)) + firstV2Line;
        v1.value.push(lastV1Line);
    } else {
        v1.value = v1.value.concat(v2.value);
    }
    v1.canBeAppendedTo = v2.canBeAppendedTo;
    return v1;
}

function formatNode(node: Node): FormatUnit {
    let result = new FormatUnit();
    node.directives.forEach((d) => {
        result = concatForUnits(result, formatDirective(d));
    })
    if (node.level) {
        result.value = result.value.map(line => {
            return INDENT + line;
        })
    }
    result.shouldStartInNewLine = true;
    result.canBeAppendedTo = true;
    return result;
}

function formatDirective(d: Directive): FormatUnit {
    let result = formatValue(d.verb);
    result = concatForUnits(result, formatParameters(d.parameters));
    if (d.semi) {
        result = concatForUnits(result, formatSemi(d.semi));
    } else if (d.subNode) {
        result = concatForUnits(result, formatValue(d.lCurly!));
        result = concatForUnits(result, formatNode(d.subNode));
        result = concatForUnits(result, formatValue(d.rCurly!));
    }
    return result;
}

function formatValue(v: Value): FormatUnit {
    const unit = new FormatUnit();
    if (v.commentsBefore) {
        v.commentsBefore.reverse().forEach(cm => {
            cm = cm.trim();
            if (cm) {
                unit.value.push(cm);
            }
        });
    }
    if (unit.value.length) {
        unit.shouldStartInNewLine = true;
    }
    let valueLine = v.value.trim();
    if (v.commentAfter) {
        valueLine += WORDGAPSM;
        valueLine += v.commentAfter.trim();
    } else if (v.value === '}') {
        unit.canBeAppendedTo = false;
        unit.shouldStartInNewLine = true;
    }
    else if (v.value !== ';') {
        unit.canBeAppendedTo = true;
    }
    unit.value.push(valueLine);
    return unit;
}

const formatSemi = formatValue;

function formatParameters(params: Value[]): FormatUnit {
    let result = new FormatUnit();
    params.forEach(v => {
        result = concatForUnits(result, formatValue(v));
    });
    return result;
}
