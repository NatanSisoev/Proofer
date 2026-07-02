"use client";

import { useState, useRef, Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { ChevronDown } from "./Icons";

type PanelProps = { id: string; title: string; meta?: ReactNode; children: ReactNode };

/** Marker for one accordion section. Declared as JSX children (keyed) so React
 *  never sees an array-of-elements prop, which trips RSC key validation. */
export function NodePanel(_props: PanelProps) {
  return null;
}

/**
 * Single-open accordion for the node page's relationship sections. The open
 * body is mounted only while visible — so the cytoscape graphs inside always
 * initialize at their real container size — while a brief "closing" phase keeps
 * the outgoing panel around long enough to animate out.
 */
export default function NodePanels({ children, defaultOpen = 0 }: { children: ReactNode; defaultOpen?: number }) {
  const panels = Children.toArray(children).filter(
    (c): c is ReactElement<PanelProps> => isValidElement(c)
  );
  const [open, setOpen] = useState(defaultOpen);
  const [closing, setClosing] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggle(i: number) {
    if (timer.current) clearTimeout(timer.current);
    const closingIdx = open === i ? i : open; // the panel that is leaving
    if (closingIdx >= 0) {
      setClosing(closingIdx);
      timer.current = setTimeout(() => setClosing(null), 200);
    }
    setOpen(open === i ? -1 : i);
  }

  return (
    <div className="node-panels">
      {panels.map((panel, i) => {
        const { id, title, meta, children: body } = panel.props;
        const isOpen = open === i;
        const isClosing = !isOpen && closing === i;
        return (
          <div key={id} className={`node-accordion${isOpen ? " open" : ""}`}>
            <button
              type="button"
              className="node-accordion-header"
              aria-expanded={isOpen}
              onClick={() => toggle(i)}
            >
              <span className="node-accordion-title">{title}</span>
              <span className="node-accordion-right">
                {meta}
                <ChevronDown size={14} className="node-accordion-chevron" />
              </span>
            </button>
            {(isOpen || isClosing) && (
              <div className={`node-accordion-body${isClosing ? " closing" : " opening"}`}>{body}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
