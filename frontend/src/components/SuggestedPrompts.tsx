const PROMPTS = [
  "I need help with research",
  "I need a security review",
  "I need help with marketing",
] as const;

export function SuggestedPrompts({ onPick, disabled }: { onPick: (prompt: string) => void; disabled: boolean }) {
  return (
    <div className="prompts" role="group" aria-label="Suggested messages">
      {PROMPTS.map((prompt) => (
        <button key={prompt} type="button" className="btn btn-secondary" disabled={disabled} onClick={() => onPick(prompt)}>
          {prompt}
        </button>
      ))}
    </div>
  );
}
