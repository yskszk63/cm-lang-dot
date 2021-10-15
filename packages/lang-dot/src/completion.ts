import { CompletionContext, CompletionResult, Completion, snippetCompletion as snip } from "@codemirror/autocomplete";
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

  intoCompletion(): Completion {
    return {
      label: this.name,
      type: "keyword",
    }
  }
}

const attrs = a.map(([name, usedby, type]) => new Attr(name, usedby, type));
const gattrs = attrs.filter(a => a.usedby.has("G")).map(a => a.intoCompletion());
const eattrs = attrs.filter(a => a.usedby.has("E")).map(a => a.intoCompletion());
const nattrs = attrs.filter(a => a.usedby.has("N")).map(a => a.intoCompletion());
const attrbyname = new Map(attrs.map(a => [a.name, a]));

function pos(cx: CompletionContext, near: SyntaxNode): number {
  if (cx.pos !== near.to) {
    return cx.pos;
  }

  switch (near.name) {
    case "Simpleid":
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
              options: eattrs,
            };
          case "graph":
            return {
              from: pos(cx, near),
              options: gattrs,
            };
          case "node":
            return {
              from: pos(cx, near),
              options: nattrs,
            };
          default:
            return null;
        }
      case "NodeStmt":
        return {
          from: pos(cx, near),
          options: nattrs,
        };
      case "EdgeStmt":
        return {
          from: pos(cx, near),
          options: eattrs,
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
    if (cursor.name === "=") {
      break;
    }
    if (!cursor.prev()) {
      return null;
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
  if (near.name === "=") {
    return completeAttrVal(cx, near);
  }

  return completeAttrName(cx, near, current);
}

function completeInNodeId(cx: CompletionContext, tree: Tree, near: SyntaxNode, current: SyntaxNode): CompletionResult {
  const ids = []
  for (let cursor = tree.cursor();cursor.next();) {
    if (cursor.node.name === 'NodeId') {
      const { from, to } = cursor.node;
      if (!(from <= cx.pos && to >= cx.pos)) {
        const id = cx.state.doc.sliceString(from, to);
        ids.push({
          label: id,
          type: "variable",
        });
      }
    }
  }

  return {
    from: pos(cx, near),
    options: ids,
  };
}

function completeInEdgeStmt(cx: CompletionContext, tree: Tree, near: SyntaxNode, current: SyntaxNode): CompletionResult {
  if (near.name !== "edgeop") {
    return null;
  }

  const ids = []
  for (let cursor = tree.cursor();cursor.next();) {
    if (cursor.node.name === 'NodeId') {
      const { from, to } = cursor.node;
      if (!(from <= cx.pos && to >= cx.pos)) {
        const id = cx.state.doc.sliceString(from, to);
        ids.push({
          label: id,
          type: "variable",
        });
      }
    }
  }

  return {
    from: pos(cx, near),
    options: ids,
  };
}

function completeInProp(cx: CompletionContext, tree: Tree, near: SyntaxNode, current: SyntaxNode): CompletionResult {
  if (near.name === "=") {
    return completeAttrVal(cx, near);
  }

  return null;
}

function completeInStmtList(cx: CompletionContext, tree: Tree, near: SyntaxNode, current: SyntaxNode): CompletionResult {
  const ids = []
  for (let cursor = tree.cursor();cursor.next();) {
    if (cursor.node.name === 'NodeId') {
      const { from, to } = cursor.node;
      if (!(from <= cx.pos && to >= cx.pos)) {
        const id = cx.state.doc.sliceString(from, to);
        ids.push({
          label: id,
          type: "variable",
        });
      }
    }
  }

  return {
    from: pos(cx, near),
    options: ids.concat([
      snip("node[${attr} = ${val}]", { label: "node", type: "keyword" }),
      snip("graph[${attr} = ${val}]", { label: "graph", type: "keyword" }),
      snip("edge[${attr} = ${val}]", { label: "edge", type: "keyword" }),
      snip("subgraph ${name} {\n\t${}\n}", { label: "subgraph", type: "keyword" }),
    ]).concat(gattrs),
  };
}

function completeInGraph(cx: CompletionContext, tree: Tree, near: SyntaxNode, current: SyntaxNode): CompletionResult {
  const cursor = near.cursor;
  let foundStrict = false;
  while (cursor.prev()) {
    switch (cursor.node.name) {
      case "graph":
      case "digraph":
        return null;
      case "strict":
        foundStrict = true;
        break;
    }
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

/*
 * resolve node
 *
 * ```
 * graph { a[label = │] }
 *                   ^-- cursor
 *                 ^---- resolve
 * ```
 */
function nearNode(cx: CompletionContext, tree: Tree): SyntaxNode {
  //const comment = ["LineComment", "SharpComment", "BlockComment"];
  const skipToken = /[ \t\r\n]*/;

  const pos = cx.matchBefore(skipToken).from;
  const node = tree.resolveInner(pos, -1);
  // FIXME skip comments
  return node;
}

export function complete(cx: CompletionContext): CompletionResult | null {
  const tree = syntaxTree(cx.state);
  const near = nearNode(cx, tree);

  (() => {
    const stack = [];
    for (let node = near; node; node = node.parent) {
      stack.push(node.name);
    }
    console.log(stack.join("/"));
  })();

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

      case "AttrVal":
        if (cx.pos === near.to) {
          // without space.
          // graph { a[shape = b│] }
          //                    ^-- cursor
          //                   ^--- completion target
          return completeAttrVal(cx, near);
        }
        // skip this case.
        // graph { a[shape = b │] }
        //                     ^-- cursor
        //                    ^--- space
        break;

      case "NodeId":
        if (cx.pos === node.to && node.parent?.name !== "NodeStmt") {
          // without space.
          // graph { aaa; aaa -- a│}
          //                      ^-- cursor
          //                     ^--- completion target
          return completeInNodeId(cx, tree, near, node);
        }
        // skip this case.
        // graph { aaa; aaa -- a │}
        //                       ^-- cursor
        //                      ^--- space
        //
        // skip because ambiguity.
        // graph { rrr; r│ } .. maybe enter `rankdir = ..`
        break;

      case "Prop":
        // o `graph { rankdir = │ }` .. =/**Prop**/StmtList/Graph
        // x `graph { r│ }` .. Simpleid/ID/**NodeId**/NodeStmt/StmtList/Graph
        // x `graph { rankdir = L│ }` .. Simpleid/ID/**AttrVal**/Prop/StmtList/Graph
        return completeInProp(cx, tree, near, node);

      case "AttrList":
        return completeInAttrList(cx, tree, near, node);

      case "EdgeStmt":
        return completeInEdgeStmt(cx, tree, near, node);

      case "StmtList":
        return completeInStmtList(cx, tree, near, node);

      case "Graph":
        return completeInGraph(cx, tree, near, node);
    }
  }

  return null;
}
