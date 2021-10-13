import { buildParser } from "@lezer/generator";
import { fileTests } from "@lezer/generator/dist/test";

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const grammer = await fs.readFile(fileURLToPath(new URL("../src/dot.grammar", import.meta.url)), {encoding: "utf8"});
const parser = buildParser(grammer);
const casedir = path.dirname(fileURLToPath(import.meta.url));

for (const file of (await fs.readdir(casedir)).filter(f => /\.txt/.test(f))) {
    const [name] = /^[^\.]*/.exec(file);
    const content = await fs.readFile(path.join(casedir, file), { encoding: "utf8" });
    describe(name, () => {
        for (const { name, run } of fileTests(content, file)) {
            it(name, run.bind(null, parser));
        }
    });
}
