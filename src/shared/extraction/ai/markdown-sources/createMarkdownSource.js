import { fetchDefuddleMarkdown } from './defuddleMarkdownSource.js'
import { fetchDirectMarkdown } from './directMarkdownSource.js'
import { fetchTabstackMarkdown } from './tabstackMarkdownSource.js'

const markdownSourceStrategies = {
  direct: fetchDirectMarkdown,
  defuddle: fetchDefuddleMarkdown,
  tabstack: fetchTabstackMarkdown,
}

export function createMarkdownSource(source = 'tabstack') {
  return markdownSourceStrategies[source] || markdownSourceStrategies.tabstack
}
