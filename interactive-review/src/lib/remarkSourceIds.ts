import { visit } from "unist-util-visit";
import referenceUnits from "../generated/referenceUnits.json";

type MarkdownNode = {
  type: string;
  position?: {
    start: { line: number };
    end: { line: number };
  };
  data?: {
    hProperties?: Record<string, unknown>;
  };
};

type ReferenceUnit = {
  id: string;
  kind: "heading" | "paragraph" | "listItem";
  lineStart: number;
};

const units = referenceUnits as ReferenceUnit[];

function nodeKind(type: string) {
  if (type === "heading") return "heading";
  if (type === "paragraph") return "paragraph";
  if (type === "listItem") return "listItem";
  return null;
}

const unitByKey = new Map(units.map((unit) => [`${unit.kind}:${unit.lineStart}`, unit]));

export function remarkSourceIds() {
  return (tree: unknown) => {
    visit(tree as never, (node: MarkdownNode) => {
      const kind = nodeKind(node.type);
      if (!kind || !node.position) return;

      const unit = unitByKey.get(`${kind}:${node.position.start.line}`);
      if (!unit) return;

      node.data ??= {};
      node.data.hProperties = {
        ...node.data.hProperties,
        id: unit.id,
        "data-source-id": unit.id,
        "data-source-kind": unit.kind,
      };
    });
  };
}
