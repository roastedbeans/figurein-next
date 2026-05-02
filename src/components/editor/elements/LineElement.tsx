import type { LineElement as LineElementType } from "@/types/editor";
import { ArrowElement } from "./ArrowElement";

export function LineElement({ element }: { element: LineElementType }) {
  // Reuse the ArrowElement renderer — lines are arrows with no head/tail by default
  return (
    <ArrowElement
      element={{
        ...element,
        type: "arrow",
        headStyle: element.headStyle ?? "none",
        tailStyle: element.tailStyle ?? "none",
        lineStyle: element.lineStyle ?? "straight",
      }}
      dataId={element.id}
    />
  );
}
