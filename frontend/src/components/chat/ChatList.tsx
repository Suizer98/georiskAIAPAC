import { useState } from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { CheckIcon, Cross2Icon, TrashIcon } from '@radix-ui/react-icons'
import { formatChatId, formatDate } from '../../utils/chatFormat'
import type { ChatSummary } from '../../store/chatStore'

type ChatListProps = {
  chats: ChatSummary[]
  loading: boolean
  error: string | null
  onSelectChat: (uuid: string) => void
  onDeleteChat: (uuid: string) => void
  onStartNewChat: () => void
}

export default function ChatList({
  chats,
  loading,
  error,
  onSelectChat,
  onDeleteChat,
  onStartNewChat,
}: ChatListProps) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  return (
    <>
      <button
        type="button"
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
        onClick={onStartNewChat}
      >
        New Chat
      </button>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-transparent" />
          Loading chats...
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {!loading && !error && chats.length === 0 ? (
        <p className="text-sm text-slate-400">No chats available yet.</p>
      ) : null}
      <ScrollArea.Root className="flex-1 min-h-0">
        <ScrollArea.Viewport className="h-full w-full pr-1">
          <div className="flex flex-col gap-3 pb-6">
            {chats.map((chat, index) => {
              const timestamp =
                chat.modified_at || chat.updated_at || chat.created_at
              const uuid = chat.uuid
              const isPending = uuid && pendingDelete === uuid
              return (
                <div
                  key={chat.uuid ?? `chat-${index}`}
                  className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 hover:border-indigo-400/40"
                >
                  <button
                    type="button"
                    onClick={() => uuid && onSelectChat(uuid)}
                    className="flex-1 text-left"
                  >
                    <p className="text-sm font-semibold">
                      {formatChatId(uuid)}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {formatDate(timestamp)}
                    </p>
                  </button>
                  <div className="flex items-center gap-1">
                    {isPending ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (uuid) {
                              onDeleteChat(uuid)
                            }
                            setPendingDelete(null)
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-green-500/40 bg-green-500/10 text-green-200 hover:bg-green-500/20"
                          aria-label="Confirm delete"
                        >
                          <CheckIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(null)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10"
                          aria-label="Cancel delete"
                        >
                          <Cross2Icon />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => uuid && setPendingDelete(uuid)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10"
                        aria-label="Delete chat"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar
          orientation="vertical"
          className="flex touch-none select-none p-0.5"
        >
          <ScrollArea.Thumb className="relative flex-1 rounded-full bg-white/20" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </>
  )
}
