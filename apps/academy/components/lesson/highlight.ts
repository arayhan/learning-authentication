import { codeToHtml } from "shiki";

/** Dual-theme HTML (colours as --shiki-light/--shiki-dark vars, switched by `.dark` in globals.css). Lines carry data-line; noted lines get a numbered marker. */
export function highlight(code: string, lang: string, startLine: number, noted: Map<number, number>) {
  return codeToHtml(code, {
    lang,
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
    transformers: [
      {
        line(node, line) {
          const n = line + startLine - 1;
          node.properties["data-line"] = n;
          const marker = noted.get(n);
          if (marker) {
            node.children.push({
              type: "element",
              tagName: "span",
              properties: { class: "code-note", "aria-hidden": "true" },
              children: [{ type: "text", value: String(marker) }],
            });
          }
        },
      },
    ],
  });
}
