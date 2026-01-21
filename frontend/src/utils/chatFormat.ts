export const formatDate = (value?: string) => {
  if (!value) {
    return 'Unknown'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

export const formatChatId = (uuid?: string) => {
  if (!uuid) {
    return 'Chat ID: —'
  }
  return `Chat ID: ${uuid.slice(0, 8)}`
}
