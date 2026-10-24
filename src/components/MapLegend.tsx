import {Localized} from '../localization';
import type { PointCategory, RouteCategory } from '../gisDemoData';
import { pointCategories, routeCategories, routeAccentPaths } from '../gisSymbols';
import type { LayerVisibility } from '../gisNetwork';
import type { Language } from '../presentation';
import { localizeNode } from '../localizeNode';

export function PointSymbol({ category }: { category: PointCategory }) {
  return <Localized><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{pointCategories[category].paths.map((path, index) => <path key={index} d={path}/>)}</svg></Localized>;
}
export function RouteSymbol({ category }: { category: RouteCategory }) {
  const style = routeCategories[category];
  return <Localized><svg viewBox="0 0 48 28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 14h44" strokeDasharray={style.dashArray}/>{style.decoration && <g transform="translate(12 2)"><rect width="24" height="24" rx="7" className="gis-route-symbol-backdrop" stroke="none"/>{routeAccentPaths[style.decoration].map((path, index) => <path key={index} d={path}/>)}</g>}</svg></Localized>;
}
export function MapLegend({ visible, language }: { visible: LayerVisibility; language: Language }) {
  return localizeNode(<section className="gis-legend" aria-labelledby="gis-legend-heading"><div className="gis-legend-heading"><h3 id="gis-legend-heading">Map legend</h3><span>Layer visibility</span></div>
    <h4>Locations</h4><ul>{(Object.keys(pointCategories) as PointCategory[]).map(category => {
      const item = pointCategories[category];
      return <Localized key={category}><li className="gis-legend-item" data-active={visible[category]}><span className="gis-location-symbol" style={{ color: item.color, background: item.background }}><PointSymbol category={category}/></span><span className="gis-legend-copy"><strong>{item.label}</strong><span className="gis-legend-status">{visible[category] ? 'Visible' : 'Hidden'}</span></span></li></Localized>;
    })}</ul>
    <h4>Routes</h4><ul>{(Object.keys(routeCategories) as RouteCategory[]).map(category => <li key={category} className="gis-legend-item gis-legend-route" data-active={visible.routes}><span className="gis-line-symbol" style={{ color: routeCategories[category].color }}><RouteSymbol category={category}/></span><span className="gis-legend-copy"><strong>{routeCategories[category].label}</strong><span className="gis-legend-status">{visible.routes ? 'Visible' : 'Hidden'}</span></span></li>)}</ul>
  </section>, language);
}
