import { CompletionContext, CompletionResult, Completion } from "@codemirror/autocomplete";
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
      type: "property",
      detail: this.type,
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

function result(cx: CompletionContext, near: SyntaxNode, options: Completion[]): CompletionResult {
  return {
    from: pos(cx, near),
    options,
    span: /\w*$/, // TODO quoted token
  }
}

function completeAttrName(cx: CompletionContext, near: SyntaxNode, node: SyntaxNode): CompletionResult {
  while ((node = node.parent) !== null) {
    switch (node.name) {
      case "AttrStmt":
        switch (node.firstChild?.name) {
          case "edge":
            return result(cx, near, eattrs);
          case "graph":
            return result(cx, near, gattrs);
          case "node":
            return result(cx, near, nattrs);
          default:
            return null;
        }
      case "NodeStmt":
        return result(cx, near, nattrs);
      case "EdgeStmt":
        return result(cx, near, eattrs);
    }
  }
}

function completeByType(cx: CompletionContext, near: SyntaxNode, type: string): CompletionResult {
  function r(labels: string[]): CompletionResult {
    return result(cx, near, labels.map(label => Object.assign({ label, type: "text" })));
  }

  switch (type) {
    case "arrowType":
      return r(t.arrowtype);
    case "bool":
      return r(["true", "false"]);
    case "clusterMode":
      return r(['"local"', '"global"', '"none"']);
    case "dirType":
      return r(['"forward"', '"back"', '"both"', '"none"']);
    case "portPos":
      return r(["n","ne","e","se","s","sw","w","nw","c","_"]);
    case "outputMode":
      return r(['"breadthfirst"', '"nodesfirst"', '"edgesfirst"']);
    case "packMode":
      return r(['"node"', '"clust"', '"graph"', '"array"']); // FIXME array variant
    case "pagedir":
      return r(t.pagedir);
    case "rankType":
      return r(['"same"', '"min"', '"source"', '"max"', '"sink"']);
    case "rankdir":
      return r(['"TR"', '"LR"', '"BT"', '"RL"']);
    case "shape":
      return r(t.shape);
    case "smoothType":
      return r(t.smoothtype);
    case "style":
      // TODO contextual
      return r(t.style);
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
        break;
      }
      case "Quoted":
      case "Htmlstr":
        // Not supported.
        return null;
    }
  }
  return null;
}

function completeEdgeop(cx: CompletionContext, tree: Tree, near: SyntaxNode): CompletionResult {
  const cursor = tree.cursor();
  while (cursor.next()) {
    switch (cursor.node.name) {
    case "graph":
      return result(cx, near, [{ label: "-" }]);
    case "digraph":
      return result(cx, near, [{ label: ">" }]);
    }
  }
}

function completeNodeIds(cx: CompletionContext, tree: Tree): Completion[] {
  const ids = []
  for (const cursor = tree.cursor(); cursor.next();) {
    if (cursor.node.name === 'NodeId') {
      const { from, to } = cursor.node;
      if (!(from <= cx.pos && to >= cx.pos)) {
        const id = cx.state.doc.sliceString(from, to);
        ids.push({
          label: id,
          type: "variable",
          boost: 1,
        });
      }
    }
  }
  return ids;

}

function completeInAttrList(cx: CompletionContext, near: SyntaxNode, current: SyntaxNode): CompletionResult {
  if (near.name === "=") {
    return completeAttrVal(cx, near);
  }

  return completeAttrName(cx, near, current);
}

function completeInNodeId(cx: CompletionContext, tree: Tree, near: SyntaxNode): CompletionResult {
  const ids = completeNodeIds(cx, tree);
  return result(cx, near, ids);
}

function completeInEdgeStmt(cx: CompletionContext, tree: Tree, near: SyntaxNode): CompletionResult {
  if (near.name !== "edgeop") {
    return null;
  }

  const ids = completeNodeIds(cx, tree);
  return result(cx, near, ids);
}

function completeInProp(cx: CompletionContext, near: SyntaxNode): CompletionResult {
  if (near.name === "=") {
    return completeAttrVal(cx, near);
  }

  return null;
}

function completeInStmtList(cx: CompletionContext, tree: Tree, near: SyntaxNode): CompletionResult {
  const ids = completeNodeIds(cx, tree);
  // completion keyword and property name explicit only.
  if (cx.explicit) {
    const options = ids.concat([
      { label: "node", type: "keyword" },
      { label: "graph", type: "keyword" },
      { label: "edge", type: "keyword" },
      { label: "subgraph", type: "keyword" },
    ]).concat(gattrs);
    return result(cx, near, options);
  } else {
    return result(cx, near, ids);
  }
}

function completeInGraph(cx: CompletionContext, near: SyntaxNode): CompletionResult {
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

  return result(cx, near, foundStrict ? [
    { label: "digraph", type: "keyword" },
    { label: "graph", type: "keyword" },
  ] : [
    { label: "digraph", type: "keyword" },
    { label: "graph", type: "keyword" },
    { label: "strict", type: "keyword", boost: -1 },
  ]);
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

export function complete(debug: boolean, cx: CompletionContext): CompletionResult | null {
  const tree = syntaxTree(cx.state);
  const near = nearNode(cx, tree);

  if (debug) {
    (() => {
      const stack = [];
      for (let node = near; node; node = node.parent) {
        stack.push(node.name);
      }
      console.log(stack.join("/"));
    })();
  }

  for (let node = near; node; node = node.parent) {
    switch (node.name) {
      case "graph":
      case "digraph":
      case "strict":
      case "subgraph":
      case "LineComment":
      case "SharpComment":
      case "BlockComment":
        return null;

      case "{":
      case ";":
        if (cx.pos === near.to && !cx.explicit) {
          // without space. ignore completion.
          // graph {│}
          return null;
        }
        break;

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
          return completeInNodeId(cx, tree, near);
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
        return completeInProp(cx, near);

      case "AttrList":
        // graph { graph[│] } .. [/**AttrList**/AttrStmt/StmtList/Graph
        // graph { graph[r│] } .. Simpleid/ID/AttrName/Attr/**AttrList**/AttrStmt/StmtList/Graph
        // graph { graph[rankdir =│] } .. =/Attr/**AttrList**/AttrStmt/StmtList/Graph TODO
        return completeInAttrList(cx, near, node);

      case "EdgeStmt":
        // x graph { l│ } .. Simpleid/ID/**NodeId**/NodeStmt/StmtList/Graph
        // x graph { l -│ } .. ⚠/NodeId/NodeStmt/**StmtList**/Graph
        // o graph { l --│ } .. edgeop/**EdgeStmt**/StmtList/Graph
        // x graph { l -- r│ } Simpleid/ID/**NodeId**/EdgeStmt/StmtList/Graph
        return completeInEdgeStmt(cx, tree, near);

      case "StmtList":
        if (cx.pos === near.to && cx.state.sliceDoc(near.from, near.to) === "-") {
          // graph { a - } .. ⚠/NodeId/NodeStmt/**StmtList**/Graph
          return completeEdgeop(cx, tree, near);
        }
        // graph { │ } .. {/**StmtList**/Graph
        // graph { n│ } .. Simpleid/ID/NodeId/NodeStmt/**StmtList**/Graph
        return completeInStmtList(cx, tree, near);

      case "Graph":
        // │ .. Graph
        return completeInGraph(cx, near);
    }
  }

  return null;
}
