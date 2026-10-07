'use client';
/* Clear validation for the dashboard's forms. Each form has one zod schema in lib/form-schemas.ts; a form asks
   `check(values)` when its button is pressed, and what is wrong is said UNDER the field it belongs to (FieldError)
   while the field itself is marked (aria-invalid, which the inputs draw as a red ring). A message goes away as soon
   as its field is edited. Buttons are not greyed out for a wrong value any more: a dead button does not say why.
   The schemas load with the first check, so zod is not part of the first load. */
import {useCallback,useState} from 'react';
import type {FieldErrors,FormContext,FormName,FormValues} from '@/lib/form-schemas';

export function useFormCheck<K extends FormName>(name:K){
 const [errors,setErrors]=useState<FieldErrors>({});
 /** the parsed values, or null after putting the messages under the fields */
 const check=useCallback(async(values:unknown,context?:FormContext<K>):Promise<FormValues<K>|null>=>{
  const {checkForm}=await import('@/lib/form-schemas');
  const r=checkForm(name,values,context);
  if(r.ok){setErrors({});return r.data;}
  setErrors(r.errors);
  // bring the first wrong field into view and into focus
  requestAnimationFrame(()=>{const el=document.querySelector<HTMLElement>(`[aria-describedby="${name}-${Object.keys(r.errors)[0]}-error"]`);el?.focus({preventScroll:true});el?.scrollIntoView({block:'center',behavior:'smooth'});});
  return null;
 },[name]);
 const clear=useCallback((field:string)=>setErrors(e=>{if(!e[field])return e;const next={...e};delete next[field];return next;}),[]);
 /** spread on the input of `field`: marks it and ties it to its message */
 const field=(f:string)=>errors[f]?{'aria-invalid':true as const,'aria-describedby':`${name}-${f}-error`}:{};
 return {name,errors,check,clear,field};
}

/** The message of one field. Renders nothing while the field is fine. */
export function FieldError({form,field}:{form:{name:string;errors:FieldErrors};field:string}){
 const message=form.errors[field];if(!message)return null;
 return <p id={`${form.name}-${field}-error`} role="alert" className="flex items-start gap-1.5 text-[12.5px] leading-snug font-medium text-tx-coral">
  <span aria-hidden="true" className="mt-px grid size-4 shrink-0 place-items-center rounded-full bg-t-coral font-mono text-[10px] leading-none font-bold">!</span>{message}
 </p>;
}
