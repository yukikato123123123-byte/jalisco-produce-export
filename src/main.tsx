import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {LanguageProvider,Localized} from './localization';
import {NopalHomePage} from './components/NopalHomePage';
import {NopahuaResearch} from './components/NopahuaResearch';
import {AdminWorkspaceRouter} from './components/AdminWorkspaceRouter';
import {AccountPages,isAccountPage} from './components/AccountPages';
import {SiteHeader,SiteFooter} from './components/SiteChrome';
import './styles.css';
import './layout.css';
import './ui.css';
function NotFound(){return <Localized><div className="account-page"><SiteHeader/><main className="account-card"><h1>Page not available</h1><p>This page is no longer part of NopaHua.</p><a href="/">Return to NopaHua</a></main><SiteFooter/></div></Localized>;}
const path=window.location.pathname;
createRoot(document.getElementById('root')!).render(<StrictMode><LanguageProvider>{path==='/'?<NopalHomePage/>:path.startsWith('/research/nopahua')?<NopahuaResearch/>:['/admin','/admin/preview'].includes(path)?<AdminWorkspaceRouter/>:isAccountPage()?<AccountPages/>:<NotFound/>}</LanguageProvider></StrictMode>);
