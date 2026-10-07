/* Dashboard area: private screens are not indexed. Access control lives in proxy.ts and the APIs. */
import type {Metadata} from 'next';
export const metadata:Metadata={robots:{index:false,follow:false}};
export default function DashboardLayout({children}:{children:React.ReactNode}){return children;}
