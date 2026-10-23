export function TypingIndicator() {
  return (
    <p className="typing" role="status">
      <span className="typing-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      Assistant is replying
    </p>
  );
}
