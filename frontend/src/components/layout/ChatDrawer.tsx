import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useChatStore } from '../../store/chatStore'
import ChatComposer from '../chat/ChatComposer'
import ChatHeader from '../chat/ChatHeader'
import ChatList from '../chat/ChatList'
import ChatMessageList from '../chat/ChatMessageList'

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
  const sendingChatUuid = useChatStore((state) => state.sendingChatUuid)
  const composingNewChat = useChatStore((state) => state.composingNewChat)
  const [panelWidth, setPanelWidth] = useState(360)
  const [draft, setDraft] = useState('')
  const draggingRef = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null!)

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
          <ChatHeader activeChatUuid={activeChatUuid} />
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
                <ChatMessageList
                  messages={chatMessages}
                  loadingMessages={loadingMessages}
                  messageError={messageError}
                  bottomRef={bottomRef}
                  showPending={
                    sendingMessage && sendingChatUuid === activeChatUuid
                  }
                />
                <ChatComposer
                  draft={draft}
                  sendingMessage={sendingMessage}
                  onDraftChange={setDraft}
                  onSend={() => {
                    sendMessage(draft.trim())
                    setDraft('')
                  }}
                />
              </>
            ) : (
              <ChatList
                chats={chats}
                loading={loadingChats}
                error={chatError}
                onSelectChat={openChat}
                onDeleteChat={deleteChat}
                onStartNewChat={() => {
                  startNewChat()
                  setDraft('')
                }}
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
