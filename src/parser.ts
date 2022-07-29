import { createToken, Lexer, CstParser, tokenMatcher, CstNode, Rule } from "chevrotain";

class FormulaError extends Error {
    public details: any;
    constructor(message: string, details: any) {
        super(message);
        this.details = details;
    }
}

class ParserError extends FormulaError { }
const LCurly = createToken({ name: "LCurly", pattern: /{/ });
const RCurly = createToken({ name: "RCurly", pattern: /}/ });
const Semicolon = createToken({ name: "Semicolon", pattern: /;/ });
const SingleQuote = createToken({ name: "single quote", pattern: "'" });
const DoubleQuote = createToken({ name: "double quote", pattern: /"/ });
const Comment = createToken({
    name: "Comment",
    pattern: /#[^\n\r]*/,
    group: Lexer.SKIPPED
});
const Literal = createToken({
    name: "Literal", pattern: /[^{};]+/
});

const WhiteSpace = createToken({
    name: "WhiteSpace",
    pattern: /[ \t]+/,
    group: Lexer.SKIPPED
});

const LineTerminator = createToken({
    name: "LineTerminator",
    pattern: /\n\r|\r|\n/,
    group: Lexer.SKIPPED
});

const allTokens = [
    WhiteSpace,
    LineTerminator,
    Comment,
    Semicolon,
    LCurly,
    RCurly,
    SingleQuote,
    DoubleQuote,
    Literal
]
class NginxConfigParser extends CstParser {
    constructor() {
        super(allTokens);
        this.performSelfAnalysis();
    }
    public config = this.RULE("config", () => {
        this.SUBRULE(this.directives, { LABEL: "directives" });
    }
    );
    private directives = this.RULE("directives", () => {
        this.MANY(() => this.SUBRULE(this.directive))
    });
    private directive = this.RULE("directive", () => {
        this.CONSUME(Literal);
        this.SUBRULE(this.parameters);
        this.OR(
            [
                { ALT: () => this.CONSUME(Semicolon) },
                { ALT: () => this.SUBRULE(this.set) }

            ])
    });
    private set = this.RULE("a set of directives", () => {
        this.CONSUME(LCurly);
        this.SUBRULE(this.directives);
        this.CONSUME(RCurly);
    });
    private parameters = this.RULE("parameters", () => {
        this.MANY(
            () => this.SUBRULE(this.value)
        )
    });
    private value = this.RULE("value", () => {
        this.OR(
            [
                { ALT: () => this.SUBRULE(this.SingleQuotedLiteral) },
                { ALT: () => this.SUBRULE(this.DoubleQuotedLiteral) },
                { ALT: () => this.CONSUME(Literal) },

            ]
        )
    });
    private SingleQuotedLiteral = this.RULE("single quoted Literal", () => {
        this.CONSUME(SingleQuote);
        this.CONSUME(Literal);
        this.CONSUME2(SingleQuote);
    });
    private DoubleQuotedLiteral = this.RULE("double quoted Literal", () => {
        this.CONSUME(DoubleQuote);
        this.CONSUME(Literal);
        this.CONSUME2(DoubleQuote);
    });
}

const parser = new NginxConfigParser();
const lexer = new Lexer(allTokens);

export const production: Record<string, Rule> = parser.getGAstProductions();

export function parseNginxConfig(text: string) {
    const lexResult = lexer.tokenize(text)
    parser.input = lexResult.tokens
    const cst = parser.config()
    return {
        cst,
        lexErrors: lexResult.errors,
        parseErrors: parser.errors
    }
}
