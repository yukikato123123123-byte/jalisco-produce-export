import {Localized} from '../localization';
import './account.css';
export function SiteNav() {
  const path=window.location.pathname;
  return <Localized><nav className="site-nav" aria-label="Main navigation">{[
    ['/','Home'],['/explore','Explore Produce'],['/producers','Producers'],['/buyers','Buyers'],['/logistics','Logistics'],['/commercial','Commercial'],['/readiness','Readiness'],['/buyer/dashboard','Buyer Center'],['/producer/dashboard','My Workspace'],['/inquiries','Inquiries'],['/account','Sign in / Account']
  ].map(([href,label])=><a key={href} href={href} aria-current={(path===href||path.startsWith(href+'/'))?'page':undefined}>{label}</a>)}</nav></Localized>;
}
