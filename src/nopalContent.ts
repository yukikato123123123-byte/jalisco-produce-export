// Confirmed public concept only. Populate optional fields from approved product facts.
// Null fields are deliberately not rendered as ingredients, claims or instructions.
export const nopalProduct = {
 status: 'coming-soon',
 formula: null as string | null,
 ingredients: null as string[] | null,
 directions: null as string | null,
 launchDate: null as string | null,
 price: null as string | null,
 origin: null as string | null,
} as const;

export const nopalRitual = [
 {box:'120 411 477 121',title:'THE POWDER',alt:'Fine powder suspended above a mineral surface',description:'It begins with texture: fine powder, light and stillness. The final formula and ingredients have not been confirmed.'},
 {box:'620 411 482 121',title:'THE ENCOUNTER',alt:'Clear water meeting fine powder particles',description:'Water meets powder in the concept imagery. The mixing ratio and application instructions are still to be confirmed.'},
 {box:'1126 411 435 121',title:'THE TRANSFORMATION',alt:'A swirl of water and texture in a bowl',description:'The two elements form a new visual texture. This is a concept study, not a demonstration of verified cosmetic performance.'},
] as const;

// Populate only after a source has been reviewed; unpublished slots stay absent from the UI.
export const nopalOrigin = {
 brandHistory: null as string | null,
 mexicoAndNopal: null as string | null,
 rawMaterials: null as string | null,
} as const;
