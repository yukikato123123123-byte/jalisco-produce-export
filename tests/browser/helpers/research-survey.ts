import {expect,type Page} from '@playwright/test';
import {surveyQuestions} from '../../../shared/researchSurvey';
import {translate} from '../../../src/i18n';
export const surveyFixture:Record<string,string|number|string[]>={interest:4,clarity:3,nameImpression:'somewhat_positive',preference:'unsure',mostInteresting:'powder_water',informationNeeded:'Synthetic isolated detail',comment:'Synthetic isolated reflection',servings:'seven',price:'50_99',purchaseIntent:'probably',situations:['home','trips']};
export async function answerQuestion(page:Page,index:number,language:'en'|'es',value=surveyFixture[surveyQuestions[index].key]){
 const q=surveyQuestions[index];await expect(page.getByRole('heading',{level:2,name:translate(q.title,language),exact:true})).toBeVisible();
 if(q.kind==='text')await page.locator('textarea[name="'+q.key+'"]').fill(String(value));
 else for(const selected of Array.isArray(value)?value:[value])await page.locator('label.research-choice').filter({has:page.locator('input[value="'+selected+'"]')}).click();
}
export async function completeSurvey(page:Page,language:'en'|'es',start=0){
 if(start===0)await page.getByRole('button',{name:translate('Start the research',language),exact:true}).click();
 for(let i=start;i<11;i++){await answerQuestion(page,i,language);await page.getByRole('button',{name:translate(i===10?'Review your answers':'Continue',language),exact:true}).click();}
 await expect(page.getByRole('heading',{level:2,name:translate('Review your answers',language),exact:true})).toBeVisible();
}
