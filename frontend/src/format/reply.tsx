import type { ReactNode } from "react";
import { COPY } from "../copy";

const INLINE =
  /(\*\*[^*\n]+\*\*)|(\[[^\]\n]+\]\([^)\s]+\))|(#\/quote\/[A-Za-z0-9_-]+)|(https?:\/\/[^\s]+)/g;

const INTERNAL_QUOTE = /^#\/quote\/[A-Za-z0-9_-]+$/;

function internalLink(href: string, label: string, key: number): ReactNode {
  return (
    <a key={key} href={href}>
      {label}
    </a>
  );
}

export function parseInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) {
      nodes.push(text.slice(last, index));
    }
    const [full, bold, markdownLink, hashLink, url] = match;
    if (bold) {
      nodes.push(<strong key={key}>{bold.slice(2, -2)}</strong>);
    } else if (markdownLink) {
      const body = markdownLink.match(/^\[([^\]\n]+)\]\(([^)\s]+)\)$/);
      const label = body?.[1] ?? markdownLink;
      const target = body?.[2] ?? "";
      if (INTERNAL_QUOTE.test(target)) {
        nodes.push(internalLink(target, COPY.viewQuote, key));
      } else {
        nodes.push(`${label} (${target})`);
      }
    } else if (hashLink && INTERNAL_QUOTE.test(hashLink)) {
      nodes.push(internalLink(hashLink, COPY.viewQuote, key));
    } else if (url) {
      nodes.push(url);
    } else {
      nodes.push(full);
    }
    key += 1;
    last = index + full.length;
  }
  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return nodes;
}

export function AgentReply({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\s*[-*]\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ul key={key}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{parseInline(item)}</li>
          ))}
        </ul>,
      );
      key += 1;
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ol key={key}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{parseInline(item)}</li>
          ))}
        </ol>,
      );
      key += 1;
      continue;
    }
    if (line.trim() === "") {
      index += 1;
      continue;
    }
    blocks.push(<p key={key}>{parseInline(line)}</p>);
    key += 1;
    index += 1;
  }

  return <div className="agent-reply">{blocks}</div>;
}
