// Small, code-native icons; decorative when paired with a text label.
export function WorkspaceIcon({name}:{name:string}){
 const paths:Record<string,string>={notifications:'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5z M10 20h4',overview:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',products:'M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10',inquiries:'M4 4h16v12H9l-5 4z',accounts:'M16 21v-3a4 4 0 0 0-8 0v3 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',security:'M12 3l8 3v6c0 5-8 9-8 9S4 17 4 12V6z',grants:'M7 3h10v18H7z M10 8h4 M10 12h4 M10 16h4',readiness:'M4 6h11v12H4z M15 10h3l3 4v4h-6 M7 18v3 M18 18v3',producers:'M3 20h18 M6 20V9l6-6 6 6v11 M10 20v-6h4v6',buyers:'M3 8h18l-2 9H5z M8 8V4 M16 8V4 M7 21h1 M16 21h1'};
 return <svg className="workspace-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]||paths.overview}/></svg>;
}
