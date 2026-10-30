import {surveyQuestions} from '../../shared/researchSurvey';
import {useAdminLanguage} from '../adminLocalization';
import {adminLocale,translateAdmin} from '../adminI18n';
import {translate} from '../i18n';
import './survey-result-charts.css';
export type SurveyAggregate={total:number;trend?:{date:string;count:number}[];questions:{key:string;value:string|number;count:number}[];answered:{key:string;count:number}[]};
const colors=['#355c45','#a07338','#557990','#92667b','#7b7950','#766a94','#d2d6cc'];
export function SurveyResultCharts({data,verification=false}:{data:SurveyAggregate;verification?:boolean}){
 const {language}=useAdminLanguage(),locale=adminLocale(language);
 const t=(s:string)=>language==='es'?translate(s,'es')===s?translateAdmin(s,language):translate(s,'es'):translateAdmin(s,language);
 const number=(n:number)=>n.toLocaleString(locale),percent=(n:number)=>(data.total?100*n/data.total:0).toLocaleString(locale,{maximumFractionDigits:1})+'%';
 const trend=data.trend??[],max=Math.max(1,...trend.map(v=>v.count));
 const start=trend.length?Date.parse(trend[0].date+'T00:00:00Z'):0,end=trend.length?Date.parse(trend.at(-1)!.date+'T00:00:00Z'):0;
 const x=(day:string)=>end===start?330:58+(Date.parse(day+'T00:00:00Z')-start)/(end-start)*540,y=(n:number)=>190-140*n/max;
 const rows=surveyQuestions.map((question,index)=>{
  const answered=data.answered?.find(v=>v.key===question.key)?.count??0;
  const options=question.kind==='text'?[{value:'answered',label:'Answered',count:answered},{value:'missing',label:'Not answered',count:Math.max(0,data.total-answered)}]:(question.kind==='scale'?[1,2,3,4,5].map(value=>({value,label:String(value)})):question.options??[]).map(option=>({...option,count:data.questions?.find(v=>v.key===question.key&&v.value===option.value)?.count??0}));
  return {question,index,answered,options};
 });
 const comparison=rows;
 const comparisonMax=Math.max(1,data.total,...comparison.map(row=>row.options.reduce((n,o)=>n+o.count,0)));
 const ticks=[...new Set([0,Math.ceil(max/2),max])];
 return <div className="survey-visualizations">
 <section className="ops-surface survey-trend"><h3>{t('Daily response trend')}</h3><p>{t(verification?'Verification responses only':'Valid responses')}: <strong data-testid="survey-valid-total">{number(data.total)}</strong></p><p>{t('Submission date (UTC)')} · {t('Response count')}</p>
 <svg viewBox="0 0 660 245" role="img" aria-label={t('Daily response trend')}>
 {ticks.map(n=><g key={n}><line x1="58" x2="598" y1={y(n)} y2={y(n)} stroke="#d9dfd2"/><text x="45" y={y(n)+4} textAnchor="end">{number(n)}</text></g>)}
 <line x1="58" x2="598" y1="190" y2="190" stroke="#65735e"/>
 {trend.length>0&&<><polyline points={trend.map(v=>`${x(v.date)},${y(v.count)}`).join(' ')} fill="none" stroke="#355c45" strokeWidth="3"/>{trend.map(v=><circle key={v.date} cx={x(v.date)} cy={y(v.count)} r="5" fill="#355c45"><title>{v.date}: {number(v.count)} ({percent(v.count)})</title></circle>)}{[trend[0],...(trend.length>1?[trend.at(-1)!]:[])].map((v,i)=><text key={v.date} x={x(v.date)} y="215" textAnchor={trend.length===1?'middle':i===0?'start':'end'}>{v.date}</text>)}</>}
 <text x="330" y="240" textAnchor="middle">{t('Submission date (UTC)')}</text>
 </svg>
 {!trend.length&&<p>{t('No research responses yet.')}</p>}
 <details><summary>{t('Chart data')}</summary><table><caption>{t('Daily response trend')}</caption><thead><tr><th>{t('Submission date (UTC)')}</th><th>{t('Response count')}</th><th>{t('Share of all responses')}</th></tr></thead><tbody>{trend.map(v=><tr key={v.date}><td>{v.date}</td><td>{number(v.count)}</td><td>{percent(v.count)}</td></tr>)}</tbody></table></details></section>
 <p className="survey-chart-note">{t('Percentages use all responses matching the filters. Multiple selections may exceed 100%. Unasked historical questions remain unanswered.')}</p>
 <section className="ops-surface survey-comparison"><h3>{t('Question distribution comparison')}</h3><p>{t('Stacked response counts. Each legend names the question and its choices.')}</p><div className="survey-stack-axis"><span>{t('Response count')}</span><span>{number(0)}</span><span>{number(comparisonMax)}</span></div>
 {comparison.map(({question,index,options})=><div className="survey-stack-row" key={question.key} data-question={question.key}><h4>{index+1}. {t(question.title)}</h4><div className="survey-stack" role="img" aria-label={t(question.title)+': '+options.map(o=>t(o.label)+' '+number(o.count)+' ('+percent(o.count)+')').join('; ')}>{options.map((o,i)=><span key={o.value} style={{width:`${100*o.count/comparisonMax}%`,background:colors[i],borderRightWidth:o.count?1:0}} title={t(o.label)+': '+number(o.count)+' ('+percent(o.count)+')'}>{o.count>0?number(o.count):''}</span>)}</div><ul className="survey-chart-legend">{options.map((o,i)=><li key={o.value}><i style={{background:colors[i]}} aria-hidden="true"/><span>{t(o.label)}: {number(o.count)} ({percent(o.count)})</span></li>)}</ul></div>)}
 </section>
 <div className="ops-question-stats">{rows.map(({question,index,answered,options})=>{
  const donut=question.key==='preference',slices=[...options,...(donut&&answered<data.total?[{value:'missing',label:'Not answered',count:data.total-answered}]:[])];let cumulative=0;
  const gradient=slices.map((o,i)=>{const from=cumulative;cumulative+=data.total?o.count/data.total*100:0;return `${colors[i]} ${from}% ${cumulative}%`;}).join(',');
  return <section className="ops-surface survey-question-chart" key={question.key} data-question={question.key}><h3>{index+1}. {t(question.title)}</h3><p>{t('Answered:')} {number(answered)} · {t('Total')}: {number(data.total)}</p>
  {question.kind==='text'&&<p>{t('Written answers are shown in the table below.')}</p>}
  {donut&&<div className="survey-donut" style={{background:data.total?`conic-gradient(${gradient})`:'#e7e9e2'}} role="img" aria-label={t(question.title)+': '+slices.map(o=>t(o.label)+' '+number(o.count)+' ('+percent(o.count)+')').join('; ')}><span>{number(data.total)}<small>{t('Total')}</small></span></div>}
  <p className="survey-axis-label">{t('Response count')} · {t('Share of all responses')}</p>
  <ul className="survey-bars">{(donut?slices:options).map((o,i)=><li key={o.value} data-option={o.value} data-count={o.count}><div><span>{t(o.label)}</span><strong>{number(o.count)} ({percent(o.count)})</strong></div><div className="survey-bar-track" aria-hidden="true"><span style={{width:`${data.total?Math.min(100,100*o.count/data.total):0}%`,background:colors[i]}}/></div></li>)}</ul>
  <div className="survey-percent-axis" aria-hidden="true"><span>0%</span><span>100%</span></div>
  {question.kind!=='text'&&question.kind!=='multiple'&&answered<data.total&&!donut&&<p>{t('Not answered')}: {number(data.total-answered)} ({percent(data.total-answered)})</p>}
  </section>;
 })}</div>
 </div>;
}
