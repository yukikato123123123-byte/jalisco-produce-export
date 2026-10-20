import { pointCategories } from './gisSymbols.ts';
export { pointCategories, routeCategories } from './gisSymbols.ts';

// Isolated fictional GIS records. Geographic references are not project facilities,
// suppliers, buyers, farm coordinates, recommended temperatures, or carrier routes.
export type Bilingual = { en: string; es: string };
export type Coordinate = [number, number];
export type PointCategory = 'production' | 'packing' | 'logistics' | 'market';
export type LayerId = PointCategory | 'routes';
export type RouteCategory = 'collection' | 'refrigerated' | 'border' | 'distribution';
export interface DemoLocation {
  id: string; name: Bilingual; category: PointCategory; coordinates: Coordinate;
  region: Bilingual; description: Bilingual;
  attributes: { label: string; value: Bilingual }[];
  provenance: 'DEMO / SIMULATED';
}
export interface DemoRoute {
  id: string; name: Bilingual; originId: string; destinationId: string;
  stopIds: string[]; category: RouteCategory; coordinates: Coordinate[];
  simulatedDistanceKm: number | null; simulatedTransitHours: number | null;
  provenance: 'DEMO / SIMULATED';
}
const text = (en: string, es: string): Bilingual => ({ en, es });
export const gisNotice = 'DEMO DATA — SIMULATED LOCATIONS & ROUTES';
export const gisDisclaimer = 'All facilities, buyers, observations, and corridors are fictional. Geographic names are references only. No verified facility, carrier route, quote, clearance, or export approval is represented.';
export const layerDefinitions: { id: LayerId; label: string }[] = [
  ...Object.entries(pointCategories).map(([id, item]) => ({ id: id as PointCategory, label: item.label })),
  { id: 'routes', label: 'Transport Routes' },
];
const descriptions: Record<PointCategory, Bilingual> = {
  production: text('Fictional growing zone; area, seasonal volume, and harvest window are simulated, unrelated to Eduardo’s reported harvest.', 'Zona de cultivo ficticia; superficie, volumen estacional y periodo de cosecha simulados, sin relación con la cosecha reportada por Eduardo.'),
  packing: text('Fictional collection or consolidation facility; handling figures and packaging states are simulated.', 'Instalación ficticia de acopio o consolidación; cifras de manejo y estados de empaque simulados.'),
  logistics: text('Fictional cold-chain observation point. Temperature is simulated, not live monitoring or a handling recommendation.', 'Punto ficticio de observación de cadena de frío. La temperatura es simulada; no es monitoreo en vivo ni recomendación de manejo.'),
  market: text('Fictional distribution or buyer-discovery location. No real buyer, demand, or commercial relationship is identified.', 'Ubicación ficticia de distribución o búsqueda de compradores. No identifica comprador, demanda ni relación comercial real.'),
};
const prefixes: Record<PointCategory, Bilingual> = {
  production: text('Demo growing zone', 'Zona de cultivo demo'), packing: text('Demo packing node', 'Nodo de empaque demo'),
  logistics: text('Demo cold-chain point', 'Punto de cadena de frío demo'), market: text('Demo market node', 'Nodo de mercado demo'),
};
type Seed = [string, string, number, number, string, string?];
function locations(category: PointCategory, seeds: Seed[]): DemoLocation[] {
  return seeds.map(([id, place, latitude, longitude, region, placeEs], index) => {
    const attributes: DemoLocation['attributes'] = category === 'production' ? [
      { label: 'Simulated cultivated area', value: text(`${12 + index * 2} ha`, `${12 + index * 2} ha`) },
      { label: 'Simulated seasonal estimate', value: text(`${24 + index * 3} metric tonnes`, `${24 + index * 3} toneladas métricas`) },
      { label: 'Simulated harvest window', value: text('May–July · fictional season', 'Mayo–julio · temporada ficticia') },
    ] : category === 'packing' ? [
      { label: 'Simulated handling capacity', value: text(`${8 + index * 2} tonnes / day`, `${8 + index * 2} toneladas / día`) },
      { label: 'Simulated packaging status', value: text(index % 2 ? 'Review pending' : 'Trial configuration', index % 2 ? 'Revisión pendiente' : 'Configuración de prueba') },
    ] : category === 'logistics' ? [
      { label: 'Simulated temperature', value: text(`${4 + index % 3} °C · no observation date`, `${4 + index % 3} °C · sin fecha de observación`) },
      { label: 'Simulated checkpoint status', value: text(index % 3 ? 'Scenario observation only' : 'Review flag · fictional', index % 3 ? 'Solo observación de escenario' : 'Indicador de revisión · ficticio') },
    ] : [
      { label: 'Illustrative destination category', value: text(index % 2 ? 'Wholesale-market example' : 'Distribution-center example', index % 2 ? 'Ejemplo de mercado mayorista' : 'Ejemplo de centro de distribución') },
      { label: 'Simulated demand band', value: text(index % 2 ? 'Medium · invented band' : 'Small · invented band', index % 2 ? 'Media · banda inventada' : 'Pequeña · banda inventada') },
    ];
    return { id, name: text(`${prefixes[category].en} · ${place}`, `${prefixes[category].es} · ${placeEs ?? place}`), category,
      coordinates: [latitude, longitude], region: text(region, region.replace('Mexico', 'México')),
      description: descriptions[category], attributes, provenance: 'DEMO / SIMULATED' };
  });
}
export const demoLocations: DemoLocation[] = [
  ...locations('production', [
    ['P01', 'El Grullo North', 19.86, -104.24, 'Jalisco, Mexico', 'El Grullo Norte'],
    ['P02', 'El Limón', 19.81, -104.11, 'Jalisco, Mexico'],
    ['P03', 'Autlán North', 19.81, -104.39, 'Jalisco, Mexico', 'Autlán Norte'],
    ['P04', 'Unión de Tula', 19.96, -104.28, 'Jalisco, Mexico'],
    ['P05', 'Ameca', 20.58, -104.08, 'Jalisco, Mexico'],
    ['P06', 'Cocula', 20.37, -103.83, 'Jalisco, Mexico'],
    ['P07', 'Zacoalco', 20.27, -103.61, 'Jalisco, Mexico'],
    ['P08', 'Sayula', 19.91, -103.60, 'Jalisco, Mexico'],
    ['P09', 'Jocotepec', 20.30, -103.43, 'Jalisco, Mexico'],
    ['P10', 'Chapala', 20.32, -103.20, 'Jalisco, Mexico'],
    ['P11', 'Tlajomulco', 20.47, -103.46, 'Jalisco, Mexico'],
    ['P12', 'Zapopan', 20.77, -103.49, 'Jalisco, Mexico'],
  ]),
  ...locations('packing', [
    ['C01', 'El Grullo', 19.79, -104.21, 'Jalisco, Mexico'],
    ['C02', 'Autlán', 19.77, -104.36, 'Jalisco, Mexico'],
    ['C03', 'Ameca', 20.55, -104.04, 'Jalisco, Mexico'],
    ['C04', 'Zacoalco', 20.23, -103.57, 'Jalisco, Mexico'],
    ['C05', 'Chapala', 20.30, -103.19, 'Jalisco, Mexico'],
    ['C06', 'Guadalajara consolidation', 20.62, -103.36, 'Jalisco, Mexico', 'Consolidación Guadalajara'],
  ]),
  ...locations('logistics', [
    ['H01', 'Guadalajara', 20.70, -103.31, 'Jalisco, Mexico'],
    ['H02', 'Lagos de Moreno', 21.37, -101.91, 'Jalisco, Mexico'],
    ['H03', 'San Luis Potosí', 22.16, -100.99, 'San Luis Potosí, Mexico'],
    ['H04', 'Saltillo', 25.42, -100.99, 'Coahuila, Mexico'],
    ['H05', 'Monterrey', 25.69, -100.30, 'Nuevo León, Mexico'],
    ['H06', 'Nuevo Laredo', 27.47, -99.55, 'Tamaulipas, Mexico'],
    ['H07', 'Laredo', 27.54, -99.50, 'Texas, U.S.'],
    ['H08', 'San Antonio', 29.42, -98.49, 'Texas, U.S.'],
    ['H09', 'Austin', 30.27, -97.74, 'Texas, U.S.'],
    ['H10', 'Dallas', 32.77, -96.80, 'Texas, U.S.'],
    ['H11', 'Oklahoma City', 35.47, -97.52, 'Oklahoma, U.S.'],
    ['H12', 'St. Louis', 38.63, -90.20, 'Missouri, U.S.'],
  ]),
  ...locations('market', [
    ['U01', 'San Antonio West', 29.47, -98.54, 'Texas, U.S.', 'San Antonio Oeste'],
    ['U02', 'Austin East', 30.31, -97.71, 'Texas, U.S.', 'Austin Este'],
    ['U03', 'Houston', 29.78, -95.34, 'Texas, U.S.'],
    ['U04', 'Dallas North', 32.86, -96.75, 'Texas, U.S.', 'Dallas Norte'],
    ['U05', 'Fort Worth', 32.78, -97.33, 'Texas, U.S.'],
    ['U06', 'Plano', 33.02, -96.70, 'Texas, U.S.'],
    ['U07', 'Springfield', 39.78, -89.65, 'Illinois, U.S.'],
    ['U08', 'Bloomington', 40.49, -88.99, 'Illinois, U.S.'],
    ['U09', 'Joliet', 41.52, -88.08, 'Illinois, U.S.'],
    ['U10', 'Aurora', 41.76, -88.32, 'Illinois, U.S.'],
    ['U11', 'Chicago', 41.85, -87.68, 'Illinois, U.S.'],
    ['U12', 'Rockford', 42.27, -89.07, 'Illinois, U.S.'],
  ]),
].map(point => ({ ...point, region: { ...point.region, es: point.region.es.replace('U.S.', 'EE. UU.') } }));
export const locationById = new Map(demoLocations.map(point => [point.id, point]));
// Each route can serve intermediate stops. This connects all 42 point records
// using 20 named scenario segments, rather than 41 separate two-stop edges.
function route(id: string, category: RouteCategory, stops: string[], name: Bilingual, between: Record<string, Coordinate[]> = {}): DemoRoute {
  const coordinates: Coordinate[] = [];
  stops.forEach((stop, index) => {
    const point = locationById.get(stop);
    if (!point) throw new Error(`Unknown GIS stop: ${stop}`);
    if (index) coordinates.push(...(between[stop] ?? []));
    coordinates.push(point.coordinates);
  });
  return { id, name, category, originId: stops[0], destinationId: stops[stops.length - 1], stopIds: stops, coordinates,
    simulatedDistanceKm: null, simulatedTransitHours: null, provenance: 'DEMO / SIMULATED' };
}
export const demoRoutes: DemoRoute[] = [
  ...Array.from({ length: 6 }, (_, index) => route(`R${String(index + 1).padStart(2, '0')}`, 'collection',
    [`P${String(index * 2 + 1).padStart(2, '0')}`, `P${String(index * 2 + 2).padStart(2, '0')}`, `C${String(index + 1).padStart(2, '0')}`],
    text(`Demo collection loop ${index + 1}`, `Circuito demo de acopio ${index + 1}`))),
  route('R07', 'collection', ['C01', 'C02', 'C03', 'C06'], text('Demo western consolidation', 'Consolidación occidental demo'), { C03: [[20.20, -104.15], [20.37, -103.84]], C06: [[20.55, -103.85]] }),
  route('R08', 'collection', ['C04', 'C05', 'C06'], text('Demo lake-region consolidation', 'Consolidación demo de la región de la laguna'), { C05: [[20.28, -103.43]], C06: [[20.46, -103.24]] }),
  route('R09', 'refrigerated', ['C06', 'H01'], text('Demo cold-chain handoff', 'Transferencia demo de cadena de frío')),
  route('R10', 'refrigerated', ['H01', 'H02'], text('Demo Jalisco highlands corridor', 'Corredor demo de Los Altos de Jalisco'), { H02: [[20.91, -102.76], [21.25, -102.33]] }),
  route('R11', 'refrigerated', ['H02', 'H03'], text('Demo San Luis Potosí corridor', 'Corredor demo de San Luis Potosí'), { H03: [[21.86, -101.59]] }),
  route('R12', 'refrigerated', ['H03', 'H04'], text('Demo northbound corridor', 'Corredor demo hacia el norte'), { H04: [[23.65, -100.64], [24.78, -100.66]] }),
  route('R13', 'refrigerated', ['H04', 'H05', 'H06'], text('Demo Nuevo León border approach', 'Acceso fronterizo demo por Nuevo León'), { H06: [[26.50, -100.17]] }),
  route('R14', 'border', ['H06', 'H07'], text('Demo Nuevo Laredo–Laredo crossing region', 'Región de cruce demo Nuevo Laredo–Laredo'), { H07: [[27.49, -99.51], [27.50, -99.50]] }),
  route('R15', 'refrigerated', ['H07', 'H08', 'H09', 'H10'], text('Demo Texas trunk corridor', 'Corredor principal demo de Texas'), { H08: [[28.44, -99.24]], H10: [[31.55, -97.15]] }),
  route('R16', 'distribution', ['H08', 'U01', 'U02', 'U03'], text('Demo central and southeast Texas branch', 'Ramal demo del centro y sureste de Texas'), { U03: [[30.17, -96.40]] }),
  route('R17', 'distribution', ['H10', 'U04', 'U05', 'U06'], text('Demo north Texas distribution loop', 'Circuito demo de distribución del norte de Texas')),
  route('R18', 'refrigerated', ['H10', 'H11', 'H12', 'U07', 'U08'], text('Demo Midwest corridor', 'Corredor demo al Medio Oeste'), { H11: [[34.17, -97.14]], H12: [[36.15, -95.99], [37.08, -94.51], [37.21, -93.29], [38.00, -91.68]], U07: [[38.90, -89.95]] }),
  route('R19', 'distribution', ['U08', 'U09', 'U10', 'U11'], text('Demo Chicago-region distribution', 'Distribución demo de la región de Chicago'), { U09: [[41.12, -88.84]] }),
  route('R20', 'distribution', ['U11', 'U12'], text('Demo northern Illinois branch', 'Ramal demo del norte de Illinois'), { U12: [[42.02, -88.28]] }),
];
