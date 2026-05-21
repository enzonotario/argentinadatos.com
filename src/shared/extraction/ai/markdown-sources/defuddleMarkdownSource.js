import { logMensaje } from '@/log.js'
import { fetchDefuddleMarkdownFromUrl } from '@/shared/extraction/defuddle.js'

export async function fetchDefuddleMarkdown(log, url) {
  logMensaje(log, 'Starting Defuddle markdown fetch', {
    url,
  })

  return fetchDefuddleMarkdownFromUrl(url)
}
