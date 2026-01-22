import { create } from 'zustand'
import { useRiskStore } from './riskStore'

export type ChatSummary = {
  uuid?: string
  created_at?: string
  modified_at?: string
  updated_at?: string
}

type ChatState = {
  drawerOpened: boolean
  chats: ChatSummary[]
  loadingChats: boolean
  chatError: string | null
  activeChatUuid: string | null
  composingNewChat: boolean
  chatMessages: ChatMessage[]
  loadingMessages: boolean
  messageError: string | null
  sendingMessage: boolean
  sendingChatUuid: string | null
  setDrawerOpened: (opened: boolean) => void
  toggleDrawer: () => void
  fetchChats: (signal?: AbortSignal) => Promise<void>
  openChat: (uuid: string) => void
  startNewChat: () => void
  backToList: () => void
  fetchChatMessages: (uuid: string, signal?: AbortSignal) => Promise<void>
  sendMessage: (message: string) => Promise<void>
  deleteChat: (uuid: string) => Promise<void>
}

export type ChatMessage = {
  id?: number
  uuid?: string
  role: 'assistant' | 'user'
  content: string
  created_at?: string
}

export const useChatStore = create<ChatState>((set, get) => ({
  drawerOpened: false,
  chats: [],
  loadingChats: false,
  chatError: null,
  activeChatUuid: null,
  composingNewChat: false,
  chatMessages: [],
  loadingMessages: false,
  messageError: null,
  sendingMessage: false,
  sendingChatUuid: null,
  setDrawerOpened: (opened) => set({ drawerOpened: opened }),
  toggleDrawer: () =>
    set((state) => ({ drawerOpened: !state.drawerOpened })),
  fetchChats: async (signal) => {
    if (get().loadingChats) {
      return
    }

    set({ loadingChats: true, chatError: null })

    try {
      const response = await fetch('/api/chat', { signal })
      if (!response.ok) {
        throw new Error(`Failed to load chats (${response.status})`)
      }
      const data = await response.json()
      const chats = Array.isArray(data)
        ? data
        : Array.isArray(data?.chats)
          ? data.chats
          : []
      set({ chats })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        set({ loadingChats: false })
        return
      }
      set({ chatError: 'Unable to load chats.' })
    } finally {
      set({ loadingChats: false })
    }
  },
  openChat: (uuid) => {
    set({
      activeChatUuid: uuid,
      composingNewChat: false,
      chatMessages: [],
      messageError: null,
    })
  },
  startNewChat: () => {
    set({
      activeChatUuid: null,
      composingNewChat: true,
      chatMessages: [],
      messageError: null,
    })
  },
  backToList: () => {
    set({
      activeChatUuid: null,
      composingNewChat: false,
      chatMessages: [],
      messageError: null,
    })
  },
  fetchChatMessages: async (uuid, signal) => {
    set({ loadingMessages: true, messageError: null })
    try {
      const response = await fetch(`/api/chat?uuid=${encodeURIComponent(uuid)}`, {
        signal,
      })
      if (!response.ok) {
        throw new Error(`Failed to load chat (${response.status})`)
      }
      const data = await response.json()
      set({ chatMessages: Array.isArray(data) ? data : [] })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        set({ loadingMessages: false })
        return
      }
      set({ messageError: 'Unable to load messages.' })
    } finally {
      set({ loadingMessages: false })
    }
  },
  sendMessage: async (message) => {
    if (!message.trim()) {
      return
    }
    const { activeChatUuid, chatMessages } = get()
    const optimisticMessage: ChatMessage = {
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
      uuid: activeChatUuid ?? undefined,
    }
    set({
      sendingMessage: true,
      sendingChatUuid: activeChatUuid ?? null,
      messageError: null,
      chatMessages: [
        ...chatMessages,
        optimisticMessage,
        { role: 'assistant', content: '__loading__' },
      ],
    })
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, uuid: activeChatUuid ?? undefined }),
      })
      if (!response.ok) {
        throw new Error(`Failed to send message (${response.status})`)
      }
      const data = await response.json()
      const replyMessage: ChatMessage = {
        role: 'assistant',
        content: data.reply || '',
        created_at: new Date().toISOString(),
        uuid: data.uuid,
      }
      const replyText = typeof data?.reply === 'string' ? data.reply : ''
      const shouldRefreshRisk =
        /risk|score|hazard|military|economy|safety/i.test(message) ||
        /risk|score|updated|database/i.test(replyText)

      set((state) => ({
        sendingMessage: false,
        sendingChatUuid: null,
        activeChatUuid: data.uuid ?? state.activeChatUuid,
        composingNewChat: false,
        chatMessages: state.chatMessages
          .filter((msg) => msg.content !== '__loading__')
          .concat(replyMessage),
      }))
      await get().fetchChats()
      if (shouldRefreshRisk) {
        await useRiskStore.getState().fetchRisk()
      }
    } catch (error) {
      set((state) => ({
        sendingMessage: false,
        sendingChatUuid: null,
        messageError: 'Unable to send message.',
        chatMessages: state.chatMessages.filter(
          (msg) => msg.content !== '__loading__'
        ),
      }))
    }
  },
  deleteChat: async (uuid) => {
    if (!uuid) {
      return
    }
    try {
      const response = await fetch(`/api/chat/${encodeURIComponent(uuid)}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error(`Failed to delete chat (${response.status})`)
      }
      const state = get()
      const nextChats = state.chats.filter((chat) => chat.uuid !== uuid)
      set({
        chats: nextChats,
        activeChatUuid:
          state.activeChatUuid === uuid ? null : state.activeChatUuid,
        chatMessages:
          state.activeChatUuid === uuid ? [] : state.chatMessages,
      })
    } catch (error) {
      set({ chatError: 'Unable to delete chat.' })
    }
  },
}))
