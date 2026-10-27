import {Localized} from '../localization';
import type { ReactNode } from 'react';
import {LanguageMenu} from './LanguageMenu';
import { SiteNav } from './SiteNav';

export function SiteHeader({ tools, children, presentation = false, languageButtons = false }: { languageButtons?: boolean; tools?: ReactNode; children?: ReactNode; presentation?: boolean }) {
  return <Localized><header className={`site-header ${presentation ? 'header presentation-header' : 'account-header'}`}>
    <a className="brand" href="/" aria-label="NopaHua home">
      <svg className="brand-mark" viewBox="0 0 60 55" aria-hidden="true"><path fill="currentColor" d="M40 2c-8 0-14 6-14 14 0 10 14 31 14 31s14-21 14-31C54 8 48 2 40 2Zm0 8a6 6 0 1 1 0 12 6 6 0 0 1 0-12ZM3 14c18 4 24 16 26 31C11 40 5 31 3 14Z"/><path d="m10 23 19 22" stroke="#193e2b" strokeWidth="1.5"/></svg>
      <span><strong>NopaHua</strong><small>CONCEPT · RESEARCH · POSSIBILITY</small></span>
    </a>
    <SiteNav/><LanguageMenu buttons={languageButtons}/>{tools && <div className="header-actions">{tools}</div>}{children}
  </header></Localized>;
}
export function SiteFooter({ presentation = false }: { presentation?: boolean }) {
  return <Localized><footer className="site-footer"><span>NopaHua</span><span>A cosmetic brand concept in development. Product details are not confirmed.</span><a href={presentation ? '#top' : '/research/nopahua'}>{presentation ? 'Back to top ' : 'Market research'}</a></footer></Localized>;
}
