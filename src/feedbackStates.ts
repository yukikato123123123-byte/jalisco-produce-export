// Storage values remain compatible with existing receipts and review history.
export const feedbackTransitions:Record<string,readonly string[]>={received:['received','reviewing','archived'],reviewing:['reviewing','resolved','archived'],resolved:['resolved','archived'],archived:['archived']};
export const feedbackStateLabels:Record<string,string>={received:'New',reviewing:'Reviewing',resolved:'Resolved',archived:'Archived'};
export function canReviewFeedback(before:string,after:string){return feedbackTransitions[before]?.includes(after)===true;}
