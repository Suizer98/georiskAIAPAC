import type { RefObject } from 'react'
import { formatDate } from '../../utils/chatFormat'
import type { ChatMessage } from '../../store/chatStore'

type ChatMessageListProps = {
  messages: ChatMessage[]
  loadingMessages: boolean
  messageError: string | null
  bottomRef: RefObject<HTMLDivElement | null>
}

export default function ChatMessageList({
  messages,
  loadingMessages,
  messageError,
  bottomRef,
}: ChatMessageListProps) {
  return (
    <>
      {loadingMessages ? (
        <div className="mr-8 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3">
          <p className="text-xs uppercase text-slate-400">assistant</p>
          <div className="mt-2 flex items-center gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
          </div>
        </div>
      ) : null}
      {messageError ? <p className="text-sm text-red-400">{messageError}</p> : null}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <div className="flex flex-col gap-3 pb-6">
          {messages.map((message, index) => {
            const isLoading = message.content === '__loading__'
            return (
              <div
                key={`${message.uuid ?? 'new'}-${index}`}
                className={
                  message.role === 'user'
                    ? 'ml-8 rounded-xl border border-white/10 bg-indigo-900/40 px-4 py-3'
                    : 'mr-8 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3'
                }
              >
                <p className="text-xs uppercase text-slate-400">
                  {message.role}
                </p>
                {isLoading ? (
                  <div className="mt-2 flex items-center gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                  </div>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-white">{message.content}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {formatDate(message.created_at)}
                    </p>
                  </>
                )}
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </div>
    </>
  )
}
