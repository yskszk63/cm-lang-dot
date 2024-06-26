import {parser} from "lezer-dot"
import {LRLanguage, LanguageSupport, indentNodeProp} from "@codemirror/language"
import {styleTags, tags as t} from "@lezer/highlight";
import {complete} from "./completion";

export const dotLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        StmtList: cx => cx.baseIndent + cx.unit,
      }),
      styleTags({
        "graph digraph node edge strict subgraph": t.keyword,
        Quoted: t.string,
        Numeral: t.number,
        ID: t.variableName,
        "edgeop =": t.operator,
        "[ ]": t.squareBracket,
        "{ }": t.brace,
        ", ;": t.separator,
        "LineComment SharpComment": t.lineComment,
        BlockComment: t.blockComment,
      }),
    ],
  }),
  languageData: {
    closeBrackets: {brackets: ["[", "{", '"']},
    commentTokens: {line: "//", block: {open: "/*", close: "*/"}},
    indentOnInput: /^\s*(?:\{|\})$/,
  },
});

export type DotConfig = {
  debug?: true,
}

export function dot(config: DotConfig = {}) {
  return new LanguageSupport(dotLanguage, dotLanguage.data.of({
    autocomplete:  complete.bind(null, (config.debug ?? false)),
  }));
}
