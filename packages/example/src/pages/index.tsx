import {useEffect, useRef} from "react";
import Head from 'next/head';
import {EditorState, EditorView, basicSetup} from "@codemirror/basic-setup";
import {dot} from "lang-dot";

export default function Home() {
  const div = useRef(null);
  useEffect(() => {
    if (!div.current) {
      throw new Error();
    }
    const state = EditorState.create({
      extensions: [
        basicSetup,
        dot(),
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
