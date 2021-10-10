const nodesedges = [
    '"dashed"',
    '"dotted"',
    '"solid"',
    '"invis"',
    '"bold"',
] as string[];

const edges = [
    '"tapered"',
] as string[];

const nodes = [
    '"filled"',
    '"striped"',
    '"wedged"',
    '"diagonals"',
    '"rounded"',
] as string[];

const clusters = [
    '"filled"',
    '"striped"',
    '"rounded"',
] as string[];

export default nodesedges.concat(edges).concat(nodes).concat(clusters);
