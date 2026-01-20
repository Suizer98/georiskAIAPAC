import { useState } from 'react'
import { Button, Group, ScrollArea, Stack, Text, TextInput } from '@mantine/core'

type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  content: string
  time: string
}

const initialMessages: ChatMessage[] = [
  {
    id: '1',
    role: 'assistant',
    content: 'Welcome! Ask about any country or region to get a risk summary.',
    time: '09:41',
  },
  {
    id: '2',
    role: 'user',
    content: 'Show me the latest maritime risk for Southeast Asia.',
    time: '09:42',
  },
  {
    id: '3',
    role: 'assistant',
    content:
      'Southeast Asia sits at a moderate level overall. Highest exposure is in key chokepoints.',
    time: '09:43',
  },
]

export default function ChatPanel() {
  const [messages] = useState(initialMessages)

  return (
    <Stack h="100%">
      <Group justify="space-between">
        <div>
          <Text fw={600}>Risk Analyst</Text>
          <Text size="sm" c="dimmed">
            Ask the model anything
          </Text>
        </div>
        <Button variant="light" size="xs">
          New Chat
        </Button>
      </Group>
      <ScrollArea h={340}>
        <Stack gap="sm">
          {messages.map((message) => (
            <Stack
              key={message.id}
              align={message.role === 'user' ? 'flex-end' : 'flex-start'}
              gap={4}
            >
              <Text
                size="sm"
                px="sm"
                py={6}
                style={{
                  borderRadius: 12,
                  background:
                    message.role === 'user' ? '#1f3b74' : '#1a1f2f',
                }}
              >
                {message.content}
              </Text>
              <Text size="xs" c="dimmed">
                {message.time}
              </Text>
            </Stack>
          ))}
        </Stack>
      </ScrollArea>
      <Group component="form" onSubmit={(event) => event.preventDefault()}>
        <TextInput
          placeholder="Ask about a country, city, or event..."
          style={{ flex: 1 }}
        />
        <Button type="submit">Send</Button>
      </Group>
    </Stack>
  )
}
