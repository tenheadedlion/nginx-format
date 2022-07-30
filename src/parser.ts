import { createToken as orgCreateToken, Lexer, CstParser, tokenMatcher, CstNode, Rule, ITokenConfig, ParserMethod, TokenType, createSyntaxDiagramsCode } from "chevrotain";

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
    group: Lexer.SKIPPED
});

const NewLine = createToken({
    name: "LineTerminator",
    pattern: /\n\r|\r|\n/,
    group: Lexer.SKIPPED
});

const allTokens = [
    // always place the spaces above, because there are some pattens that consume spaces.
    NewLine,
    // even whitespace is the last one to match,
    // it's missing from the token stream if we use cstPostTerminal
    //  to look ahead for it,
    // because the lexer won't know it's a whitespace,
    //  if the lexer hasn't tokenize the input stream,
    // if the lexer has done that, whitespace is skipped by the attribute `group: Lexer.SKIPPED`
    // therefore, any function that manipulates the terminal will not see the whole input tokens
    // if there are tokens marked as SKIPPED
    WhiteSpace,
    Comment,
    Semicolon,
    LCurly,
    RCurly,
    SingleQuotedLiteral,
    DoubleQuoteLiteral,
    Literal,
]

// comments can't be discarded(marked as LEXER.SKIPPED), they must be treated as tokens.
// a comment either occupies one entire line, or appears at the end of the line
// a token other than comment is surrounded by comments in the following format:
//
//      # multiple lined comments
//      token # comment
//
// it's easy to get comments before a token, but not so to get the comment after a token,
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
        //this.MANY(() => this.CONSUME(Comment, { LABEL: "commentsBefore" }));
        this.OR(
            [
                {
                    ALT: () => {
                        this.CONSUME(Semicolon, { LABEL: "semi" });
                    }
                },
                { ALT: () => this.SUBRULE(this.subNode, { LABEL: "block" }) }

            ])
        //this.OPTION(() => this.CONSUME2(Comment, { LABEL: "commentAfter" }));
    });
    private subNode = this.RULE("subNode", () => {
        this.CONSUME(LCurly);
        this.SUBRULE(this.node, { LABEL: "list" });
        this.CONSUME(RCurly);
    });
    private parameters = this.RULE("parameters", () => {
        this.MANY(
            () => this.SUBRULE(this.value, { LABEL: "paramters" })
        )
    });
    private value = this.RULE("value", () => {
        this.OR([
            { ALT: () => { this.CONSUME(SingleQuotedLiteral, { LABEL: "value" }); } },
            { ALT: () => { this.CONSUME(DoubleQuoteLiteral, { LABEL: "value" }); } },
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
    LA(howMuch) {
        // what happens here is to instruct the Parser(the base class that basically is a black box)
        //  that when it looks ahead for tokens(every kind of tokens), if it accidentally encounters Comment tokens,
        // it should simply walk past by calling `consumeToken`, which increase the token index. The original way `LA` behaves is to return whatever it sees.
        //
        //      consumeToken(this: MixedInParser) {
        //         this.currIdx++
        //      }
        //
        // Just pass by, don't do anything, but the "consumed" tokens are still there in the vector
        while (tokenMatcher(super.LA(howMuch), Comment)) {
            super.consumeToken();
        }
        //if (tokenMatcher(super.LA(howMuch), WhiteSpace)) {
        //    console.log("Found a WhiteSpace!");
        //}
        return super.LA(howMuch)
    }
    // the code is copied from Chevrotain, with the following twists:
    //  - 
    cstPostTerminal(key, consumedToken) {
        super.cstPostTerminal(key, consumedToken);

        // look behind for comments, the token stream looks like this:
        //
        //      comment(\n)comment(\n)comment(\n)token*(space)comment(\n)
        //
        // but our goal is not only to look behind, but also to look ahead, problem is how to determind if a comment ahead is attached to that token.
        //      (meaning they are in the same line)
        //
        // the solution is this: don't mark space as SKIPPED

        //let lookBehindIdx = -1;
        //let prevToken = super.LA(lookBehindIdx);
        //
        //// After every Token (terminal) is successfully consumed
        //// We will add all the comment that appeared before it to the CST (Parse Tree)
        //while (tokenMatcher(prevToken, Comment)) {
        //    super.cstPostTerminal(Comment.name, prevToken)
        //    lookBehindIdx--
        //    prevToken = super.LA(lookBehindIdx)
        //}
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

class Value {
    public value: string = "";
    public commentsBefore: string[] | null = [];
    public commentAfter: string | null = "";
}

class Directive {
    public verb: Value = new Value();
    public parameters: Value[] = [];
    public semi: Value | null = null;
    public subNode: Node | null = null;
}

class Node {
    public level: number = 0;
    public directives: Directive[] = [];
    public commentsBefore: string[] | null = null;
    public commentAfter: string | null = null;
}

class NginxConfigInterpreter extends BaseCstVisitor {
    constructor() {
        super();
        this.validateVisitor();
    }
    node(ctx: { list: (CstNode | CstNode[])[]; }): Node {
        const node = new Node();
        const directives: Directive[] = [];
        ctx.list.forEach((d: CstNode | CstNode[]) => {
            node.directives.push(this.visit(d));
        });
        return node;
    }

    directive(ctx: any): Directive {
        const directive = new Directive();
        directive.verb = ctx.verb;
        directive.parameters = ctx.parameters;
        if (ctx.commentAfter) {
            //console.log(ctx.commentAfter);
        }
        const comments = this.getCommands(ctx);
        if (ctx.semi) {
            const v = new Value();
            v.value = ";";
            v.commentAfter = comments[1];
            v.commentsBefore = comments[0];
            directive.semi = v;
            return directive;
        } else {
            const n: Node = this.visit(ctx.block);
            n.commentAfter = comments[1];
            n.commentsBefore = comments[0];
            directive.subNode = n;
            return directive;
        }
    }

    subNode(ctx: { list: CstNode | CstNode[]; }): Node {
        return this.visit(ctx.list);
    }

    parameters(ctx: { paramters: (CstNode | CstNode[])[]; }): Value[] {
        const values: Value[] = [];
        ctx.paramters.forEach((element: CstNode | CstNode[]) => {
            const v = this.visit(element);
            values.push(v);
        });
        return values;
    }
    value(ctx: { commentsBefore: any[]; commentAfter: { image: string; }; }): Value {
        const v = new Value();
        const comments = this.getCommands(ctx);
        if (ctx.commentsBefore) {
            console.log(ctx.commentsBefore);
        }
        v.commentAfter = comments[1];
        v.commentsBefore = comments[0];
        return v;
    }

    getCommands(ctx: { commentsBefore: any; commentAfter: any; }): [string[] | null, string | null] {
        let before: string[] | null, after: string | null;
        if (ctx.commentsBefore) {
            console.log(ctx.commentsBefore);
            const arr: string[] = [];
            ctx.commentsBefore.forEach((element: { image: string; }) => {
                console.log(element);
                arr.push(element.image);
            });
            before = arr;
        } else {
            before = null;
        }
        if (ctx.commentAfter) {
            after = ctx.commentAfter[0].image.trim();
        } else {
            after = null;
        }
        if (ctx.commentAfter) {
            console.log(after);
        }
        return [before, after];
    }
}

const interpreter = new NginxConfigInterpreter();

export function interpret(text: string) {
    const lexResult = lexer.tokenize(text);
    parser.input = lexResult.tokens;
    const cst = parser.node();
    const node = interpreter.visit(cst);
    return {
        value: node,
        lexResult,
        parserErrors: parser.errors
    }
}
