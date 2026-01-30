const DEFAULT_TZ = 'Asia/Singapore'

export const formatDate = (value?: string) => {
  if (!value) {
    return 'Unknown'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('en-SG', {
    timeZone: DEFAULT_TZ,
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: false,
  }).format(date)
}

export const formatChatId = (uuid?: string) => {
  if (!uuid) {
    return 'Chat ID: —'
  }
  return `Chat ID: ${uuid.slice(0, 8)}`
}
