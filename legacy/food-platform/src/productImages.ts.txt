export type ProductImage={id:string;product_id:string;thumbnail:string;url:string;width:number;height:number;position:number;primary:boolean};
export function parseProductImages(value:unknown):ProductImage[]{if(Array.isArray(value))return value as ProductImage[];if(typeof value==='string'){try{const v=JSON.parse(value);return Array.isArray(v)?v:[];}catch{return [];}}return [];}
