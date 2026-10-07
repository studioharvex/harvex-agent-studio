'use client';
/* Mobile "More" drawer. Split out of the navbar so vaul loads only when it is first opened. */
import {Drawer,DrawerContent,DrawerDescription,DrawerHeader,DrawerTitle} from '@/components/ui/drawer';
import {Button} from '@/components/ui/button';
import {ToggleGroup,ToggleGroupItem} from '@/components/ui/toggle-group';
import {I} from '@/app/ui';
import {useTheme} from '@/app/theme';
import {ToneIcon,type NavLink,type View} from './navbar';

export function MoreDrawer({open,onOpenChange,items:moreItems,view,onSearch,go}:{open:boolean;onOpenChange:(o:boolean)=>void;items:NavLink[];view:View;onSearch:()=>void;go:(v:View,doc?:string)=>void}){
 const [theme,setTheme]=useTheme();
 return <>
  <Drawer open={open} onOpenChange={onOpenChange}>
   <DrawerContent className="pb-[calc(16px+env(safe-area-inset-bottom))]">
    <DrawerHeader className="text-left"><DrawerTitle>More</DrawerTitle><DrawerDescription>Everything else in Harvex.</DrawerDescription></DrawerHeader>
    <div className="grid gap-4 px-4">
     <Button variant="outline" onClick={()=>{onOpenChange(false);setTimeout(onSearch,200);}} className="h-11 justify-start gap-3 text-muted-foreground"><I id="search"/>Search Harvex…</Button>
     <div className="stagger grid grid-cols-3 gap-2">{moreItems.map(l=><button key={l.title} onClick={()=>go(l.id,l.doc)} aria-current={view===l.id?'page':undefined} className="grid justify-items-center gap-2 rounded-2xl border bg-card px-2 py-4 text-[13px] font-medium text-muted-foreground transition-colors aria-[current=page]:border-foreground/40 aria-[current=page]:text-foreground"><ToneIcon icon={l.icon} tone={l.tone}/>{l.title}</button>)}</div>
     <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3">
      <span className="text-sm font-medium">Appearance</span>
      <ToggleGroup type="single" variant="outline" size="sm" value={theme} onValueChange={v=>v&&setTheme(v as 'dark'|'light')}>
       <ToggleGroupItem value="dark" className="gap-1.5 px-3"><I id="moon"/>Dark</ToggleGroupItem>
       <ToggleGroupItem value="light" className="gap-1.5 px-3"><I id="sun"/>Light</ToggleGroupItem>
      </ToggleGroup>
     </div>
    </div>
   </DrawerContent>
  </Drawer>
 </>;
}
