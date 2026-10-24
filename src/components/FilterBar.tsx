import type {FormEventHandler,ReactNode} from 'react';
/** Shared wrapping toolbar: labels grow upwards; controls share a bottom baseline. */
export function FilterBar({onSubmit,children}:{onSubmit:FormEventHandler<HTMLFormElement>;children:ReactNode}){
 return <form className="admin-controls filter-bar" onSubmit={onSubmit}>{children}</form>;
}
