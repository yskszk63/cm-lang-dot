import { CompletionContext, CompletionResult, snippetCompletion as snip } from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { SyntaxNode, Tree } from "@lezer/common";
import a from "./attrs";

type UsedBy = "E" | "N" | "G" | "S" | "C"

class Attr {
  name: string;
  usedby: Set<UsedBy>;
  type: string;
  constructor(name: string, usedby: string, type: string) {
    this.name = name;
    this.usedby = new Set(Array.from(usedby, v => {
      switch (v) {
        case "E":
        case "N":
        case "G":
        case "S":
        case "C":
          return v;
        default:
          throw new Error(`invalid value ${v}`);
      }
    }));
    this.type = type;
  }
}

const attrs = a.map(([name, usedby, type]) => new Attr(name, usedby, type));
const gattrs = attrs.filter(a => a.usedby.has("G"));
const eattrs = attrs.filter(a => a.usedby.has("E"));
const nattrs = attrs.filter(a => a.usedby.has("N"));

function pos(cx: CompletionContext, near: SyntaxNode): number {
  switch (near.name) {
    case "Simpleid":
      return near.from;
    default:
      return cx.pos;
  }
}

function completeInAttrList(cx: CompletionContext, tree: Tree, near: SyntaxNode, current: SyntaxNode): CompletionResult {
  switch (current.parent?.name) {
    case "AttrStmt":
      switch (current.parent?.firstChild?.name) {
        case "edge":
          return {
            from: pos(cx, near),
            options: eattrs.map(({name}) => Object.assign({ label: name + " ", type: "keyword", })),
          };
        case "graph":
          return {
            from: pos(cx, near),
            options: gattrs.map(({name}) => Object.assign({ label: name + " ", type: "keyword", })),
          };
        case "node":
          return {
            from: pos(cx, near),
            options: nattrs.map(({name}) => Object.assign({ label: name + " ", type: "keyword", })),
          };
        default:
          return null;
      }
    case "NodeStmt":
      return {
        from: pos(cx, near),
        options: nattrs.map(({name}) => Object.assign({ label: name + " ", type: "keyword", })),
      };
    case "EdgeStmt":
      return {
        from: pos(cx, near),
        options: eattrs.map(({name}) => Object.assign({ label: name + " ", type: "keyword", })),
      };
  }
}

function completeInStmtList(cx: CompletionContext, tree: Tree, near: SyntaxNode, current: SyntaxNode): CompletionResult {
  return {
    from: pos(cx, near),
    options: [
      snip("node[${attr} = ${val}]", { label: "node", type: "keyword" }),
      snip("graph[${attr} = ${val}]", { label: "graph", type: "keyword" }),
      snip("edge[${attr} = ${val}]", { label: "edge", type: "keyword" }),
      snip("subgraph ${name} {\n\t${}\n}", { label: "subgraph", type: "keyword" }),
    ].concat(gattrs.map(({name}) => Object.assign({ label: name + " ", type: "keyword", }))),
  };
}

function completeInGraph(cx: CompletionContext, tree: Tree, near: SyntaxNode, current: SyntaxNode): CompletionResult {
  const cursor = near.cursor;
  let foundGraph = false;
  let foundStrict = false;
  while (cursor.prev()) {
    switch (cursor.node.name) {
      case "graph":
      case "digraph":
        foundGraph = true;
        break;
      case "strict":
        foundStrict = true;
        break;
    }
  }

  if (foundGraph) {
    return null;
  }
  return {
    from: pos(cx, near),
    options: foundStrict ? [
      snip("digraph ${name} {\n\t${}\n}", { label: "digraph", type: "keyword" }),
      snip("graph ${name} {\n\t${}\n}", { label: "graph", type: "keyword" }),
    ] : [
      snip("digraph ${name} {\n\t${}\n}", { label: "digraph", type: "keyword" }),
      snip("graph ${name} {\n\t${}\n}", { label: "graph", type: "keyword" }),
      { label: "strict ", type: "keyword" },
    ],
  };
}

export function complete(cx: CompletionContext): CompletionResult | null {
  const tree = syntaxTree(cx.state);
  const near = tree.resolveInner(cx.pos, -1);

  const stack = [];
  for (let node = near; node; node = node.parent) {
    stack.push(node.name);
  }
  console.log(stack.join("/"));

  for (let node = near; node; node = node.parent) {
    switch (node.name) {
      case "graph":
      case "digraph":
      case "strict":
      case "subgraph":
      case "LineComment":
      case "SharpComment":
      case "BlockComment":
      case "{":
        return null;

      case "AttrList":
        return completeInAttrList(cx, tree, near, node);

      case "StmtList":
        return completeInStmtList(cx, tree, near, node);

      case "AttrList":
        return null;

      case "Graph":
        return completeInGraph(cx, tree, near, node);
    }
  }

  return null;
}
