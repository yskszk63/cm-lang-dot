import { parser } from "lezer-dot";
import { fileTests } from "@lezer/generator/dist/test";

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const casedir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'gv-gallery');

for (const file of (await fs.readdir(casedir)).filter(f => /(?<!\.gv)\.txt/.test(f))) {
    const [name] = /^[^\.]*/.exec(file);
    const content = await fs.readFile(path.join(casedir, file), { encoding: "utf8" });
    describe(name, () => {
        for (const { name, run } of fileTests(content, file)) {
            it(name, run.bind(null, parser));
        }
    });
}
