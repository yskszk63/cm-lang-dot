import { CompletionContext, CompletionResult, snippetCompletion as snip } from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { SyntaxNode, Tree } from "@lezer/common";

function pos(cx: CompletionContext, near: SyntaxNode): number {
  switch (near.name) {
    case "Simpleid":
      return near.from;
    default:
      return cx.pos;
  }
}

function completeInStmtList(cx: CompletionContext, tree: Tree, near: SyntaxNode): CompletionResult {
  return {
    from: pos(cx, near),
    options: [
      snip("node[${attr} = ${val}]", { label: "node", type: "keyword" }),
      snip("graph[${attr} = ${val}]", { label: "graph", type: "keyword" }),
      snip("edge[${attr} = ${val}]", { label: "edge", type: "keyword" }),
      snip("subgraph ${name} {\n\t${}\n}", { label: "subgraph", type: "keyword" }),
    ],
  };
}

function completeInGraph(cx: CompletionContext, tree: Tree, near: SyntaxNode): CompletionResult {
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

      case "StmtList":
        return completeInStmtList(cx, tree, near);

      case "AttrList":
        return null;

      case "Graph":
        return completeInGraph(cx, tree, near);
    }
  }

  return null;
}
