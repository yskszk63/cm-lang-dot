import {parser} from "lezer-dot"
import {LRLanguage, LanguageSupport, indentNodeProp} from "@codemirror/language"
import {styleTags, tags as t} from "@codemirror/highlight"

export const dotLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        "graph Subgraph": cx => cx.baseIndent + cx.unit,
      }),
      styleTags({
        "graph digraph node edge strict subgraph": t.keyword,
        ID: t.variableName,
        "[ ]": t.squareBracket,
        "{ }": t.brace,
        ", ;": t.separator,
      }),
    ],
  }),
  languageData: {
    closeBrackets: {brackets: ["[", "{", '"']},
    commentTokens: {line: "//", block: {open: "/*", close: "*/"}},
    indentOnInput: /^\s*(?:\{|\})$/,
  },
});

export function dot(_config: unknown = {}) {
  return new LanguageSupport(dotLanguage, dotLanguage.data.of({ }));
}
