export const QUESTIONNAIRE_VERSION='concept-11-v1';
export const CONSENT_VERSION='nopahua-research-v1';
export type SurveyQuestion={key:string;section:string;title:string;kind:'scale'|'single'|'text'|'multiple';optional?:boolean;ends?:[string,string];options?:{value:string;label:string}[]};
const options=(items:[string,string][])=>items.map(([value,label])=>({value,label}));
export const surveyQuestions:SurveyQuestion[]=[
 {key:'interest',section:'First impressions',title:'How interested are you in this concept?',kind:'scale',ends:['Not at all interested','Very interested']},
 {key:'clarity',section:'The concept',title:'How clear is the powder-and-water concept?',kind:'scale',ends:['Not at all clear','Very clear']},
 {key:'nameImpression',section:'The name',title:'What is your first impression of the name NopaHua?',kind:'single',options:options([['very_positive','Very positive'],['somewhat_positive','Somewhat positive'],['neutral','Neutral'],['somewhat_negative','Somewhat negative'],['very_negative','Very negative']])},
 {key:'preference',section:'The format',title:'Which format would you prefer to explore?',kind:'single',options:options([['powder','Powder'],['liquid','Liquid'],['unsure','Not sure']])},
 {key:'mostInteresting',section:'Your curiosity',title:'What interests you most about this concept?',kind:'single',options:options([['brand_name','The brand name'],['powder_water','The powder-and-water concept'],['visuals','The visual presentation'],['new_product','The possibility of exploring a new product'],['nothing','Nothing in particular'],['other','Other']])},
 {key:'informationNeeded',section:'Your perspective',title:'What, if anything, would you want to know before considering this concept further?',kind:'text',optional:true},
 {key:'comment',section:'Your perspective',title:'Is there anything else you would like to share about the name or concept?',kind:'text',optional:true},
 {key:'servings',section:'Hypothetical preferences',title:'What product size or number of servings would you prefer?',kind:'single',options:options([['one','1 serving'],['seven','About 7 servings'],['fifteen','About 15 servings'],['thirty','About 30 servings'],['more_information','Need more information']])},
 {key:'price',section:'Hypothetical preferences',title:'Assuming a pack contains about 7 servings, what price would you consider reasonable?',kind:'single',options:options([['under_50','Under MXN $50'],['50_99','MXN $50–99'],['100_149','MXN $100–149'],['150_199','MXN $150–199'],['200_plus','MXN $200 or more'],['more_information','Need more information']])},
 {key:'purchaseIntent',section:'Looking ahead',title:'How likely would you be to consider purchasing this product if it became available?',kind:'single',options:options([['definitely','Definitely consider'],['probably','Probably consider'],['unsure','Not sure'],['probably_not','Probably not'],['definitely_not','Definitely not']])},
 {key:'situations',section:'Everyday possibilities',title:'In what situations might you use a product like this?',kind:'multiple',options:options([['home','At home'],['work_school','At work or school'],['local_travel','While traveling locally'],['trips','During trips'],['unsure','Not sure'],['other','Other']])}
];
export type SurveyAnswers=Record<string,string|number|string[]>;
export function validSurveyAnswer(q:SurveyQuestion,value:unknown){
 if(q.kind==='text')return (value===undefined&&q.optional)||typeof value==='string'&&value.length<=500;
 if(q.kind==='scale')return Number.isInteger(value)&&Number(value)>=1&&Number(value)<=5;
 if(q.kind==='single')return typeof value==='string'&&q.options!.some(o=>o.value===value);
 return Array.isArray(value)&&value.length>=1&&value.length<=q.options!.length&&new Set(value).size===value.length&&value.every(v=>typeof v==='string'&&q.options!.some(o=>o.value===v))&&(!value.includes('unsure')||value.length===1);
}
export function normalizedSurveyAnswers(body:Record<string,unknown>):SurveyAnswers|null{
 if(!surveyQuestions.every(q=>validSurveyAnswer(q,body[q.key])))return null;
 return Object.fromEntries(surveyQuestions.map(q=>[q.key,q.kind==='text'?String(body[q.key]??'').trim():body[q.key]])) as SurveyAnswers;
}
