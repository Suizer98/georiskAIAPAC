type ChatComposerProps = {
  draft: string
  sendingMessage: boolean
  onDraftChange: (value: string) => void
  onSend: () => void
}

export default function ChatComposer({
  draft,
  sendingMessage,
  onDraftChange,
  onSend,
}: ChatComposerProps) {
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (!draft.trim()) {
          return
        }
        onSend()
      }}
    >
      <input
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder="Type a message..."
        className="flex-1 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
      />
      <button
        type="submit"
        disabled={sendingMessage}
        className="rounded-lg border border-indigo-400/30 bg-indigo-500/80 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
      >
        Send
      </button>
    </form>
  )
}
