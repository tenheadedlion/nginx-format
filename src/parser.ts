import { createToken, Lexer, CstParser, tokenMatcher, EOF, CstNode } from "chevrotain";

class FormulaError extends Error {
    public details: any;
    constructor(message: string, details: any) {
        super(message);
        this.details = details;
    }
}

class ParserError extends FormulaError { }

export function parse(entry: string): any {
    const commonWord = createToken({ name: "commonWord", pattern: /\w+/ });
    const keyword = createToken({ name: "keyword", pattern: /\*\*\w+\*\*/ });
    const punctuation = createToken({ name: "punctuation", pattern: /[.,?!'\";:-]/ });
    const whitespace = createToken({ name: "whitespace", pattern: /\s+/, group: Lexer.SKIPPED });
    const allTokens = [
        whitespace,
        commonWord,
        keyword,
        punctuation
    ];
    class ExcerptParser extends CstParser {
        constructor() {
            super(allTokens);
            this.performSelfAnalysis();
        }
        public excerpt = this.RULE("excerpt", () => {
            this.SUBRULE(this.wordList, { LABEL: "wordList" });
        }
        );

        private wordList = this.RULE("wordList", () => {
            this.MANY(() => this.SUBRULE(this.word, { LABEL: "list" }));
        });

        private word = this.RULE("word", () => {
            this.OR([
                { ALT: () => this.CONSUME(commonWord) },
                { ALT: () => this.CONSUME(keyword) },
                { ALT: () => this.CONSUME(punctuation) }
            ]);
        });
    };
    const parser = new ExcerptParser();
    const excerptVisitor = parser.getBaseCstVisitorConstructor();
    class ExceptInterpreter extends excerptVisitor {
        constructor() {
            super();
            this.validateVisitor();
        }
        excerpt(ctx: { wordList: CstNode | CstNode[]; }): any {
            return this.visit(ctx.wordList);
        }
        wordList(ctx: { list: any[]; }): any {
            let wordList: Array<string> = [];
            let keywords: Array<string> = [];
            ctx.list.forEach((word) => {
                let w = this.visit(word);
                wordList.push(w.image);
                if (tokenMatcher(w, keyword)) {
                    keywords.push(w.image);
                }
            });
            return [keywords, wordList];
        }

        word(ctx: { commonWord: any[]; keyword: any[]; punctuation: any[]; }): any {
            if (ctx.commonWord) {
                return ctx.commonWord[0];
            } else if (ctx.keyword) {
                return ctx.keyword[0];
            } else if (ctx.punctuation) {
                return ctx.punctuation[0];
            }
        }
    }
    const interpreter = new ExceptInterpreter();
    const lexer = new Lexer(allTokens);

    const lexingResult = lexer.tokenize(entry);
    parser.reset();
    parser.input = lexingResult.tokens;
    const cst = parser.excerpt();
    if (parser.errors.length > 0) {
        return undefined;
    }
    return interpreter.visit(cst);

}
