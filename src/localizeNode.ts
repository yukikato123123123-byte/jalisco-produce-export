import { Children, cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { Language } from './presentation.ts';
import { translate } from './i18n.ts';

// Translate declarative presentation nodes before React renders them, without
// mutating the DOM. Stable option values, event handlers, refs, and user entries
// are preserved. Components with their own render logic use their own Localized.
export function localizeNode(node: ReactNode, language: Language): ReactNode {
  if (typeof node === 'string') return translate(node, language);
  if (!isValidElement(node)) return Array.isArray(node) ? node.map(child => localizeNode(child, language)) : node;
  const element = node as ReactElement<Record<string, unknown>>;
  if (element.props['data-no-translate']) return element;
  const props: Record<string, unknown> = {};
  for (const key of ['title', 'aria-label', 'placeholder', 'label', 'description', 'step']) {
    if (typeof element.props[key] === 'string') props[key] = translate(element.props[key], language);
  }
  if (element.props.children !== undefined) props.children = Children.map(element.props.children as ReactNode, child => localizeNode(child, language));
  return cloneElement(element, props);
}
