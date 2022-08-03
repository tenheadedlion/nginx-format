/* eslint-disable no-extend-native */
import { interpret, Node, Directive, Value } from './parser';

// The number of spaces at each indention is 4
// const INDENT = "    ";
// One space between two words
// const WORDGAP = "  ";
// const WORDGAPSM = " "; // smaller wordgap for inline comments
const NEWLINE = "\n";

export interface FormatOptions {
    // the string filling the space between the head of a line and its margin.
    // by default it is 4 whitespaces
    indent?: string,
    // the number of characters for each line
    // by default it is 80
    textWidth?: number,
    // private members
    wordgapsm?: string,
    wordgap?: string
}

format.defaults = {
    indent: "    ",
    textWidth: 80,
    wordgapsm: " ",
    wordgap: "  "
}

export function format(text: string, opts?: FormatOptions): string {
    const formatOptions = { ...format.defaults, ...opts };
    const node = interpret(text).value;
    let out = "";
    const result = formatNode(node, formatOptions);
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

export function concatFormUnits(v1: FormatUnit, v2: FormatUnit, opts: FormatOptions): FormatUnit {
    if (v1.value.length === 0) return v2;
    const len = v2.value.length;
    if (len === 0) {
        return v1;
    }
    // Fix: the code is confusing here
    if (v1.canBeAppendedTo && !v2.shouldStartInNewLine) {
        const firstV2Line = v2.value[0];
        const lastV1Line = v1.value.pop()!;
        // this is the place where line breaks can happen
        const jointLine = lastV1Line + (
            (firstV2Line.startsWith(';') || firstV2Line.startsWith('}'))
                ? ''
                : (/*firstV2Line.startsWith('{') ? WORDGAPSM : */opts.wordgap)) + firstV2Line;
        if (jointLine.length > opts.textWidth!) {
            v2.value[0] = opts.indent! + firstV2Line;
            v1.value.push(lastV1Line);
            v1.value = v1.value.concat(v2.value);
        }
        else {
            v1.value.push(jointLine);
            if (v2.value.length > 1) {
                v2.value.shift();
                v1.value = v1.value.concat(v2.value);
            }
        }
    } else {
        v1.value = v1.value.concat(v2.value);
    }
    v1.canBeAppendedTo = v2.canBeAppendedTo;
    return v1;
}

function formatNode(node: Node, opts: FormatOptions): FormatUnit {
    let result = new FormatUnit();
    node.directives.forEach((d) => {
        result = concatFormUnits(result, formatDirective(d, opts), opts);
    })
    if (node.level) {
        result.value = result.value.map(line => {
            return opts.indent + line;
        })
    }
    result.shouldStartInNewLine = true;
    result.canBeAppendedTo = true;
    return result;
}

function formatDirective(d: Directive, opts: FormatOptions): FormatUnit {
    let result = formatValue(d.verb, opts);
    result = concatFormUnits(result, formatParameters(d.parameters, opts), opts);
    if (d.semi) {
        result = concatFormUnits(result, formatSemi(d.semi, opts), opts);
    } else if (d.subNode) {
        result = concatFormUnits(result, formatValue(d.lCurly!, opts), opts);
        result = concatFormUnits(result, formatNode(d.subNode, opts), opts);
        result = concatFormUnits(result, formatValue(d.rCurly!, opts), opts);
    }
    return result;
}

function formatValue(v: Value, opts: FormatOptions): FormatUnit {
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
        valueLine += opts.wordgapsm;
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

function formatParameters(params: Value[], opts: FormatOptions): FormatUnit {
    let result = new FormatUnit();
    params.forEach(v => {
        result = concatFormUnits(result, formatValue(v, opts), opts);
    });
    return result;
}
