import {useEffect, useRef} from "react";
import Head from 'next/head';
import { basicSetup} from "codemirror";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {dot} from "cm-lang-dot";

export default function Home() {
  const div = useRef(null);
  useEffect(() => {
    if (!div.current) {
      throw new Error();
    }
    const state = EditorState.create({
      extensions: [
        basicSetup,
        dot({debug: true}),
      ],
    });
    const view = new EditorView({
      state,
      parent: div.current,
    });
    view.focus();
    return () => view.destroy();
  }, [div]);

  return (
    <div>
      <Head>
        <title>cm-lang-dot example</title>
        <meta name="description" content="cm-lang-dot example" />
        <link rel="icon"
              href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text x=%2250%%22 y=%2250%%22 style=%22dominant-baseline:central;text-anchor:middle;font-size:90px;%22>🙋</text></svg>"
        />
      </Head>

      <main>
        <div ref={div}/>
      </main>
    </div>
  )
}
