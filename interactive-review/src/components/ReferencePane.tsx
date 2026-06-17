import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import referenceMarkdown from "../generated/reference.md?raw";
import { remarkSourceIds } from "../lib/remarkSourceIds";
import { Download } from "lucide-react";

type ReferencePaneProps = {
  activeSourceIds: string[];
  collapsed: boolean;
  downloads: { markdown: string | null; pdf: string | null };
};

export function ReferencePane({ activeSourceIds, collapsed, downloads }: ReferencePaneProps) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container
      .querySelectorAll(".active-source")
      .forEach((element) => element.classList.remove("active-source"));

    for (const sourceId of activeSourceIds) {
      const target = container.querySelector(`#${CSS.escape(sourceId)}`);
      target?.classList.add("active-source");
    }

    const firstTarget = activeSourceIds[0]
      ? container.querySelector(`#${CSS.escape(activeSourceIds[0])}`)
      : null;
    firstTarget?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeSourceIds]);

  return (
    <aside className={`reference-pane ${collapsed ? "is-collapsed" : ""}`} ref={containerRef}>
      <div className="reference-header">
        <div>
          <p className="eyebrow">复习资料</p>
          <h2>知识点定位</h2>
        </div>
        <details className="download-menu reference-download">
          <summary className="secondary-button download-summary">
            <Download size={18} />
            下载复习资料
          </summary>
          <div className="download-options">
            {downloads.markdown ? (
              <a download href={downloads.markdown}>
                下载为 md 格式
              </a>
            ) : (
              <span>md 格式暂不可用</span>
            )}
            {downloads.pdf ? (
              <a download href={downloads.pdf}>
                下载为 PDF 格式
              </a>
            ) : (
              <span>PDF 格式暂不可用</span>
            )}
          </div>
        </details>
      </div>
      <div className="reference-content">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkSourceIds]}>
          {referenceMarkdown}
        </ReactMarkdown>
      </div>
    </aside>
  );
}
