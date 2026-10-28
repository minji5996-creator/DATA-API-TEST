import {handler} from '../server.mjs';
export default async function endpoint(req,res){
 const url=new URL(req.url,'http://localhost');
 const route=url.searchParams.get('route');
 if(route!==null){url.searchParams.delete('route');req.url='/api/'+route+(url.searchParams.size?'?'+url.searchParams.toString():'');}
 return handler(req,res);
}
