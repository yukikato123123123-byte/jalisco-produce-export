import {Localized} from '../localization';
export type PublicBuyer={id:string;company:string;country:string;region:string;markets:string;interests:string;introduction:string};
export function BuyerDirectoryEntry({buyer,detail}:{buyer:PublicBuyer;detail:boolean}) {
  return <Localized><article className="producer-directory-entry buyer-directory-entry"><p className="eyebrow" data-no-translate>{[buyer.region,buyer.country].filter(Boolean).join(' · ')}</p><h2 data-no-translate>{buyer.company}</h2><p className="publication-note">Published by the buyer with consent · No verification implied</p>
    <dl><dt>Target markets</dt><dd data-no-translate={Boolean(buyer.markets)}>{buyer.markets||'Not specified'}</dd><dt>Produce interests</dt><dd data-no-translate>{buyer.interests}</dd></dl>
    {detail?<><h3>Company introduction</h3><p data-no-translate={Boolean(buyer.introduction)}>{buyer.introduction||'No public introduction provided.'}</p><h3>Find a connection</h3><p>Explore producers around these sourcing interests. Private contacts, inquiries and contracts are not shared here. No introduction or message has been sent.</p><a className="text-link" href={`/producers?q=${encodeURIComponent(buyer.interests.slice(0,120))}`}>Explore matching producers </a><br/><a className="text-link" href="/producer/dashboard">Open My Workspace </a><br/><a className="text-link" href="/buyers"> All buyers</a></>:<a className="text-link" href={`/buyers/${encodeURIComponent(buyer.id)}`}>View buyer profile </a>}
  </article></Localized>;
}
