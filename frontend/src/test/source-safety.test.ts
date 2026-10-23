import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return walk(path);
    }
    if (/\.(ts|tsx)$/.test(path) && !path.includes(`${join("src", "test")}`)) {
      return [path];
    }
    return [];
  });
}

describe("output safety", () => {
  it("does not inject model output with innerHTML", () => {
    const files = [...walk(join(process.cwd(), "src")), ...walk(join(process.cwd(), "../shared/src"))];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("dangerouslySetInnerHTML");
      expect(source, file).not.toMatch(/\.innerHTML\s*=/);
      expect(source, file).not.toMatch(/\.outerHTML\s*=/);
      expect(source, file).not.toContain("insertAdjacentHTML");
      expect(source, file).not.toContain("document.write");
      expect(source, file).not.toMatch(/\beval\s*\(/);
      expect(source, file).not.toContain("new Function");
    }
  });
});
