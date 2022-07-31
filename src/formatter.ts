/* eslint-disable no-extend-native */
import { interpret, Node, Directive, Value } from './parser';

export function format(text: string): string {
    const node = interpret(text).value;
    return formatNode(node)[1].trim() + NEWLINE;
}

// The number of spaces at each indention is 4
const INDENT = "    ";
// One space between two words
const WORDGAP = " ";
const NEWLINE = "\n";
enum Position {
    Inline,
    Standalone
}
type FormatResult = [Position, string];

declare global {
    interface String {
        join(res: FormatResult): string;
    }
}

String.prototype.join = function (res: FormatResult): string {
    let s = String(this);
    if (res[0] === Position.Inline) {
        s += WORDGAP + res[1];
    } else if (res[0] === Position.Standalone) {
        s += NEWLINE + res[1];
    }
    return s;
}

function formatNode(node: Node): [Position, string] {
    const level = node.level;
    let result = "";
    node.directives.forEach((d) => {
        result = result.join(formatDirective(d, level));
    })
    return [Position.Standalone, result];
}

function formatDirective(d: Directive, level: number): [Position, string] {
    let result = "";
    const indent = INDENT.repeat(level);
    result = formatValue(d.verb)[1];
    result = result.join(formatParameters(d.parameters));
    if (d.semi) {
        result = result.join(formatSemi(d.semi));
    } else if (d.subNode) {
        result = result.join(formatNode(d.subNode));
    }
    return [Position.Standalone, result];
}

function formatValue(v: Value): [Position, string] {
    let result = "";
    let pos = Position.Inline;
    if (v.commentsBefore) {
        let block = "";
        v.commentsBefore.reverse().forEach(cm => {
            cm = cm.trim();
            if (cm) {
                block += cm + NEWLINE;
            }
        });
        block = block.trim();
        if (block) {
            pos = Position.Standalone;
        }
        result += block.trim();
        if (result) {
            result += NEWLINE;
        }
    }
    result += v.value.trim();
    if (v.commentAfter) {
        result += WORDGAP;
        result += v.commentAfter.trim();
    }
    return [pos, result];
}

const formatSemi = formatValue;

function formatParameters(params: Value[]): [Position, string] {
    let result = "";
    let pos;
    if (params) {
        const len = params.length;
        const firstValue = formatValue(params[0]);
        // the Position of parameters is determined by the first parameter.
        pos = firstValue[0];
        result = firstValue[1];
        for (let i = 1; i < len; ++i) {
            result = result.join(formatValue(params[i]));
        }
    } else {
        pos = Position.Inline;
    }

    return [pos, result];
}
