import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { CheckIcon, Cross2Icon, TrashIcon } from '@radix-ui/react-icons'
import { useChatStore } from '../../store/chatStore'

const formatDate = (value?: string) => {
  if (!value) {
    return 'Unknown'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

const formatChatId = (uuid?: string) => {
  if (!uuid) {
    return 'Chat ID: —'
  }
  return `Chat ID: ${uuid.slice(0, 8)}`
}

export default function ChatDrawer() {
  const drawerOpened = useChatStore((state) => state.drawerOpened)
  const setDrawerOpened = useChatStore((state) => state.setDrawerOpened)
  const fetchChats = useChatStore((state) => state.fetchChats)
  const openChat = useChatStore((state) => state.openChat)
  const startNewChat = useChatStore((state) => state.startNewChat)
  const backToList = useChatStore((state) => state.backToList)
  const deleteChat = useChatStore((state) => state.deleteChat)
  const fetchChatMessages = useChatStore((state) => state.fetchChatMessages)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const chats = useChatStore((state) => state.chats)
  const loadingChats = useChatStore((state) => state.loadingChats)
  const chatError = useChatStore((state) => state.chatError)
  const activeChatUuid = useChatStore((state) => state.activeChatUuid)
  const chatMessages = useChatStore((state) => state.chatMessages)
  const loadingMessages = useChatStore((state) => state.loadingMessages)
  const messageError = useChatStore((state) => state.messageError)
  const sendingMessage = useChatStore((state) => state.sendingMessage)
  const composingNewChat = useChatStore((state) => state.composingNewChat)
  const [panelWidth, setPanelWidth] = useState(360)
  const [draft, setDraft] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const draggingRef = useRef(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!drawerOpened) {
      return
    }

    const controller = new AbortController()
    fetchChats(controller.signal)
    return () => controller.abort()
  }, [drawerOpened, fetchChats])

  useEffect(() => {
    if (!drawerOpened || !activeChatUuid) {
      return
    }
    const controller = new AbortController()
    fetchChatMessages(activeChatUuid, controller.signal)
    return () => controller.abort()
  }, [drawerOpened, activeChatUuid, fetchChatMessages])

  useEffect(() => {
    if (!activeChatUuid) {
      return
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeChatUuid, chatMessages.length])

  const onDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) {
      return
    }
    const maxWidth = Math.max(320, Math.floor(window.innerWidth / 2))
    const nextWidth = Math.min(Math.max(260, event.clientX), maxWidth)
    setPanelWidth(nextWidth)
  }

  const onDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) {
      return
    }
    draggingRef.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <Dialog.Root
      open={drawerOpened}
      onOpenChange={setDrawerOpened}
      modal={false}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="pointer-events-none fixed inset-0 z-30 bg-black/20" />
        <Dialog.Content
          className="fixed left-0 top-0 z-40 h-full max-w-[90vw] border-r border-white/10 bg-slate-950 text-white shadow-xl"
          style={{ width: panelWidth }}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <div
            role="separator"
            aria-label="Resize chat drawer"
            className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerLeave={onDragEnd}
          />
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <Dialog.Title className="text-base font-semibold">
              {activeChatUuid ? formatChatId(activeChatUuid) : 'Chats'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10"
                aria-label="Close chat drawer"
              >
                <Cross2Icon />
              </button>
            </Dialog.Close>
          </div>
          <div className="flex h-[calc(100%-64px)] min-h-0 flex-col gap-4 px-5 py-4">
            {activeChatUuid !== null || composingNewChat ? (
              <>
                <button
                  type="button"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
                  onClick={() => {
                    backToList()
                    setDraft('')
                  }}
                >
                  Back to list
                </button>
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
                {messageError ? (
                  <p className="text-sm text-red-400">{messageError}</p>
                ) : null}
                <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                  <div className="flex flex-col gap-3 pb-6">
                    {chatMessages.map((message, index) => {
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
                              <p className="mt-1 text-sm text-white">
                                {message.content}
                              </p>
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
                <form
                  className="flex items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (!draft.trim()) {
                      return
                    }
                    sendMessage(draft.trim())
                    setDraft('')
                  }}
                >
                  <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
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
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
                  onClick={() => {
                    startNewChat()
                    setDraft('')
                  }}
                >
                  New Chat
                </button>
                {loadingChats ? (
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-transparent" />
                    Loading chats...
                  </div>
                ) : null}
                {chatError ? (
                  <p className="text-sm text-red-400">{chatError}</p>
                ) : null}
                {!loadingChats && !chatError && chats.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No chats available yet.
                  </p>
                ) : null}
                <div className="flex-1 min-h-0 overflow-y-auto pr-1">
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
                              onClick={() => uuid && openChat(uuid)}
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
                                        deleteChat(uuid)
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
                                  onClick={() =>
                                    uuid && setPendingDelete(uuid)
                                  }
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
                </div>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
