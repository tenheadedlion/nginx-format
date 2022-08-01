import { createToken as orgCreateToken, Lexer, CstParser, tokenMatcher, Rule, ITokenConfig } from "chevrotain";

class FormulaError extends Error {
    public details: any;
    constructor(message: string, details: any) {
        super(message);
        this.details = details;
    }
}

class ParserError extends FormulaError { }

const createToken = function (opts: ITokenConfig) {
    const newToken = orgCreateToken(opts);
    return newToken
}

const LCurly = createToken({ name: "LCurly", pattern: /{/ });
const RCurly = createToken({ name: "RCurly", pattern: /}/ });
const Semicolon = createToken({ name: "Semicolon", pattern: /;/ });
const SingleQuotedLiteral = createToken({ name: "single quote", pattern: /'[^']*'/ });
const DoubleQuoteLiteral = createToken({ name: "double quote", pattern: /"[^"]*"/ });
const TemplatePlaceholder = createToken({
    name: "TemplatePlaceholder", pattern: /\{\{[^{};]*\}\}/
});

const Literal = createToken({
    name: "Literal", pattern: /[^{}; \t]+/
});

const Comment = createToken({
    name: "Comment",
    pattern: /#[^\n\r]*/,
});
const WhiteSpace = createToken({
    name: "WhiteSpace",
    pattern: /[ \t]+/,
});

const NewLine = createToken({
    name: "LineTerminator",
    pattern: /\n\r|\r|\n/,
});

const Empty = createToken({
    name: "Empty"
});

const allTokens = [
    // always place the spaces on top, because there are some pattens that consume spaces.
    NewLine,
    WhiteSpace,
    Comment,
    Semicolon,
    SingleQuotedLiteral,
    DoubleQuoteLiteral,
    TemplatePlaceholder,
    LCurly,
    RCurly,
    Literal,
]

// comments can't be discarded(marked as LEXER.SKIPPED), they must be treated as tokens.
// a comment either occupies one entire line, or appears at the end of the line
// a token that is not a comment is surrounded by comments in the following format:
//
//      # multiple lined standalone comments
//      token # inline comment
//
// it's easy to get the comments before a token, but hard to get the comment after a token,
// you can't tell if the comment belongs to the non-comment token before it,
// unless you look ahead and make sure the comment is in the same line with this non-comment token
class NginxConfigParser extends CstParser {
    constructor() {
        super(allTokens);
        this.performSelfAnalysis();
    }
    public node = this.RULE("node", () => {
        this.MANY(() => this.SUBRULE(this.directive, { LABEL: "list" }))
    }
    );
    private directive = this.RULE("directive", () => {
        this.SUBRULE(this.value, { LABEL: "verb" });
        this.SUBRULE(this.parameters, { LABEL: "parameters" });
        this.OR([
            { ALT: () => { this.CONSUME(Semicolon, { LABEL: "semi" }); } },
            { ALT: () => this.SUBRULE(this.subNode, { LABEL: "block" }) }
        ])
    });
    private subNode = this.RULE("subNode", () => {
        this.CONSUME(LCurly);
        this.SUBRULE(this.node, { LABEL: "list" });
        this.CONSUME(RCurly);
    });
    private parameters = this.RULE("parameters", () => {
        this.MANY(
            () => this.SUBRULE(this.value, { LABEL: "parameters" })
        )
    });
    private value = this.RULE("value", () => {
        this.OR([
            { ALT: () => this.CONSUME(SingleQuotedLiteral, { LABEL: "value" }) },
            { ALT: () => this.CONSUME(DoubleQuoteLiteral, { LABEL: "value" }) },
            { ALT: () => this.CONSUME(TemplatePlaceholder, { LABEL: "value" }) },
            { ALT: () => this.CONSUME(Literal, { LABEL: "value" }) },
        ]);
    });

    // from the source code of chevrotain:
    //
    // skips a token and returns the next token
    // SKIP_TOKEN(this: MixedInParser): IToken {
    //     if (this.currIdx <= this.tokVector.length - 2) {
    //         this.consumeToken()
    //         return this.LA(1)
    //     } else {
    //         return END_OF_FILE
    //     }
    // }
    //
    // tokens marked as `lexer.SKIPPED` are absent in the cstPostTerminal process, in fact, they are discarded by the lexer,
    // in another word, the Parse has no information about those tokens,
    // we want to keep comments, so we don't mark them as `lex.SKIPPED`
    LA(howMuch: any) {
        // what happens here is to instruct the Parser(the base class that basically is a black box)
        //  that when it looks ahead for tokens(every kind of tokens), if it accidentally encounters Comment tokens,
        // it should simply walk past by calling `consumeToken`, which increase the token index. The original way `LA` behaves is to return whatever it sees.
        //
        //      consumeToken(this: MixedInParser) {
        //         this.currIdx++
        //      }
        //
        // Just pass by, don't do anything, but the "consumed" tokens are still there in the vector
        let t;
        while ((t = super.LA(howMuch)) &&
            (tokenMatcher(t, Comment) || tokenMatcher(t, WhiteSpace) || tokenMatcher(t, NewLine))) {
            super.consumeToken();
        }
        return super.LA(howMuch)
    }

    // Chevrotain source: packages/chevrotain/src/parse/parser/traits/tree_builder.ts:207
    //
    //      cstPostTerminal(
    //          this: MixedInParser,
    //          key: string,
    //          consumedToken: IToken
    //      ): void {
    //          const rootCst = this.CST_STACK[this.CST_STACK.length - 1]
    //          addTerminalToCst(rootCst, consumedToken, key)
    //          // This is only used when **both** error recovery and CST Output are enabled.
    //          this.setNodeLocationFromToken(rootCst.location!, <any>consumedToken)
    //      }
    //
    // The original `cstPostTerminal` is to add the terminal to CST, we twist it to add comments back to CST
    cstPostTerminal(key: any, consumedToken: any) {
        super.cstPostTerminal(key, consumedToken);
        // look behind for comments, the token stream looks like this:
        //
        //      token(space)comment(\n)
        //      comment(\n)comment(\n)token*(space)comment(\n)
        //
        // To correctly recognize the trailing comment, we don't mark anything as lex.SKIPPED,
        // let the parser decide which one to discard, the lexer's job is simply split the input into tokens
        // ------------
        // look for the trailing comment
        // the next position is reserved for traiing commnet
        // if it does not exist, use an Empty token instead
        //      {
        //        name: 'Empty',
        //        tokenTypeIdx: 12,
        //        CATEGORIES: [],
        //        categoryMatches: [],
        //        categoryMatchesMap: {},
        //        isParent: false
        //      }
        let lookAheadIdx = 1;
        let tokenAhead = super.LA(lookAheadIdx);
        while (tokenMatcher(tokenAhead, WhiteSpace)) {
            lookAheadIdx++;
            tokenAhead = super.LA(lookAheadIdx);
        }
        if (tokenMatcher(tokenAhead, Comment)) {
            super.cstPostTerminal(key, tokenAhead);
        } else {
            super.cstPostTerminal(key, Empty);
        }
        // look for comments before current token;
        let lookBehindIdx = -1;
        let prevToken = super.LA(lookBehindIdx);
        let prevComment;
        // state machine
        let lookingFor = 1; // 1 means comment, 2 means a regular token
        while (true) {
            if (tokenMatcher(prevToken, WhiteSpace)) {
                if (lookingFor === 2) {
                    // looking for a regular token, and encounter a whitespace, good, nothing to do here, go on
                } else if (lookingFor === 1) {
                    // else we are looking for a comment, it's still possible to encounter a whitespace
                }
            } else if (tokenMatcher(prevToken, NewLine)) {
                if (lookingFor === 2) {
                    // if we are looking for a regular token, but encounter a newline,
                    // then we should call off the action and look for another comment
                    lookingFor = 1;
                    // and consume the prevToken
                    super.cstPostTerminal(key, prevComment);
                } else {
                    // looking for a comment, it's ok to run into a newline
                }
                // then include the newlines to preserve format
                super.cstPostTerminal(key, prevToken);
            } else if (tokenMatcher(prevToken, Comment)) {
                if (lookingFor === 1) {
                    // stage the comment, don't consume it, wait until we are sure it's a stand alone comment
                    prevComment = prevToken;
                    lookingFor = 2;
                } else if (lookingFor === 2) {
                    // looking for regular tokes, but encounter a comment, we can safely consume the previous comment
                    super.cstPostTerminal(key, prevComment);
                    // looking for next comment
                    lookingFor = 1;
                }
            }
            // it's a regular token
            else {
                if (lookingFor === 2) {
                    // don't eat the previous comment
                    break;
                } else {
                    // we are looking for a comment, but encounter a regular token, that means there is no comment between these two tokens,
                    // then we should break
                    break;
                }
            }
            lookBehindIdx--;
            prevToken = super.LA(lookBehindIdx)
        }
    }
}

export const parser = new NginxConfigParser();
const lexer = new Lexer(allTokens);

export const production: Record<string, Rule> = parser.getGAstProductions();

export function parseNginxConfig(text: string) {
    const lexResult = lexer.tokenize(text);
    parser.input = lexResult.tokens;
    const cst = parser.node();
    return {
        cst,
        lexErrors: lexResult.errors,
        parseErrors: parser.errors
    }
}

const BaseCstVisitor = parser.getBaseCstVisitorConstructor();

export class Value {
    public value: string = "";
    public commentsBefore: string[] | null = [];
    public commentAfter: string | null = "";

    static from(src: string | any[]): Value {
        const v = new Value();
        v.value = src[0].image;
        v.commentAfter = src[1].name === 'Empty' ? null : src[1].image;
        const len = src.length;
        for (let i = 2; i < len; ++i) {
            v.commentsBefore!.push(src[i].image);
        }
        return v;
    }
}

export class Directive {
    public verb: Value = new Value();
    public parameters: Value[] = [];
    public semi: Value | null = null;
    public lCurly: Value | null = null;
    public subNode: Node | null = null;
    public rCurly: Value | null = null;
}

export class Node {
    public level: number = 0;
    public directives: Directive[] = [];
    public commentsBefore: string[] | null = null;
    public commentAfter: string | null = null;
}

class NginxConfigInterpreter extends BaseCstVisitor {
    level: number = 0;
    constructor() {
        super();
        this.validateVisitor();
    }
    node(ctx: any): Node {
        this.level++; // for nested nodes
        const node = new Node();
        node.level = this.level - 1;
        const directives: Directive[] = [];
        ctx.list.forEach((d: any) => {
            node.directives.push(this.visit(d));
        });
        this.level--;
        return node;
    }

    directive(ctx: any): Directive {
        const d = new Directive();
        d.verb = Value.from(ctx.verb[0].children.value);
        d.parameters = this.visit(ctx.parameters);
        if (ctx.semi) {
            d.semi = Value.from(ctx.semi)
        } else if (ctx.block) {
            const block = ctx.block[0].children;
            d.lCurly = Value.from(block.LCurly);
            d.rCurly = Value.from(block.RCurly);
            d.subNode = this.visit(block.list);
        }
        return d;
    }

    subNode(ctx: any): Node {
        return this.visit(ctx.list);
    }

    parameters(ctx: any): Value[] {
        if (!ctx.parameters) {
            return [];
        }
        const values: Value[] = [];
        ctx.parameters.forEach((element: any) => {
            const v = this.visit(element);
            values.push(v);
        });
        return values;
    }
    value(ctx: any): Value {
        return Value.from(ctx.value);
    }
}

const interpreter = new NginxConfigInterpreter();

export function interpret(text: string) {
    const lexResult = lexer.tokenize(text);
    parser.input = lexResult.tokens;
    const cst = parser.node();
    const root = interpreter.visit(cst);
    return {
        value: root,
        lexResult,
        parserErrors: parser.errors
    }
}
