import * as Dialog from '@radix-ui/react-dialog'
import { Cross2Icon } from '@radix-ui/react-icons'
import { formatChatId } from '../../utils/chatFormat'

type ChatHeaderProps = {
  activeChatUuid: string | null
}

export default function ChatHeader({ activeChatUuid }: ChatHeaderProps) {
  return (
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
  )
}
