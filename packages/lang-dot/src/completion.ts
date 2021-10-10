import { CompletionContext, CompletionResult, snippetCompletion as snip } from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { SyntaxNode, Tree } from "@lezer/common";
import a from "./attrs";
import * as t from "./types";

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
const attrbyname = new Map(attrs.map(a => [a.name, a]));

function pos(cx: CompletionContext, near: SyntaxNode): number {
  switch (near.name) {
    case "Simpleid":
      return near.from;
    case "Quoted":
      return near.from;
    default:
      return cx.pos;
  }
}

function completeAttrName(cx: CompletionContext, near: SyntaxNode, node: SyntaxNode): CompletionResult {
  while ((node = node.parent) !== null) {
    switch (node.name) {
      case "AttrStmt":
        switch (node.firstChild?.name) {
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
}

function completeByType(cx: CompletionContext, near: SyntaxNode, type: string): CompletionResult {
  switch (type) {
    case "arrowType":
      return {
        from: pos(cx, near),
        options: t.arrowtype.map(label => Object.assign({ label, type: "keyword", })),
      };
    case "bool":
      return {
        from: pos(cx, near),
        options: ["true", "false"].map(label => Object.assign({ label, type: "keyword", })),
      };
    case "clusterMode":
      return {
        from: pos(cx, near),
        options: ['"local"', '"global"', '"none"'].map(label => Object.assign({ label, type: "keyword", })),
      };
    case "dirType":
      return {
        from: pos(cx, near),
        options: ['"forward"', '"back"', '"both"', '"none"'].map(label => Object.assign({ label, type: "keyword", })),
      }
    case "portPos":
      return {
        from: pos(cx, near),
        options: ["n","ne","e","se","s","sw","w","nw","c","_"].map(label => Object.assign({ label, type: "keyword", })),
      }
    case "outputMode":
      return {
        from: pos(cx, near),
        options: ['"breadthfirst"', '"nodesfirst"', '"edgesfirst"'].map(label => Object.assign({ label, type: "keyword", })),
      }
    case "packMode":
      return {
        from: pos(cx, near),
        options: ['"node"', '"clust"', '"graph"'].map(label => Object.assign({ label, type: "keyword", })).concat([
          snip("array${_flags}${%d}", { label: "array", type: "keyword" }),
        ]),
      }
    case "pagedir":
      return {
        from: pos(cx, near),
        options: t.pagedir.map(label => Object.assign({ label, type: "keyword", })),
      }
    case "rankType":
      return {
        from: pos(cx, near),
        options: ['"same"', '"min"', '"source"', '"max"', '"sink"'].map(label => Object.assign({ label, type: "keyword", })),
      }
    case "rankdir":
      return {
        from: pos(cx, near),
        options: ['"TR"', '"LR"', '"BT"', '"RL"'].map(label => Object.assign({ label, type: "keyword", })),
      }
    case "shape":
      return {
        from: pos(cx, near),
        options: t.shape.map(label => Object.assign({ label, type: "keyword", })),
      }
    case "smoothType":
      return {
        from: pos(cx, near),
        options: t.smoothtype.map(label => Object.assign({ label, type: "keyword", })),
      }
    case "style":
      // TODO contextual
      return {
        from: pos(cx, near),
        options: t.style.map(label => Object.assign({ label, type: "keyword", })),
      }
    default:
      return null;
  }
}

function completeAttrVal(cx: CompletionContext, near: SyntaxNode): CompletionResult {
  const cursor = near.cursor;
  while (true) {
    if (!cursor.prev()) {
      return null;
    }
    if (cursor.name === "=") {
      break;
    }
  }
  while (cursor.prev()) {
    switch (cursor.node.name) {
      case "Simpleid": {
        const { from, to } = cursor.node;
        const name = cx.state.sliceDoc(from, to);
        const attr = attrbyname.get(name);
        if (attr) {
          return completeByType(cx, near, attr.type);
        }
      }
      case "Quoted":
      case "Htmlstr":
        // Not supported.
        return null;
    }
  }
  return null;
}

function completeInAttrList(cx: CompletionContext, tree: Tree, near: SyntaxNode, current: SyntaxNode): CompletionResult {
  const cursor = near.cursor;
  do {
    switch (cursor.node.name) {
      case "Simpleid":
      case "Quoted":
      case "Numeral":
      case "Htmlstr":
        if (cursor.node !== near) {
          return completeAttrName(cx, near, current);
        }
        break;
      case "[":
        return completeAttrName(cx, near, current);
      case "=":
        return completeAttrVal(cx, near);
    }
  } while (cursor.prev());

  return null;
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
  console.log("###", tree.resolve(cx.pos, -1)?.name, tree.resolve(cx.pos, 0)?.name, tree.resolve(cx.pos, 1)?.name);
  console.log("###", tree.resolveInner(cx.pos, -1)?.name, tree.resolveInner(cx.pos, 0)?.name, tree.resolveInner(cx.pos, 1)?.name);
  console.log(cx.matchBefore(/ */).from, cx.pos);

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
